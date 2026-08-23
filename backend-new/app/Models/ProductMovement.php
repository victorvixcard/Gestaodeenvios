<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Linha do livro-razao de creditos. Imutavel: nao se edita nem apaga —
 * erro se corrige com outro lancamento.
 */
class ProductMovement extends Model
{
    public const UPDATED_AT = null;

    public const TIPOS = ['entrada', 'saida', 'estorno'];

    protected $fillable = [
        'tenant_slug', 'product_id', 'tipo', 'origem', 'quantidade', 'saldo_anterior',
        'saldo_posterior', 'cobriu_descoberto', 'lot_id', 'order_id', 'motivo',
        'user_id', 'user_name', 'created_at',
    ];

    protected $casts = [
        'quantidade'        => 'integer',
        'saldo_anterior'    => 'integer',
        'saldo_posterior'   => 'integer',
        'cobriu_descoberto' => 'integer',
        'created_at'        => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function lot(): BelongsTo
    {
        return $this->belongsTo(ProductLot::class, 'lot_id');
    }

    public function lots(): HasMany
    {
        return $this->hasMany(ProductMovementLot::class, 'movement_id');
    }

    public function toPayload(): array
    {
        return [
            'id'               => $this->id,
            'tenantSlug'       => $this->tenant_slug,
            'productId'        => $this->product_id,
            'productName'      => $this->product?->name,
            'tipo'             => $this->tipo,
            'origem'           => $this->origem,
            'quantidade'       => $this->quantidade,
            'saldoAnterior'    => $this->saldo_anterior,
            'saldoPosterior'   => $this->saldo_posterior,
            'cobriuDescoberto' => $this->cobriu_descoberto,
            'lotId'            => $this->lot_id,
            'orderId'          => $this->order_id,
            'motivo'           => $this->motivo,
            'userName'         => $this->user_name,
            'createdAt'        => $this->created_at?->toIso8601String(),
            'lotes'            => $this->relationLoaded('lots')
                ? $this->lots->map(fn ($l) => ['lotId' => $l->lot_id, 'quantidade' => $l->quantidade])->values()
                : null,
        ];
    }
}
