<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Excluir" OS vira "arquivar": a linha fica no banco com deleted_at e some
 * das listagens, podendo ser restaurada. Antes a exclusao apagava itens,
 * eventos e arquivos de vez — um clique errado perdia o historico.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
