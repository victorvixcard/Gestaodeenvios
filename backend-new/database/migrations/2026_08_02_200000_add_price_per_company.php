<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Preço negociado com a empresa. NULL usa o preço do produto.
        // Mesma lógica do prazo: só se cadastra a exceção.
        Schema::table('company_products', function (Blueprint $table) {
            $table->decimal('price', 10, 2)->nullable()->after('deadline_days');
        });

        // Preço praticado, CONGELADO na criação do pedido — junto com o prazo.
        // Sem isso, um reajuste de tabela reescreveria o valor de pedidos
        // antigos e o histórico deixaria de bater com o que foi cobrado.
        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('unit_price', 10, 2)->nullable()->after('quantity');
        });

        // Busca de empresa por nome nas telas de catálogo — hoje a tabela nao
        // tem indice em name, e o volume previsto e de milhares de empresas.
        Schema::table('companies', function (Blueprint $table) {
            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::table('company_products', function (Blueprint $table) {
            $table->dropColumn('price');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('unit_price');
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->dropIndex(['name']);
        });
    }
};
