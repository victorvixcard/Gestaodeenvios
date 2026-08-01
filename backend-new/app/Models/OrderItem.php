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

    /**
     * Hoje no fuso do negócio, como data pura (00:00 no fuso padrão do PHP).
     *
     * Precisa ser data pura: comparar um Carbon de Brasília com um Carbon de UTC
     * dá errado mesmo quando as duas representam o mesmo dia — meia-noite em
     * Brasília é 03:00 UTC, e a comparação enxerga 3 horas de diferença.
     */
    public static function hoje(): \Carbon\Carbon
    {
        $tz = config('app.business_timezone', 'America/Sao_Paulo');

        return \Carbon\Carbon::parse(now($tz)->toDateString());
    }

    /** Prazo do item como data pura, comparável com hoje(). */
    private function prazoData(): ?\Carbon\Carbon
    {
        return $this->deadline
            ? \Carbon\Carbon::parse($this->deadline->toDateString())
            : null;
    }

    /**
     * Item vencido — pedido concluído ou cancelado nunca conta como atraso.
     *
     * Compara DATA com DATA. Usar isPast() marcaria como atrasado um item que
     * vence hoje, já que o prazo é 00:00 e agora é qualquer hora depois disso.
     * Quem vence hoje tem o dia todo.
     */
    public function isOverdue(string $orderStatus): bool
    {
        if (in_array($orderStatus, ['done', 'cancelled'])) return false;

        $prazo = $this->prazoData();

        return $prazo ? $prazo->lt(static::hoje()) : false;
    }

    /**
     * Dias de atraso, sempre positivo.
     * Carbon 3 devolve diferença COM SINAL — daí o abs().
     */
    public function overdueDays(string $orderStatus): int
    {
        if (!$this->isOverdue($orderStatus)) return 0;

        return (int) abs(static::hoje()->diffInDays($this->prazoData()));
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
