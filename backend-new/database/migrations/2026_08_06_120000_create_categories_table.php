<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cadastro de categorias de produto.
 *
 * Até agora a lista vivia hardcoded em DOIS lugares: o array CATEGORIES no
 * Products.tsx e o mapa de siglas no Product::generateCode(). Criar uma
 * categoria exigia editar os dois arquivos e publicar; esquecer do mapa fazia
 * o produto nascer com código VIX-OUT-000 em vez da sigla certa.
 *
 * A coluna products.category (texto) CONTINUA existindo e sendo gravada. Ela
 * é o que o frontend já lê em várias telas, e mantê-la evita quebrar o que
 * funciona. O category_id entra ao lado, para integridade e para o rename de
 * categoria conseguir atualizar os produtos.
 */
return new class extends Migration
{
    /** Siglas das categorias que já existiam no código. */
    private const SIGLAS = [
        'Cartões'   => 'CAR',
        'Carnês'    => 'CRN',
        'Etiquetas' => 'ETI',
        'Impressão' => 'IMP',
        'Serviços'  => 'SRV',
        'Outros'    => 'OUT',
    ];

    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            // Sigla de 3 letras usada no código do produto (VIX-CAR-001)
            $table->string('code', 3)->unique();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->after('category')
                  ->constrained('categories')->nullOnDelete();
        });

        // Semeia as categorias conhecidas
        foreach (self::SIGLAS as $nome => $sigla) {
            DB::table('categories')->insert([
                'name' => $nome, 'code' => $sigla, 'active' => true,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        // Qualquer categoria que exista nos produtos e NÃO esteja na lista acima
        // também vira registro — nada do que já foi cadastrado se perde.
        $extras = DB::table('products')
            ->select('category')->distinct()
            ->whereNotNull('category')->where('category', '<>', '')
            ->whereNotIn('category', array_keys(self::SIGLAS))
            ->pluck('category');

        foreach ($extras as $nome) {
            DB::table('categories')->insert([
                'name' => mb_substr($nome, 0, 100),
                'code' => $this->siglaLivre($nome),
                'active' => true,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        // Liga cada produto à sua categoria
        DB::statement('
            UPDATE products p
            JOIN categories c ON c.name = p.category
            SET p.category_id = c.id
        ');

        $semCategoria = DB::table('products')->whereNull('category_id')->count();
        echo "  Categorias criadas: " . DB::table('categories')->count()
           . " | Produtos sem categoria: {$semCategoria}\n";
    }

    /** Gera uma sigla de 3 letras que ainda não esteja em uso. */
    private function siglaLivre(string $nome): string
    {
        $base = strtoupper(preg_replace('/[^A-Za-z]/', '',
            iconv('UTF-8', 'ASCII//TRANSLIT', $nome)));
        $base = str_pad(substr($base ?: 'CAT', 0, 3), 3, 'X');

        $tentativa = $base;
        $i = 1;
        while (DB::table('categories')->where('code', $tentativa)->exists()) {
            $tentativa = substr($base, 0, 2) . $i;
            $i++;
            if ($i > 9) { $tentativa = substr($base, 0, 1) . str_pad((string) $i, 2, '0', STR_PAD_LEFT); }
        }

        return $tentativa;
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropColumn('category_id');
        });

        Schema::dropIfExists('categories');
    }
};
