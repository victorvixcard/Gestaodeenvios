<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Uma entrada de credito: lote com validade propria. */
class ProductLot extends Model
{
    protected $fillable = [
        'tenant_slug', 'product_id', 'quantidade', 'restante', 'validade',
        'motivo', 'user_id', 'expired_at',
    ];

    protected $casts = [
        'quantidade' => 'integer',
        'restante'   => 'integer',
        'validade'   => 'date',
        'expired_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function toPayload(): array
    {
        return [
            'id'         => $this->id,
            'productId'  => $this->product_id,
            'quantidade' => $this->quantidade,
            'restante'   => $this->restante,
            'validade'   => $this->validade->toDateString(),
            'motivo'     => $this->motivo,
            'expiredAt'  => $this->expired_at?->toIso8601String(),
            'createdAt'  => $this->created_at?->toIso8601String(),
        ];
    }
}
