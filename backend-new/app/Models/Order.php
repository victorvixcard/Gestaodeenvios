<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use App\Services\BusinessDayService;

class Order extends Model
{
    protected $primaryKey = 'id';
    protected $keyType    = 'string';
    public $incrementing  = false;

    protected $fillable = [
        'id', 'tenant_slug', 'title', 'status',
        'requested_by', 'assigned_to', 'cancel_reason',
        'deadline', 'files',
    ];

    protected $casts = [
        'deadline' => 'date',
        'files'    => 'array',
    ];

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

    public static function generateId(): string
    {
        // Lock de tabela para evitar race condition em operações concorrentes
        return DB::transaction(function () {
            $max = static::lockForUpdate()->max(
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
        if (in_array($this->status, ['done', 'cancelled'])) return false;

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
