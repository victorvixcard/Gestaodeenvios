<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Product extends Model
{
    protected $fillable = [
        'code', 'name', 'description', 'category', 'category_id',
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
                    ->withPivot('deadline_days', 'price');
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

    /** Preço para uma empresa: o negociado com ela, senão o do produto. */
    public function priceFor(int|float|string|null $pivotPrice = null): ?float
    {
        $preco = $pivotPrice ?? $this->price;

        return $preco !== null ? (float) $preco : null;
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Código do produto no formato VIX-SIGLA-000.
     *
     * A sigla vem da tabela de categorias — antes era um mapa fixo aqui, que
     * precisava ser editado junto com a lista do frontend. Categoria sem
     * cadastro cai em OUT, como antes.
     */
    public static function generateCode(string $category): string
    {
        $cat = Category::where('name', $category)->value('code') ?? 'OUT';

        $count = static::where('code', 'like', "VIX-{$cat}-%")->count();

        return sprintf('VIX-%s-%03d', $cat, $count + 1);
    }
}
