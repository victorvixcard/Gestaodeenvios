<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Uma entrada de credito: lote com validade propria. */
class ProductLot extends Model
{
    protected $fillable = [
        'tenant_slug', 'product_id', 'quantidade', 'restante', 'validade',
        'motivo', 'user_id',
    ];

    protected $casts = [
        'quantidade' => 'integer',
        'restante'   => 'integer',
        'validade'   => 'date',
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
            // Prazo vencido e RELATORIO, nunca desconto: o saldo nao muda
            'vencido'    => $this->validade->lt(now(config('app.business_timezone', 'America/Sao_Paulo'))->startOfDay()),
            'createdAt'  => $this->created_at?->toIso8601String(),
        ];
    }
}
