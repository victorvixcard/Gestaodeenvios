<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    protected $fillable = ['name', 'code', 'active'];

    protected $casts = ['active' => 'boolean'];

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /**
     * Sugere uma sigla de 3 letras a partir do nome, pulando as já usadas.
     * Ex: "Adesivos" -> ADE. Se ADE existir, tenta AD1, AD2...
     */
    public static function sugerirSigla(string $nome, ?int $ignorarId = null): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT', $nome) ?: $nome;
        $base  = strtoupper(preg_replace('/[^A-Za-z]/', '', $ascii));
        $base  = str_pad(substr($base ?: 'CAT', 0, 3), 3, 'X');

        $tentativa = $base;
        $i = 1;

        while (static::where('code', $tentativa)
                     ->when($ignorarId, fn($q) => $q->where('id', '<>', $ignorarId))
                     ->exists()) {
            $tentativa = substr($base, 0, 2) . $i;
            $i++;
            if ($i > 9) {
                $tentativa = substr($base, 0, 1) . str_pad((string) $i, 2, '0', STR_PAD_LEFT);
            }
        }

        return $tentativa;
    }
}
