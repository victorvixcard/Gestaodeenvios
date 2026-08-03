<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Company extends Model
{
    protected $primaryKey = 'slug';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'slug', 'name', 'logo_color', 'logo_initials', 'logo_url', 'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'tenant_slug', 'slug');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'tenant_slug', 'slug');
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'company_products', 'company_slug', 'product_id')
                    ->withPivot('deadline_days', 'price');
    }

    /**
     * Prazo de entrega em dias úteis para um produto desta empresa.
     * Cai no padrão global quando o vínculo não tem prazo próprio.
     */
    public function deadlineDaysFor(int|string $productId): int
    {
        $default = (int) config('app.order_deadline_days', 7);

        $link = $this->products()
            ->where('products.id', $productId)
            ->first();

        return (int) ($link?->pivot?->deadline_days ?? $default);
    }
}
