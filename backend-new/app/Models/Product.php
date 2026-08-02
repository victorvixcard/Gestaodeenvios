<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Product extends Model
{
    protected $fillable = [
        'code', 'name', 'description', 'category',
        'image_url', 'video_url', 'price', 'stock', 'deadline_days', 'variations', 'active',
    ];

    protected $casts = [
        'active'        => 'boolean',
        'stock'         => 'integer',
        'deadline_days' => 'integer',
        'price'         => 'decimal:2',
        'variations'    => 'array',
    ];

    public function companies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class, 'company_products', 'product_id', 'company_slug')
                    ->withPivot('deadline_days');
    }

    /**
     * Prazo em dias úteis deste produto para uma empresa.
     *
     * Precedência: exceção negociada com a empresa > padrão do produto >
     * padrão global. O $pivotDays entra por parâmetro para quem já carregou
     * o vínculo não precisar de outra consulta.
     */
    public function deadlineDaysFor(?int $pivotDays = null): int
    {
        return $pivotDays
            ?? $this->deadline_days
            ?? (int) config('app.order_deadline_days', 7);
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
