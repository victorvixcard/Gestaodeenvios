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
        'slug', 'name', 'logo_color', 'logo_initials', 'active',
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
        return $this->belongsToMany(Product::class, 'company_products', 'company_slug', 'product_id');
    }
}
