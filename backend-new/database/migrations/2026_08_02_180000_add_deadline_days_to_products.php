<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Prazo padrão do produto, em dias úteis. Vale para todas as empresas.
        // A exceção por empresa continua em company_products.deadline_days.
        //
        // Cadeia de precedência ao criar um pedido:
        //   company_products.deadline_days  (exceção negociada)
        //   -> products.deadline_days       (padrão do produto)
        //   -> config app.order_deadline_days (padrão global, 7)
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedSmallInteger('deadline_days')->nullable()->after('stock');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('deadline_days');
        });
    }
};
