<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CancellationRequest extends Model
{
    protected $fillable = [
        'order_id', 'tenant_slug', 'requested_by_id', 'requested_by', 'reason',
        'status', 'decided_by', 'decision_reason', 'decided_at',
    ];

    protected $casts = [
        'decided_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function toPayload(): array
    {
        return [
            'id'             => (string) $this->id,
            'orderId'        => $this->order_id,
            'tenantSlug'     => $this->tenant_slug,
            'status'         => $this->status,
            'reason'         => $this->reason,
            'requestedBy'    => $this->requested_by,
            'createdAt'      => $this->created_at,
            'decidedBy'      => $this->decided_by,
            'decisionReason' => $this->decision_reason,
            'decidedAt'      => $this->decided_at,
        ];
    }
}
