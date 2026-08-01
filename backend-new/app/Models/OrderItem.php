<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'order_id', 'product_id', 'product_name',
        'quantity', 'deadline', 'deadline_days',
        'specifications', 'selected_variations',
    ];

    protected $casts = [
        'quantity'            => 'integer',
        'deadline'            => 'date',
        'deadline_days'       => 'integer',
        'selected_variations' => 'array',
    ];

    /** Item vencido — pedido concluído ou cancelado nunca conta como atraso. */
    public function isOverdue(string $orderStatus): bool
    {
        if (in_array($orderStatus, ['done', 'cancelled'])) return false;
        if (!$this->deadline) return false;

        return $this->deadline->isPast();
    }

    /**
     * Dias de atraso, sempre positivo.
     * Carbon 3 devolve diferença COM SINAL — daí o abs().
     */
    public function overdueDays(string $orderStatus): int
    {
        if (!$this->isOverdue($orderStatus)) return 0;

        return (int) abs(now()->startOfDay()->diffInDays($this->deadline->startOfDay()));
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
