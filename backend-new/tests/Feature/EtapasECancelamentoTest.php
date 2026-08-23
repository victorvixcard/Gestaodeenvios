<?php

namespace Tests\Feature;

use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\Cenario;
use Tests\TestCase;

/**
 * Regras definidas pelo Victor em 2026-08-23: so a VIXCard move etapas;
 * a empresa cancela direto so nos primeiros 15 min e depois solicita.
 */
class EtapasECancelamentoTest extends TestCase
{
    use RefreshDatabase, Cenario;

    protected function setUp(): void
    {
        parent::setUp();
        $this->montarCenario();
    }

    private function envelhecer(Order $os, int $minutos): void
    {
        $os->forceFill(['created_at' => now()->subMinutes($minutos)])->save();
    }

    public function test_empresa_nao_move_etapa_mas_vixcard_move(): void
    {
        $os = $this->criarOs($this->ana);

        $this->como($this->ana)
            ->patchJson("/api/orders/{$os->id}/status", ['status' => 'production'])
            ->assertForbidden();

        $this->como($this->admin)
            ->patchJson("/api/orders/{$os->id}/status", ['status' => 'production'])
            ->assertOk()
            ->assertJsonPath('statusFase', 'production')
            ->assertJsonPath('statusLabel', 'Produção');
    }

    public function test_etapa_fora_do_fluxo_e_recusada(): void
    {
        $os = $this->criarOs($this->ana);

        $this->como($this->admin)
            ->patchJson("/api/orders/{$os->id}/status", ['status' => 'etapa-inexistente'])
            ->assertStatus(422);
    }

    public function test_empresa_cancela_direto_dentro_de_15_minutos(): void
    {
        $os = $this->criarOs($this->ana);

        $this->como($this->ana)
            ->postJson("/api/orders/{$os->id}/cancel", ['reason' => 'pedido feito por engano'])
            ->assertOk()
            ->assertJsonPath('statusFase', 'cancelled');
    }

    public function test_empresa_nao_cancela_direto_depois_de_15_minutos(): void
    {
        $os = $this->criarOs($this->ana);
        $this->envelhecer($os, 20);

        $this->como($this->ana)
            ->postJson("/api/orders/{$os->id}/cancel", ['reason' => 'mudei de ideia'])
            ->assertStatus(422);

        $this->assertNotSame('cancelled', $os->fresh()->status);
    }

    public function test_solicitacao_de_cancelamento_aprovada_cancela_a_os(): void
    {
        $os = $this->criarOs($this->ana);
        $this->envelhecer($os, 20);

        $this->como($this->ana)
            ->postJson("/api/orders/{$os->id}/cancel-request", ['reason' => 'campanha suspensa'])
            ->assertCreated()
            ->assertJsonPath('cancelRequest.status', 'pending');

        // segunda solicitacao enquanto ha uma pendente: recusada
        $this->postJson("/api/orders/{$os->id}/cancel-request", ['reason' => 'de novo'])->assertStatus(422);

        $fila = $this->como($this->admin)->getJson('/api/cancel-requests?status=pending')->assertOk()->json();
        $this->assertCount(1, $fila);

        $this->postJson("/api/cancel-requests/{$fila[0]['id']}/approve", ['reason' => 'ok'])
            ->assertOk()
            ->assertJsonPath('status', 'approved');

        $this->assertSame('cancelled', $os->fresh()->status);
        $this->assertStringContainsString('campanha suspensa', $os->fresh()->cancel_reason);
    }

    public function test_solicitacao_rejeitada_mantem_a_os_e_registra_motivo(): void
    {
        $os = $this->criarOs($this->ana);
        $this->envelhecer($os, 20);

        $this->como($this->ana)->postJson("/api/orders/{$os->id}/cancel-request", ['reason' => 'desistimos'])->assertCreated();
        $req = $this->como($this->admin)->getJson('/api/cancel-requests?status=pending')->json()[0];

        $this->postJson("/api/cancel-requests/{$req['id']}/reject", ['reason' => 'material ja cortado'])
            ->assertOk()
            ->assertJsonPath('status', 'rejected');

        $this->assertNotSame('cancelled', $os->fresh()->status);
        $ultimoEvento = \App\Models\OrderEvent::where('order_id', $os->id)->orderByDesc('id')->first();
        $this->assertStringContainsString('material ja cortado', $ultimoEvento->description);
    }

    public function test_empresa_nao_acessa_a_fila_de_cancelamentos(): void
    {
        $this->como($this->ana)->getJson('/api/cancel-requests')->assertForbidden();
    }

    public function test_arquivar_nao_apaga_e_restaurar_devolve(): void
    {
        $os = $this->criarOs($this->ana);

        $this->como($this->ana)->deleteJson("/api/orders/{$os->id}")->assertForbidden();
        $this->como($this->admin)->deleteJson("/api/orders/{$os->id}")->assertNoContent();

        $this->assertNotNull(Order::withTrashed()->find($os->id)->deleted_at);
        $this->assertCount(0, $this->getJson('/api/orders')->json());
        $this->assertCount(1, $this->getJson('/api/orders?archived=1')->json());

        // numero nao se repete enquanto a OS esta arquivada
        $nova = $this->criarOs($this->diego);
        $this->assertNotSame($os->id, $nova->id);

        $this->como($this->admin)->postJson("/api/orders/{$os->id}/restore")->assertOk();
        $this->assertNull(Order::find($os->id)->deleted_at);
    }
}
