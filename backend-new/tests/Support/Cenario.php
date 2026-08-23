<?php

namespace Tests\Support;

use App\Models\Company;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * Cenario minimo compartilhado pelos testes: a VIXCard (super admin), duas
 * empresas clientes com admin e operador, e um produto liberado para as duas.
 * Tudo criado direto pelos modelos — sem depender do DemoSeeder.
 */
trait Cenario
{
    protected User $admin;
    protected User $ana;      // tenant_admin medsenior
    protected User $bruno;    // operator medsenior
    protected User $diego;    // tenant_admin technip
    protected Company $vixcard;
    protected Company $medsenior;
    protected Company $technip;
    protected Product $cartao;

    protected function montarCenario(): void
    {
        $this->vixcard   = $this->empresa('vixcard', 'VIXCard');
        $this->medsenior = $this->empresa('medsenior', 'MedSenior');
        $this->technip   = $this->empresa('technip', 'Technip');

        $this->cartao = Product::create([
            'name' => 'Cartao PVC', 'code' => 'VIX-CAR-001', 'category' => 'Cartoes',
            'stock' => 0, 'active' => true,
        ]);
        $this->medsenior->products()->attach($this->cartao->id, ['deadline_days' => 5]);
        $this->technip->products()->attach($this->cartao->id, ['deadline_days' => 3]);

        $this->admin = $this->usuario('admin@vixcard.com.br', 'Victor Admin', 'super_admin', 'vixcard');
        $this->ana   = $this->usuario('ana@medsenior.com', 'Ana', 'tenant_admin', 'medsenior');
        $this->bruno = $this->usuario('bruno@medsenior.com', 'Bruno', 'operator', 'medsenior');
        $this->diego = $this->usuario('diego@technip.com', 'Diego', 'tenant_admin', 'technip');
    }

    protected function empresa(string $slug, string $nome): Company
    {
        return Company::create([
            'slug' => $slug, 'name' => $nome, 'logo_color' => '#1C508A',
            'logo_initials' => strtoupper(substr($slug, 0, 2)), 'active' => true,
        ]);
    }

    protected function usuario(string $email, string $nome, string $role, string $tenant): User
    {
        return User::create([
            'name' => $nome, 'email' => $email, 'password' => Hash::make('senha123'),
            'role' => $role, 'tenant_slug' => $tenant, 'avatar_initials' => 'XX',
            'permissions' => [], 'active' => true,
        ]);
    }

    protected function como(User $u): static
    {
        Sanctum::actingAs($u);
        return $this;
    }

    /** Cria uma OS pela API, como o usuario informado, e devolve o modelo. */
    protected function criarOs(User $u, string $titulo = 'Pedido de teste'): Order
    {
        $this->como($u);
        $res = $this->postJson('/api/orders', [
            'title' => $titulo,
            'items' => [[
                'product_id' => $this->cartao->id, 'product_name' => 'Cartao PVC', 'quantity' => 10,
            ]],
        ]);
        $res->assertCreated();

        return Order::findOrFail($res->json('id'));
    }
}
