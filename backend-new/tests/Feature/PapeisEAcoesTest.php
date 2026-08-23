<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Sector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\Cenario;
use Tests\TestCase;

/**
 * Papeis dinamicos: o nivel de acesso continua mandando; o papel restringe
 * acoes e menus, nunca libera alem do nivel.
 */
class PapeisEAcoesTest extends TestCase
{
    use RefreshDatabase, Cenario;

    protected function setUp(): void
    {
        parent::setUp();
        $this->montarCenario();
    }

    public function test_papel_sem_a_acao_criar_os_bloqueia_na_api(): void
    {
        $papel = Role::create(['name' => 'Visualizador', 'base_role' => 'operator', 'acoes' => [], 'active' => true]);
        $this->bruno->update(['role_id' => $papel->id]);

        $this->como($this->bruno)->postJson('/api/orders', [
            'title' => 'nao deve', 'items' => [['product_id' => $this->cartao->id, 'product_name' => 'x', 'quantity' => 1]],
        ])->assertForbidden();
    }

    public function test_papel_padrao_do_nivel_operador_cria_os(): void
    {
        $this->criarOs($this->bruno); // assertCreated dentro do helper
        $this->assertTrue(true);
    }

    public function test_tenant_admin_nao_atribui_papel_de_nivel_super(): void
    {
        $super = Role::create(['name' => 'Chefe', 'base_role' => 'super_admin', 'active' => true]);

        $this->como($this->ana)
            ->postJson('/api/users', [
                'name' => 'Escalada', 'email' => 'x@medsenior.com', 'role_id' => $super->id, 'tenant_slug' => 'medsenior',
            ])->assertForbidden();

        // e a listagem de papeis nem mostra os de nivel super para ele
        $niveis = collect($this->getJson('/api/roles')->assertOk()->json())->pluck('baseRole')->unique();
        $this->assertFalse($niveis->contains('super_admin'));
    }

    public function test_papel_define_o_nivel_de_acesso_do_usuario(): void
    {
        $papel = Role::create(['name' => 'Analista', 'base_role' => 'super_admin', 'menus' => ['pedidos'], 'active' => true]);

        $res = $this->como($this->admin)->postJson('/api/users', [
            'name' => 'Maycon', 'email' => 'maycon@vixcard.com.br', 'role_id' => $papel->id,
            'tenant_slug' => 'vixcard', 'password' => 'senha123',
        ])->assertCreated();

        $this->assertSame('super_admin', $res->json('role'));
        $this->assertSame(['pedidos'], $res->json('papel.menus'));
    }

    public function test_usuario_de_empresa_cliente_nunca_recebe_setor(): void
    {
        $setor = Sector::create(['name' => 'Producao', 'active' => true]);

        $res = $this->como($this->admin)
            ->putJson("/api/users/{$this->ana->id}", ['sector_ids' => [$setor->id]])
            ->assertOk();

        $this->assertSame([], $res->json('sectors'));

        // colaborador da VIXCard recebe normalmente
        $res = $this->putJson("/api/users/{$this->admin->id}", ['sector_ids' => [$setor->id]])->assertOk();
        $this->assertCount(1, $res->json('sectors'));
    }
}
