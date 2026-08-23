<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\Cenario;
use Tests\TestCase;

/**
 * Linha do tempo por empresa: OS nova congela o fluxo vigente; mudar o
 * fluxo depois nao toca em OS ja aberta.
 */
class FluxoCongeladoTest extends TestCase
{
    use RefreshDatabase, Cenario;

    protected function setUp(): void
    {
        parent::setUp();
        $this->montarCenario();
    }

    private function definirFluxo(array $etapas): void
    {
        $this->como($this->admin)
            ->putJson('/api/companies/technip/timeline', ['timeline' => $etapas])
            ->assertOk();
    }

    public function test_os_nova_congela_o_fluxo_da_empresa_e_nasce_na_primeira_etapa(): void
    {
        $this->definirFluxo([
            ['label' => 'Recebido',          'fase' => 'pending'],
            ['label' => 'Aprovacao da arte', 'fase' => 'started'],
            ['label' => 'Entregue',          'fase' => 'done'],
        ]);

        $os = $this->criarOs($this->diego);

        $this->assertSame(['recebido', 'aprovacao-da-arte', 'entregue'], $os->timelineStatuses());
        $this->assertSame('recebido', $os->status);
        $this->assertSame('pending', $os->faseAtual());
    }

    public function test_mudar_o_fluxo_depois_nao_altera_os_existente(): void
    {
        $this->definirFluxo([
            ['label' => 'Recebido', 'fase' => 'pending'],
            ['label' => 'Producao', 'fase' => 'production'],
            ['label' => 'Entregue', 'fase' => 'done'],
        ]);
        $antiga = $this->criarOs($this->diego);

        $this->definirFluxo([
            ['label' => 'Recebido', 'fase' => 'pending'],
            ['label' => 'Revisao',  'fase' => 'started'],
            ['label' => 'Entregue', 'fase' => 'done'],
        ]);
        $nova = $this->criarOs($this->diego);

        $this->assertSame(['recebido', 'producao', 'entregue'], $antiga->fresh()->timelineStatuses());
        $this->assertSame(['recebido', 'revisao', 'entregue'], $nova->timelineStatuses());
    }

    public function test_etapa_personalizada_cai_na_fase_certa_e_etapa_de_outro_fluxo_e_recusada(): void
    {
        $this->definirFluxo([
            ['label' => 'Recebido',          'fase' => 'pending'],
            ['label' => 'Aprovacao da arte', 'fase' => 'started'],
            ['label' => 'Entregue',          'fase' => 'done'],
        ]);
        $os = $this->criarOs($this->diego);

        $this->como($this->admin)
            ->patchJson("/api/orders/{$os->id}/status", ['status' => 'aprovacao-da-arte'])
            ->assertOk()
            ->assertJsonPath('statusFase', 'started')
            ->assertJsonPath('statusLabel', 'Aprovacao da arte');

        // 'production' existe no fluxo padrao, mas nao neste
        $this->patchJson("/api/orders/{$os->id}/status", ['status' => 'production'])->assertStatus(422);
    }

    public function test_fluxo_fora_de_ordem_ou_sem_extremos_e_recusado(): void
    {
        $this->como($this->admin);

        $this->putJson('/api/companies/technip/timeline', ['timeline' => [
            ['label' => 'A', 'fase' => 'pending'],
            ['label' => 'B', 'fase' => 'shipped'],
            ['label' => 'C', 'fase' => 'production'],
            ['label' => 'D', 'fase' => 'done'],
        ]])->assertStatus(422);

        $this->putJson('/api/companies/technip/timeline', ['timeline' => [
            ['label' => 'A', 'fase' => 'pending'],
            ['label' => 'B', 'fase' => 'production'],
        ]])->assertStatus(422);
    }

    public function test_prazo_do_item_congela_na_criacao(): void
    {
        $os = $this->criarOs($this->diego);
        $prazoOriginal = $os->items()->first()->deadline_days;

        // muda o prazo do produto para a Technip depois da OS aberta
        $this->technip->products()->updateExistingPivot($this->cartao->id, ['deadline_days' => 30]);

        $this->assertSame($prazoOriginal, $os->fresh()->items()->first()->deadline_days);
        $this->assertSame(3, $prazoOriginal);
    }
}
