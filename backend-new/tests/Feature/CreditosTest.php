<?php

namespace Tests\Feature;

use App\Mail\SaldoNegativoMail;
use App\Models\Order;
use App\Models\ProductLot;
use App\Models\ProductMovement;
use App\Services\CreditoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Support\Cenario;
use Tests\TestCase;

/**
 * Creditos de produto por empresa (regras do Victor, 2026-08-23):
 * entrada e um lote com 18 meses; saida a cada OS, FIFO por vencimento;
 * saldo pode ficar negativo; estorno ao cancelar/arquivar/reduzir;
 * aviso por e-mail quando cruza para negativo.
 */
class CreditosTest extends TestCase
{
    use RefreshDatabase, Cenario;

    protected function setUp(): void
    {
        parent::setUp();
        $this->montarCenario();
        Mail::fake();
    }

    private function entrada(int $qtd, string $slug = 'medsenior'): void
    {
        $this->como($this->admin)
            ->postJson("/api/companies/{$slug}/movimentacoes", [
                'product_id' => $this->cartao->id, 'tipo' => 'entrada',
                'quantidade' => $qtd, 'motivo' => "Compra de {$qtd}",
            ])->assertCreated();
    }

    private function saldo(string $slug = 'medsenior'): int
    {
        return app(CreditoService::class)->saldo($slug, $this->cartao->id);
    }

    private function criarOsCom(int $qtd, $user = null): Order
    {
        $this->como($user ?? $this->ana);
        $res = $this->postJson('/api/orders', [
            'title' => "OS de {$qtd}",
            'items' => [['product_id' => $this->cartao->id, 'product_name' => 'Cartao PVC', 'quantity' => $qtd]],
        ]);
        $res->assertCreated();
        return Order::findOrFail($res->json('id'));
    }

    public function test_entrada_cria_lote_com_18_meses_e_os_desconta(): void
    {
        $this->entrada(100);
        $lote = ProductLot::first();
        $this->assertSame(100, $lote->restante);
        $this->assertSame(now()->addMonthsNoOverflow(18)->toDateString(), $lote->validade->toDateString());

        $os = $this->criarOsCom(50);

        $this->assertSame(50, $this->saldo());
        $this->assertSame(50, $lote->fresh()->restante);

        $mov = ProductMovement::where('order_id', $os->id)->first();
        $this->assertSame('saida', $mov->tipo);
        $this->assertSame(100, $mov->saldo_anterior);
        $this->assertSame(50, $mov->saldo_posterior);
        $this->assertSame('Ana', $mov->user_name);
    }

    public function test_saida_usa_o_lote_que_vence_primeiro(): void
    {
        $this->entrada(30);
        $antigo = ProductLot::first();
        $antigo->forceFill(['validade' => now()->addMonths(2)])->save();   // vence antes
        $this->entrada(100);
        $novo = ProductLot::orderByDesc('id')->first();

        $this->criarOsCom(50);

        $this->assertSame(0, $antigo->fresh()->restante);   // 30 do antigo
        $this->assertSame(80, $novo->fresh()->restante);    // 20 do novo
        $this->assertSame(80, $this->saldo());
    }

    public function test_sem_saldo_fica_negativo_e_avisa_uma_vez(): void
    {
        $this->criarOsCom(40);
        $this->assertSame(-40, $this->saldo());
        Mail::assertSent(SaldoNegativoMail::class, 1);

        $this->criarOsCom(10);
        $this->assertSame(-50, $this->saldo());
        Mail::assertSent(SaldoNegativoMail::class, 1);   // nao repete enquanto segue negativo
    }

    public function test_entrada_primeiro_quita_o_descoberto(): void
    {
        $this->criarOsCom(40);                // -40
        $this->entrada(100);                  // 60 no lote, 40 cobriram

        $this->assertSame(60, $this->saldo());
        $this->assertSame(60, ProductLot::first()->restante);
        $this->assertSame(40, ProductMovement::where('tipo', 'entrada')->first()->cobriu_descoberto);
    }

    public function test_cancelar_estorna_para_o_lote(): void
    {
        $this->entrada(100);
        $os = $this->criarOsCom(50);

        $this->como($this->ana)
            ->postJson("/api/orders/{$os->id}/cancel", ['reason' => 'Pedido duplicado'])
            ->assertOk();

        $this->assertSame(100, $this->saldo());
        $this->assertSame(100, ProductLot::first()->restante);
        $this->assertSame('estorno', ProductMovement::orderByDesc('id')->first()->tipo);
    }

    public function test_arquivar_estorna_e_restaurar_desconta_de_novo(): void
    {
        $this->entrada(100);
        $os = $this->criarOsCom(50);

        $this->como($this->admin)->deleteJson("/api/orders/{$os->id}")->assertNoContent();
        $this->assertSame(100, $this->saldo());

        $this->como($this->admin)->postJson("/api/orders/{$os->id}/restore")->assertOk();
        $this->assertSame(50, $this->saldo());

        // Chamar de novo nao duplica
        app(CreditoService::class)->sincronizarOs($os->fresh('items'), $this->admin);
        $this->assertSame(50, $this->saldo());
    }

    public function test_editar_itens_gera_so_a_diferenca(): void
    {
        $this->entrada(100);
        $os = $this->criarOsCom(50);

        $this->como($this->admin)->putJson("/api/orders/{$os->id}/items", [
            'items' => [['product_id' => $this->cartao->id, 'product_name' => 'Cartao PVC', 'quantity' => 80]],
        ])->assertOk();
        $this->assertSame(20, $this->saldo());
        $this->assertSame(-30, ProductMovement::orderByDesc('id')->first()->quantidade);

        $this->como($this->admin)->putJson("/api/orders/{$os->id}/items", [
            'items' => [['product_id' => $this->cartao->id, 'product_name' => 'Cartao PVC', 'quantity' => 20]],
        ])->assertOk();
        $this->assertSame(80, $this->saldo());
        $this->assertSame(60, ProductMovement::orderByDesc('id')->first()->quantidade);
    }

    public function test_lote_vencido_expira_o_que_restava(): void
    {
        $this->entrada(100);
        $this->criarOsCom(30);
        ProductLot::first()->forceFill(['validade' => now()->subDay()])->save();

        $this->assertSame(0, $this->saldo());
        $exp = ProductMovement::where('tipo', 'expiracao')->first();
        $this->assertSame(-70, $exp->quantidade);
        $this->assertNotNull(ProductLot::first()->expired_at);
    }

    public function test_estorno_em_lote_vencido_expira_junto(): void
    {
        $this->entrada(100);
        $os = $this->criarOsCom(100);
        ProductLot::first()->forceFill(['validade' => now()->subDay()])->save();

        $this->como($this->admin)
            ->postJson("/api/orders/{$os->id}/cancel", ['reason' => 'Cancelado tarde'])
            ->assertOk();

        $this->assertSame(0, $this->saldo());
        $this->assertSame(['saida', 'estorno', 'expiracao'],
            ProductMovement::orderBy('id')->pluck('tipo')->skip(1)->values()->all());
    }

    public function test_os_anterior_ao_recurso_nao_estorna_nada(): void
    {
        $os = $this->criarOsCom(50);
        ProductMovement::query()->delete();   // simula OS criada antes dos creditos
        $this->entrada(100);

        $this->como($this->ana)
            ->postJson("/api/orders/{$os->id}/cancel", ['reason' => 'Pedido duplicado'])
            ->assertOk();

        $this->assertSame(100, $this->saldo());
    }

    public function test_isolamento_e_permissoes(): void
    {
        $this->entrada(100);
        $this->entrada(7, 'technip');
        $this->criarOsCom(10);

        // Empresa ve so o proprio saldo e historico
        $this->como($this->bruno)->getJson('/api/movimentacoes/saldos')
            ->assertOk()->assertJsonPath('saldos.0.saldo', 90);
        $this->como($this->diego)->getJson('/api/movimentacoes/saldos')
            ->assertOk()->assertJsonPath('saldos.0.saldo', 7);
        $this->como($this->diego)->getJson('/api/movimentacoes')
            ->assertOk()->assertJsonPath('total', 1);

        // Empresa nao lanca, nem na propria, nem na alheia
        foreach (['medsenior', 'technip'] as $slug) {
            $this->como($this->ana)->postJson("/api/companies/{$slug}/movimentacoes", [
                'product_id' => $this->cartao->id, 'tipo' => 'entrada', 'quantidade' => 5, 'motivo' => 'tentativa',
            ])->assertForbidden();
        }
        $this->como($this->ana)->getJson('/api/companies/technip/movimentacoes')->assertForbidden();

        // Super admin lanca saida manual com observacao
        $this->como($this->admin)->postJson('/api/companies/medsenior/movimentacoes', [
            'product_id' => $this->cartao->id, 'tipo' => 'saida', 'quantidade' => 15, 'motivo' => 'Reimpressao por erro da grafica',
        ])->assertCreated()->assertJsonPath('saldoPosterior', 75);

        // Produto nao vinculado e recusado
        $this->como($this->admin)->postJson('/api/companies/vixcard/movimentacoes', [
            'product_id' => $this->cartao->id, 'tipo' => 'entrada', 'quantidade' => 5, 'motivo' => 'teste',
        ])->assertStatus(422);
    }
}
