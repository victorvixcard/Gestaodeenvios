<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Setores da equipe VIXCard (Comercial, Producao, Linha de impressao, Designer...).
 * Um usuario pode estar em mais de um setor, por isso o vinculo e uma pivot
 * e nao uma coluna em users.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sectors', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('sector_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sector_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unique(['sector_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sector_user');
        Schema::dropIfExists('sectors');
    }
};
