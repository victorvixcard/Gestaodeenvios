<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'name', 'email', 'password', 'role', 'role_id',
        'tenant_slug', 'avatar_initials', 'avatar_url', 'active',
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

    public function sectors(): BelongsToMany
    {
        return $this->belongsToMany(Sector::class);
    }

    /**
     * Papel dinâmico do usuário. A coluna `role` (nível de acesso) continua
     * sendo quem autoriza — o papel personaliza nome e menus visíveis.
     * Chamado de papel() para não colidir com a coluna `role`.
     */
    public function papel(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
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
