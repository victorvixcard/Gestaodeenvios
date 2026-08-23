<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** De qual lote uma saida tirou (ou um estorno devolveu) quantas unidades. */
class ProductMovementLot extends Model
{
    public $timestamps = false;

    protected $fillable = ['movement_id', 'lot_id', 'quantidade'];

    protected $casts = ['quantidade' => 'integer'];
}
