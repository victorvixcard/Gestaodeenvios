<?php

use App\Models\Order;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * closed_at: quando a OS entrou em Entregue ou Cancelado (null = aberta).
 *
 * E o que permite a listagem padrao ser "abertas + ultimos 90 dias" sem
 * precisar interpretar a chave de status (que pode ser personalizada por
 * empresa) dentro do SQL. Indices em created_at e closed_at porque sao os
 * dois filtros da listagem.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('closed_at')->nullable()->after('deadline')->index();
            $table->index('created_at');
        });

        // Backfill: resolve a fase pelo fluxo congelado de cada OS
        Order::withTrashed()->get()->each(function (Order $o) {
            if (in_array($o->faseAtual(), ['done', 'cancelled'])) {
                $o->forceFill(['closed_at' => $o->updated_at ?? now()])->saveQuietly();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
            $table->dropIndex(['closed_at']);
            $table->dropColumn('closed_at');
        });
    }
};
