<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use App\Services\BusinessDayService;

class Order extends Model
{
    use SoftDeletes;

    protected $primaryKey = 'id';
    protected $keyType    = 'string';
    public $incrementing  = false;

    protected $fillable = [
        'id', 'tenant_slug', 'title', 'status',
        'requested_by', 'assigned_to', 'cancel_reason',
        'deadline', 'files', 'timeline',
    ];

    protected $casts = [
        'deadline' => 'date',
        'files'    => 'array',
        'timeline' => 'array',
    ];

    /** Fases canônicas, na ordem de produção. É nelas que Kanban, cores e
     *  regra de atraso se apoiam — etapas personalizadas apontam para uma. */
    public const FASES = ['pending', 'started', 'production', 'finishing', 'shipped', 'done'];

    /**
     * Fluxo padrão de etapas. Empresa sem fluxo próprio usa este; o fluxo
     * vigente é congelado em orders.timeline na criação do pedido.
     * As chaves das etapas padrão são os próprios nomes canônicos, o que
     * mantém compatível todo pedido criado antes das etapas livres.
     */
    public const DEFAULT_TIMELINE = [
        ['key' => 'pending',    'label' => 'Recebido',         'fase' => 'pending'],
        ['key' => 'started',    'label' => 'Iniciado',         'fase' => 'started'],
        ['key' => 'production', 'label' => 'Produção',         'fase' => 'production'],
        ['key' => 'finishing',  'label' => 'Acabamento',       'fase' => 'finishing'],
        ['key' => 'shipped',    'label' => 'Envio ao cliente', 'fase' => 'shipped'],
        ['key' => 'done',       'label' => 'Entregue',         'fase' => 'done'],
    ];

    /** Etapas do fluxo deste pedido, sempre no formato {key,label,fase}. */
    public function timelineSteps(): array
    {
        $steps = $this->timeline ?: self::DEFAULT_TIMELINE;
        return array_map(fn($s) => [
            'key'   => $s['key'] ?? $s['status'] ?? 'pending',
            'label' => $s['label'] ?? '',
            'fase'  => $s['fase'] ?? $s['status'] ?? 'pending',
        ], $steps);
    }

    /** Chaves das etapas do fluxo, na ordem (sem cancelled). */
    public function timelineStatuses(): array
    {
        return array_column($this->timelineSteps(), 'key');
    }

    /**
     * Fase canônica do status atual. Etapa personalizada resolve pela chave
     * no fluxo congelado; status canônico responde por si; desconhecido cai
     * em pending (o mais conservador para regra de atraso).
     */
    public function faseAtual(): string
    {
        if ($this->status === 'cancelled') return 'cancelled';

        foreach ($this->timelineSteps() as $s) {
            if ($s['key'] === $this->status) return $s['fase'];
        }
        return in_array($this->status, self::FASES) ? $this->status : 'pending';
    }

    /** Rótulo exibido do status atual. */
    public function statusLabel(): string
    {
        if ($this->status === 'cancelled') return 'Cancelado';

        foreach ($this->timelineSteps() as $s) {
            if ($s['key'] === $this->status) return $s['label'];
        }
        foreach (self::DEFAULT_TIMELINE as $s) {
            if ($s['key'] === $this->status) return $s['label'];
        }
        return $this->status;
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'tenant_slug', 'slug');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function notes(): HasMany
    {
        return $this->hasMany(OrderNote::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(OrderEvent::class)->orderBy('created_at');
    }

    public function cancellationRequests(): HasMany
    {
        return $this->hasMany(CancellationRequest::class)->orderBy('created_at', 'desc');
    }

    /** Janela em que a empresa cliente ainda cancela por conta própria. */
    public const CANCEL_WINDOW_MINUTES = 15;

    /** A empresa cliente ainda está dentro da janela de cancelamento direto? */
    public function dentroDaJanelaDeCancelamento(): bool
    {
        return $this->created_at->gt(now()->subMinutes(self::CANCEL_WINDOW_MINUTES));
    }

    public static function generateId(): string
    {
        // Lock de tabela para evitar race condition em operações concorrentes.
        // withTrashed: OS arquivada continua ocupando o numero dela — sem isso
        // uma OS nova repetiria o numero da ultima arquivada.
        return DB::transaction(function () {
            $max = static::withTrashed()->lockForUpdate()->max(
                DB::raw("CAST(REPLACE(id, 'ORD-', '') AS UNSIGNED)")
            );
            $next = ($max ?? 0) + 1;
            return 'ORD-' . str_pad($next, 3, '0', STR_PAD_LEFT);
        });
    }

    /** Prazo como data pura, comparável com OrderItem::hoje(). */
    private function prazoData(): ?\Carbon\Carbon
    {
        return $this->deadline
            ? \Carbon\Carbon::parse($this->deadline->toDateString())
            : null;
    }

    public function isOverdue(): bool
    {
        // Pela FASE, não pela chave: uma etapa final personalizada
        // ("Concluído") também encerra a contagem de atraso
        if (in_array($this->faseAtual(), ['done', 'cancelled'])) return false;

        // Data com data, no fuso do negócio: isPast() marcaria como atrasado
        // quem vence hoje, e now() em UTC já viraria o dia às 21h de Brasília.
        $prazo = $this->prazoData();

        return $prazo ? $prazo->lt(OrderItem::hoje()) : false;
    }

    public function getOverdueDaysAttribute(): int
    {
        if (!$this->isOverdue()) return 0;

        // abs() porque o Carbon 3 mudou diffInDays para devolver valor COM SINAL
        // (no Carbon 2 era sempre absoluto). Sem isso o atraso saía negativo.
        return (int) abs(OrderItem::hoje()->diffInDays($this->prazoData()));
    }

    /**
     * Recalcula o prazo do pedido como o maior prazo entre os itens — o pedido
     * só está concluído quando o item mais demorado fica pronto.
     */
    public function syncDeadlineFromItems(): void
    {
        $max = $this->items()->max('deadline');

        if ($max && (string) $max !== $this->deadline?->toDateString()) {
            $this->update(['deadline' => $max]);
        }
    }

    protected static function booted(): void
    {
        static::creating(function (Order $order) {
            if (empty($order->id)) {
                $order->id = static::generateId();
            }
            if (empty($order->deadline)) {
                $order->deadline = app(BusinessDayService::class)
                    ->addBusinessDays(now(), (int) config('app.order_deadline_days', 7));
            }
        });
    }
}
