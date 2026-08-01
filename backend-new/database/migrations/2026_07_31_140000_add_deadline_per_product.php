<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Prazo de entrega negociado por empresa + produto, em dias úteis.
        // NULL = usa o padrão global (config app.order_deadline_days, hoje 7),
        // para não obrigar o admin a preencher dezenas de vínculos de uma vez.
        Schema::table('company_products', function (Blueprint $table) {
            $table->unsignedSmallInteger('deadline_days')->nullable()->after('product_id');
        });

        // Prazo congelado no momento em que o pedido é criado. Alterar o prazo
        // cadastrado depois NÃO mexe em pedido já aberto — senão uma edição de
        // cadastro faria pedidos antigos virarem "atrasados" sem ninguém agir.
        Schema::table('order_items', function (Blueprint $table) {
            $table->date('deadline')->nullable()->after('quantity');
            $table->unsignedSmallInteger('deadline_days')->nullable()->after('deadline');
        });
    }

    public function down(): void
    {
        Schema::table('company_products', function (Blueprint $table) {
            $table->dropColumn('deadline_days');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['deadline', 'deadline_days']);
        });
    }
};
