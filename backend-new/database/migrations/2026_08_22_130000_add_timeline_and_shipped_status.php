<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Linha do tempo por cliente + novo marco "Envio ao cliente" (shipped).
 *
 * - orders.status ganha o valor 'shipped' entre acabamento e entrega
 * - companies.timeline: fluxo personalizado da empresa (null = padrao)
 * - orders.timeline: fluxo CONGELADO na criacao do pedido — mudar o fluxo
 *   da empresa depois nao mexe em OS ja aberta, mesma regra dos prazos
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE orders MODIFY status " .
            "ENUM('pending','started','production','finishing','shipped','done','cancelled') " .
            "NOT NULL DEFAULT 'pending'"
        );

        Schema::table('companies', function (Blueprint $table) {
            $table->json('timeline')->nullable()->after('active');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->json('timeline')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('timeline');
        });
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('timeline');
        });

        // Antes de estreitar o enum, realoca quem estiver em 'shipped'
        DB::table('orders')->where('status', 'shipped')->update(['status' => 'finishing']);
        DB::statement(
            "ALTER TABLE orders MODIFY status " .
            "ENUM('pending','started','production','finishing','done','cancelled') " .
            "NOT NULL DEFAULT 'pending'"
        );
    }
};
