<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Etapas livres na linha do tempo.
 *
 * Antes o fluxo era limitado às 6 etapas fixas (enum). Agora uma etapa é
 * {key, label, fase}: key identifica a etapa dentro do fluxo (é o que
 * orders.status guarda), label é o nome exibido e fase ancora a etapa numa
 * das 6 fases canônicas — é a fase que dá coluna no Kanban, cor de badge e
 * regra de atraso. Empresas podem criar quantas etapas quiserem, cada uma
 * apontando para uma fase.
 *
 * orders.status vira VARCHAR porque etapas novas têm chaves próprias
 * (ex.: "aprovacao-da-arte"). As chaves das etapas padrão são os próprios
 * nomes canônicos, então nenhum dado existente muda de valor.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE orders MODIFY status VARCHAR(40) NOT NULL DEFAULT 'pending'"
        );

        // Normaliza fluxos já gravados ({status,label} -> {key,label,fase})
        $normaliza = function (?string $json): ?string {
            if (!$json) return null;
            $steps = json_decode($json, true);
            if (!is_array($steps)) return $json;
            $out = [];
            foreach ($steps as $s) {
                $out[] = [
                    'key'   => $s['key']  ?? $s['status'] ?? 'pending',
                    'label' => $s['label'] ?? '',
                    'fase'  => $s['fase'] ?? $s['status'] ?? 'pending',
                ];
            }
            return json_encode($out, JSON_UNESCAPED_UNICODE);
        };

        foreach (DB::table('companies')->whereNotNull('timeline')->get(['slug', 'timeline']) as $c) {
            DB::table('companies')->where('slug', $c->slug)
                ->update(['timeline' => $normaliza($c->timeline)]);
        }
        foreach (DB::table('orders')->whereNotNull('timeline')->get(['id', 'timeline']) as $o) {
            DB::table('orders')->where('id', $o->id)
                ->update(['timeline' => $normaliza($o->timeline)]);
        }
    }

    public function down(): void
    {
        // Realoca status de etapas personalizadas para a fase canônica antes
        // de estreitar de volta para o enum
        foreach (DB::table('orders')->whereNotNull('timeline')->get(['id', 'status', 'timeline']) as $o) {
            $canonicos = ['pending', 'started', 'production', 'finishing', 'shipped', 'done', 'cancelled'];
            if (in_array($o->status, $canonicos)) continue;
            $steps = json_decode($o->timeline, true) ?: [];
            $fase  = 'pending';
            foreach ($steps as $s) {
                if (($s['key'] ?? null) === $o->status) { $fase = $s['fase'] ?? 'pending'; break; }
            }
            DB::table('orders')->where('id', $o->id)->update(['status' => $fase]);
        }

        DB::statement(
            "ALTER TABLE orders MODIFY status " .
            "ENUM('pending','started','production','finishing','shipped','done','cancelled') " .
            "NOT NULL DEFAULT 'pending'"
        );
    }
};
