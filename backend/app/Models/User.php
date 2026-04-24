<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'name', 'email', 'password', 'role',
        'tenant_slug', 'avatar_initials', 'active',
        'permissions', 'whatsapp',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'active'      => 'boolean',
        'permissions' => 'array',
        'password'    => 'hashed',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'tenant_slug', 'slug');
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function isTenantAdmin(): bool
    {
        return $this->role === 'tenant_admin';
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) return true;
        return in_array($permission, $this->permissions ?? []);
    }
}
