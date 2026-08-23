<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Acoes do papel. Consolida a lista antiga de "permissoes" por usuario
 * (users.permissions, que ninguem mais edita pela tela) em quatro acoes
 * claras definidas no papel: criar_os, cancelar_os, gerenciar_usuarios,
 * ver_relatorios. NULL = padrao do nivel de acesso.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->json('acoes')->nullable()->after('menus');
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn('acoes');
        });
    }
};
