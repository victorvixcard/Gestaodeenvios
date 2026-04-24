<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Product extends Model
{
    protected $fillable = [
        'code', 'name', 'description', 'category',
        'image_url', 'video_url', 'stock', 'active',
    ];

    protected $casts = [
        'active' => 'boolean',
        'stock'  => 'integer',
    ];

    public function companies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class, 'company_products', 'product_id', 'company_slug');
    }

    public static function generateCode(string $category): string
    {
        $map = [
            'Cartões'   => 'CAR', 'Carnês'    => 'CRN',
            'Etiquetas' => 'ETI', 'Impressão' => 'IMP',
            'Serviços'  => 'SRV', 'Outros'    => 'OUT',
        ];
        $cat   = $map[$category] ?? 'OUT';
        $count = static::where('code', 'like', "VIX-{$cat}-%")->count();
        return sprintf('VIX-%s-%03d', $cat, $count + 1);
    }
}
