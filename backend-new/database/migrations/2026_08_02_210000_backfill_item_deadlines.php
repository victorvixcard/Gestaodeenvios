<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Copia o prazo do pedido para os itens que ainda nao tem prazo proprio.
 *
 * Ate agora o prazo era do pedido inteiro. A tela nova le o prazo de cada
 * item, entao sem isso todo pedido ja existente apareceria SEM prazo nenhum
 * na interface — o dado continuaria em orders.deadline, mas ninguem leria.
 *
 * A copia e fiel: no modelo antigo todos os itens de um pedido venciam no
 * mesmo dia, que e exatamente orders.deadline.
 *
 * NAO preenche unit_price: o preco historico praticado nao esta gravado em
 * lugar nenhum, e chutar o preco atual reescreveria valor de pedido fechado.
 * Item antigo aparece sem preco, que e honesto.
 */
return new class extends Migration
{
    public function up(): void
    {
        $afetados = DB::update("
            UPDATE order_items oi
            JOIN orders o ON o.id = oi.order_id
            SET oi.deadline = o.deadline
            WHERE oi.deadline IS NULL
              AND o.deadline IS NOT NULL
        ");

        echo "  Itens com prazo preenchido a partir do pedido: {$afetados}\n";
    }

    public function down(): void
    {
        // Sem volta: nao ha como distinguir o que foi preenchido aqui do que
        // ja tinha prazo proprio. Reverter apagaria prazo legitimo.
    }
};
