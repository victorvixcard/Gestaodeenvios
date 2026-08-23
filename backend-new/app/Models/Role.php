<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    protected $fillable = ['name', 'base_role', 'menus', 'acoes', 'active'];

    /** Acoes que um papel pode liberar. */
    public const ACOES = ['criar_os', 'cancelar_os', 'gerenciar_usuarios', 'ver_relatorios'];

    /** Padrao de cada nivel quando o papel nao define acoes (null). */
    public const ACOES_PADRAO = [
        'super_admin'  => ['criar_os', 'cancelar_os', 'gerenciar_usuarios', 'ver_relatorios'],
        'tenant_admin' => ['criar_os', 'cancelar_os', 'gerenciar_usuarios', 'ver_relatorios'],
        'operator'     => ['criar_os', 'cancelar_os'],
    ];

    protected $casts = [
        'menus'  => 'array',
        'acoes'  => 'array',
        'active' => 'boolean',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
