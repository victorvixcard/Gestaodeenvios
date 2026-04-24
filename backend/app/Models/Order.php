<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
        $count = static::count() + 1;
        return 'ORD-' . str_pad($count, 3, '0', STR_PAD_LEFT);
    }

    public function isOverdue(): bool
    {
        if (in_array($this->status, ['done', 'cancelled'])) return false;
        return $this->deadline->isPast();
    }

    public function getOverdueDaysAttribute(): int
    {
        if (!$this->isOverdue()) return 0;
        return now()->startOfDay()->diffInDays($this->deadline->startOfDay());
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
