<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Atendentes por empresa: quais colaboradores da VIXCard atendem cada
 * cliente. Quando a empresa abre uma OS, ela "cai" para esses usuarios —
 * e o painel lateral de Pedidos/Kanban filtra por eles.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_user', function (Blueprint $table) {
            $table->id();
            $table->string('company_slug', 50);
            $table->foreign('company_slug')->references('slug')->on('companies')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unique(['company_slug', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_user');
    }
};
