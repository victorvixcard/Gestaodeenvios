<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    public $timestamps = false;
    public $updatedAt  = false;

    protected $fillable = [
        'action', 'entity_type', 'entity_id', 'entity_name',
        'user_name', 'user_email', 'user_role', 'tenant_slug', 'details',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public static function record(
        string $action,
        string $entityType,
        string $entityId,
        string $entityName,
        User   $actor,
        ?string $details = null
    ): void {
        static::create([
            'action'      => $action,
            'entity_type' => $entityType,
            'entity_id'   => $entityId,
            'entity_name' => $entityName,
            'user_name'   => $actor->name,
            'user_email'  => $actor->email,
            'user_role'   => $actor->role,
            'tenant_slug' => $actor->tenant_slug,
            'details'     => $details,
        ]);
    }
}
