<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\Cenario;
use Tests\TestCase;

/**
 * A regra mais importante do sistema: uma empresa nunca enxerga a outra.
 * Se algum destes testes quebrar, nao sobe em producao.
 */
class IsolamentoEntreEmpresasTest extends TestCase
{
    use RefreshDatabase, Cenario;

    protected function setUp(): void
    {
        parent::setUp();
        $this->montarCenario();
    }

    public function test_empresa_lista_apenas_as_proprias_os(): void
    {
        $this->criarOs($this->ana, 'OS da MedSenior');
        $this->criarOs($this->diego, 'OS da Technip');

        $lista = $this->como($this->ana)->getJson('/api/orders')->assertOk()->json();

        $this->assertCount(1, $lista);
        $this->assertSame('medsenior', $lista[0]['tenantSlug']);
    }

    public function test_empresa_nao_abre_os_de_outra_nem_por_id(): void
    {
        $osTechnip = $this->criarOs($this->diego);

        $this->como($this->ana)->getJson("/api/orders/{$osTechnip->id}")->assertForbidden();
    }

    public function test_super_admin_ve_todas(): void
    {
        $this->criarOs($this->ana);
        $this->criarOs($this->diego);

        $lista = $this->como($this->admin)->getJson('/api/orders')->assertOk()->json();

        $this->assertCount(2, $lista);
    }

    public function test_empresa_nao_acessa_cadastro_de_empresas_nem_logs(): void
    {
        $this->como($this->ana);
        $this->getJson('/api/companies')->assertForbidden();
        $this->getJson('/api/audit-logs')->assertForbidden();
        $this->getJson('/api/sectors')->assertForbidden();
    }

    public function test_empresa_ve_apenas_produtos_vinculados_e_ativos(): void
    {
        // produto nao vinculado e produto vinculado porem inativo
        $solto = \App\Models\Product::create(['name' => 'Solto', 'code' => 'VIX-OUT-001', 'category' => 'Outros', 'stock' => 0, 'active' => true]);
        $inativo = \App\Models\Product::create(['name' => 'Inativo', 'code' => 'VIX-OUT-002', 'category' => 'Outros', 'stock' => 0, 'active' => false]);
        $this->medsenior->products()->attach($inativo->id);

        $nomes = collect($this->como($this->ana)->getJson('/api/products')->assertOk()->json())->pluck('name');

        $this->assertEquals(['Cartao PVC'], $nomes->all());
        $this->assertNotContains($solto->name, $nomes);
    }

    public function test_tenant_admin_gerencia_apenas_usuarios_da_propria_empresa(): void
    {
        $this->como($this->ana)
            ->putJson("/api/users/{$this->diego->id}", ['name' => 'Invasor'])
            ->assertForbidden();

        $emails = collect($this->como($this->ana)->getJson('/api/users')->assertOk()->json())->pluck('email');
        $this->assertFalse($emails->contains('diego@technip.com'));
    }
}
