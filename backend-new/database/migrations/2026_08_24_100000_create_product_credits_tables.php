<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creditos de produto por empresa.
 *
 * product_lots           cada ENTRADA e um lote com validade propria (18 meses)
 * product_movements      livro-razao: toda mudanca de saldo, com o saldo antes
 *                        e depois congelados — o saldo atual e o saldo_posterior
 *                        do ultimo movimento, nunca uma coluna separada
 * product_movement_lots  de qual lote cada saida tirou / cada estorno devolveu
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_lots', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_slug', 50);
            $table->unsignedBigInteger('product_id');
            $table->integer('quantidade');                 // comprado
            $table->integer('restante');                   // ainda disponivel
            $table->date('validade');
            $table->string('motivo', 255)->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();

            $table->foreign('tenant_slug')->references('slug')->on('companies')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->index(['tenant_slug', 'product_id', 'validade']);
        });

        Schema::create('product_movements', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_slug', 50);
            $table->unsignedBigInteger('product_id');
            $table->string('tipo', 20);                    // entrada | saida | estorno
            $table->string('origem', 10);                  // manual | automatico (OS)
            $table->integer('quantidade');                 // com sinal: + soma, - subtrai
            $table->integer('saldo_anterior');
            $table->integer('saldo_posterior');
            $table->integer('cobriu_descoberto')->default(0); // parte da entrada que quitou saldo negativo
            $table->unsignedBigInteger('lot_id')->nullable();  // entrada/expiracao: o lote
            $table->string('order_id', 20)->nullable();
            $table->string('motivo', 500)->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('user_name', 100)->nullable();
            $table->timestamp('created_at')->nullable();

            $table->foreign('tenant_slug')->references('slug')->on('companies')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('lot_id')->references('id')->on('product_lots')->nullOnDelete();
            $table->index(['tenant_slug', 'product_id', 'id']);
            $table->index(['order_id']);
        });

        Schema::create('product_movement_lots', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('movement_id');
            $table->unsignedBigInteger('lot_id');
            $table->integer('quantidade');                 // sempre positivo; o tipo do movimento da o sentido

            $table->foreign('movement_id')->references('id')->on('product_movements')->onDelete('cascade');
            $table->foreign('lot_id')->references('id')->on('product_lots')->onDelete('cascade');
            $table->index(['lot_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_movement_lots');
        Schema::dropIfExists('product_movements');
        Schema::dropIfExists('product_lots');
    }
};
