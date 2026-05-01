<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderNote extends Model
{
    protected $fillable = ['order_id', 'author_name', 'author_role', 'content'];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
