<?php

namespace App\Services;

use App\Mail\SaldoNegativoMail;
use App\Models\Company;
use App\Models\Order;
use App\Models\ProductLot;
use App\Models\ProductMovement;
use App\Models\ProductMovementLot;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Creditos de produto por empresa.
 *
 * Regras (Victor, 2026-08-23):
 *  - Cada ENTRADA e um lote com prazo de uso (config credit_validity_months).
 *    O prazo NAO mexe no saldo: lote vencido continua valendo e aparece no
 *    relatorio de prazos vencidos — a cobranca e comercial, nao automatica.
 *  - SAIDA desconta do lote mais antigo primeiro (FIFO). Sem lote, o saldo
 *    fica negativo ("descoberto") — a OS nunca e bloqueada.
 *  - ENTRADA nova primeiro quita o descoberto; o que sobra fica no lote.
 *  - ESTORNO (cancelar/arquivar/reduzir OS) devolve ao lote de origem.
 *  - Invariante: saldo == soma(restante dos lotes) - descoberto.
 *    O saldo atual e sempre o saldo_posterior do ultimo movimento.
 *
 * Toda escrita roda sob lock por empresa+produto e dentro de transacao, para
 * duas OS simultaneas nao lerem o mesmo saldo anterior.
 */
class CreditoService
{
    public const ALERTA_EMAIL_PADRAO = 'felipegat@vixcard.com.br';

    // ── Leitura ─────────────────────────────────────────────────────────

    public function saldo(string $tenant, int $productId): int
    {
        return $this->saldoAtual($tenant, $productId);
    }

    /** Saldo de cada produto vinculado a empresa (inclui os sem movimento, com 0). */
    public function saldos(Company $company): array
    {
        $hoje = $this->hoje();
        $saida = [];
        foreach ($company->products as $p) {
            $saldo = $this->saldoAtual($company->slug, $p->id);

            $lotes = ProductLot::where('tenant_slug', $company->slug)
                ->where('product_id', $p->id)
                ->where('restante', '>', 0)
                ->orderBy('validade')
                ->get();

            $consumo30 = -ProductMovement::where('tenant_slug', $company->slug)
                ->where('product_id', $p->id)
                ->where('tipo', 'saida')
                ->where('created_at', '>=', $hoje->copy()->subDays(30))
                ->sum('quantidade');

            // Prazos vencidos: relatorio, nunca desconto. O que passou do
            // prazo continua no saldo e listado a parte para acompanhamento.
            $vencidos  = $lotes->filter(fn ($l) => $l->validade->lt($hoje));
            $noPrazo   = $lotes->reject(fn ($l) => $l->validade->lt($hoje));
            $proximo   = $noPrazo->first();

            $saida[] = [
                'productId'         => $p->id,
                'productName'       => $p->name,
                'saldo'             => $saldo,
                'consumo30Dias'     => (int) $consumo30,
                'restanteVencido'   => (int) $vencidos->sum('restante'),
                'lotesVencidos'     => $vencidos->map(fn ($l) => $l->toPayload())->values(),
                'proximoVencimento' => $proximo ? [
                    'validade' => $proximo->validade->toDateString(),
                    'restante' => $proximo->restante,
                ] : null,
                'lotes'             => $lotes->map(fn ($l) => $l->toPayload())->values(),
            ];
        }
        return $saida;
    }

    // ── Lancamentos manuais (super admin) ───────────────────────────────

    public function entrada(string $tenant, int $productId, int $qtd, string $motivo, User $user): ProductMovement
    {
        if ($qtd <= 0) {
            throw new \InvalidArgumentException('Quantidade da entrada deve ser maior que zero.');
        }

        return $this->sob($tenant, $productId, function () use ($tenant, $productId, $qtd, $motivo, $user) {
            $anterior = $this->saldoAtual($tenant, $productId);

            $cobriu = min($qtd, max(0, -$anterior));
            $lote = ProductLot::create([
                'tenant_slug' => $tenant,
                'product_id'  => $productId,
                'quantidade'  => $qtd,
                'restante'    => $qtd - $cobriu,
                'validade'    => $this->hoje()->addMonthsNoOverflow((int) config('app.credit_validity_months', 18)),
                'motivo'      => $motivo,
                'user_id'     => $user->id,
            ]);

            return $this->registrar($tenant, $productId, 'entrada', $qtd, $anterior, [
                'origem'            => 'manual',
                'lot_id'            => $lote->id,
                'cobriu_descoberto' => $cobriu,
                'motivo'            => $motivo,
                'user_id'           => $user->id,
                'user_name'         => $user->name,
            ]);
        });
    }

    public function saidaManual(string $tenant, int $productId, int $qtd, string $motivo, User $user): ProductMovement
    {
        if ($qtd <= 0) {
            throw new \InvalidArgumentException('Quantidade da saída deve ser maior que zero.');
        }

        return $this->sob($tenant, $productId, fn () =>
            $this->saida($tenant, $productId, $qtd, null, $motivo, $user, 'manual')
        );
    }

    // ── OS ──────────────────────────────────────────────────────────────

    /**
     * Deixa o consumo da OS igual ao que ela deve consumir agora: a soma dos
     * itens por produto, ou zero se estiver cancelada/arquivada. A diferenca
     * vira saida ou estorno. Idempotente — chamar duas vezes nao duplica.
     * OS anteriores ao recurso nunca consumiram, logo cancelar uma delas
     * nao devolve nada.
     */
    public function sincronizarOs(Order $order, ?User $user, string $motivo = ''): void
    {
        $encerrada = $order->trashed() || $order->faseAtual() === 'cancelled';

        $desejado = [];
        if (!$encerrada) {
            foreach ($order->items as $item) {
                $desejado[$item->product_id] = ($desejado[$item->product_id] ?? 0) + (int) $item->quantity;
            }
        }

        // Produtos que ja consumiram nesta OS entram no acerto mesmo fora
        // dos itens atuais (edicao que trocou o produto).
        $jaConsumidos = ProductMovement::where('order_id', $order->id)
            ->whereIn('tipo', ['saida', 'estorno'])
            ->distinct()->pluck('product_id');
        foreach ($jaConsumidos as $pid) {
            $desejado[$pid] = $desejado[$pid] ?? 0;
        }

        foreach ($desejado as $productId => $qtd) {
            $this->sob($order->tenant_slug, (int) $productId, function () use ($order, $productId, $qtd, $user, $motivo) {
                $atual = $this->consumoDaOs($order->id, (int) $productId);
                if ($qtd > $atual) {
                    $this->saida($order->tenant_slug, (int) $productId, $qtd - $atual, $order->id, $motivo ?: "OS {$order->id}", $user);
                } elseif ($qtd < $atual) {
                    $this->estorno($order, (int) $productId, $atual - $qtd, $motivo ?: "OS {$order->id}", $user);
                }
            });
        }
    }

    /** Quanto a OS ainda consome daquele produto (saidas menos estornos). */
    public function consumoDaOs(string $orderId, int $productId): int
    {
        return -(int) ProductMovement::where('order_id', $orderId)
            ->where('product_id', $productId)
            ->whereIn('tipo', ['saida', 'estorno'])
            ->sum('quantidade');
    }

    // ── Internos ────────────────────────────────────────────────────────

    private function saida(string $tenant, int $productId, int $qtd, ?string $orderId, string $motivo, ?User $user, string $origem = 'automatico'): ProductMovement
    {
        $anterior = $this->saldoAtual($tenant, $productId);

        $mov = $this->registrar($tenant, $productId, 'saida', -$qtd, $anterior, [
            'origem'    => $origem,
            'order_id'  => $orderId,
            'motivo'    => $motivo,
            'user_id'   => $user?->id,
            'user_name' => $user?->name,
        ]);

        // FIFO: o lote mais antigo (menor validade) paga primeiro — inclusive
        // os ja vencidos, que continuam valendo. O que nao couber em lote
        // nenhum fica descoberto (saldo negativo), sem alocacao.
        $falta = $qtd;
        $lotes = ProductLot::where('tenant_slug', $tenant)->where('product_id', $productId)
            ->where('restante', '>', 0)
            ->orderBy('validade')->orderBy('id')->lockForUpdate()->get();
        foreach ($lotes as $lote) {
            if ($falta <= 0) break;
            $usa = min($lote->restante, $falta);
            $lote->decrement('restante', $usa);
            ProductMovementLot::create(['movement_id' => $mov->id, 'lot_id' => $lote->id, 'quantidade' => $usa]);
            $falta -= $usa;
        }

        return $mov;
    }

    private function estorno(Order $order, int $productId, int $qtd, string $motivo, ?User $user): ProductMovement
    {
        $anterior = $this->saldoAtual($order->tenant_slug, $productId);

        $mov = $this->registrar($order->tenant_slug, $productId, 'estorno', $qtd, $anterior, [
            'origem'    => 'automatico',
            'order_id'  => $order->id,
            'motivo'    => $motivo,
            'user_id'   => $user?->id,
            'user_name' => $user?->name,
        ]);

        // Quanto desta OS ainda esta alocado em cada lote (saidas - estornos)
        $porLote = [];
        $movimentos = ProductMovement::where('order_id', $order->id)->where('product_id', $productId)
            ->whereIn('tipo', ['saida', 'estorno'])->with('lots')->get();
        foreach ($movimentos as $m) {
            foreach ($m->lots as $al) {
                $porLote[$al->lot_id] = ($porLote[$al->lot_id] ?? 0) + ($m->tipo === 'saida' ? $al->quantidade : -$al->quantidade);
            }
        }
        $coberto = array_sum($porLote);
        $consumo = $this->consumoDaOs($order->id, $productId) + $qtd; // antes deste estorno
        $descoberto = max(0, $consumo - $coberto);

        // Primeiro reduz o descoberto (so mexe no saldo); depois devolve aos
        // lotes, do consumido por ultimo para o primeiro. Lote vencido recebe
        // de volta normalmente — o prazo e relatorio, nao desconto.
        $falta = max(0, $qtd - $descoberto);
        $lotes = ProductLot::whereIn('id', array_keys(array_filter($porLote)))
            ->orderByDesc('validade')->orderByDesc('id')->lockForUpdate()->get();
        foreach ($lotes as $lote) {
            if ($falta <= 0) break;
            $devolve = min($porLote[$lote->id], $falta);
            ProductMovementLot::create(['movement_id' => $mov->id, 'lot_id' => $lote->id, 'quantidade' => $devolve]);
            $lote->increment('restante', $devolve);
            $falta -= $devolve;
        }

        return $mov;
    }

    private function registrar(string $tenant, int $productId, string $tipo, int $qtd, int $anterior, array $extra): ProductMovement
    {
        $posterior = $anterior + $qtd;
        $mov = ProductMovement::create([
            'tenant_slug'     => $tenant,
            'product_id'      => $productId,
            'tipo'            => $tipo,
            'quantidade'      => $qtd,
            'saldo_anterior'  => $anterior,
            'saldo_posterior' => $posterior,
            'created_at'      => now(),
        ] + $extra);

        if ($anterior >= 0 && $posterior < 0) {
            $this->avisarSaldoNegativo($mov);
        }
        return $mov;
    }

    private function avisarSaldoNegativo(ProductMovement $mov): void
    {
        $destino = config('app.credit_alert_email') ?: self::ALERTA_EMAIL_PADRAO;
        try {
            Mail::to($destino)->send(new SaldoNegativoMail($mov->load('product')));
        } catch (\Throwable $e) {
            Log::warning("Falha ao avisar saldo negativo ({$mov->tenant_slug}/{$mov->product_id}): {$e->getMessage()}");
        }
    }

    private function saldoAtual(string $tenant, int $productId): int
    {
        return (int) (ProductMovement::where('tenant_slug', $tenant)->where('product_id', $productId)
            ->orderByDesc('id')->value('saldo_posterior') ?? 0);
    }

    private function sob(string $tenant, int $productId, \Closure $fn): mixed
    {
        return Cache::lock("credito:{$tenant}:{$productId}", 15)->block(10, fn () => DB::transaction($fn));
    }

    private function hoje(): Carbon
    {
        return now(config('app.business_timezone', 'America/Sao_Paulo'))->startOfDay();
    }
}
