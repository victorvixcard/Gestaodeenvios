<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Empresas ──────────────────────────────────────────────────────────
        $vixcard = Company::create([
            'slug'          => 'vixcard',
            'name'          => 'VIXCard',
            'logo_color'    => '#6366f1',
            'logo_initials' => 'VX',
            'active'        => true,
        ]);

        $medsenior = Company::create([
            'slug'          => 'medsenior',
            'name'          => 'MedSênior',
            'logo_color'    => '#10b981',
            'logo_initials' => 'MS',
            'active'        => true,
        ]);

        $unimed = Company::create([
            'slug'          => 'unimed',
            'name'          => 'Unimed',
            'logo_color'    => '#3b82f6',
            'logo_initials' => 'UN',
            'active'        => true,
        ]);

        // ── Super Admin ───────────────────────────────────────────────────────
        User::create([
            'name'            => 'Victor Admin',
            'email'           => 'admin@vixcard.com.br',
            'password'        => Hash::make('password'),
            'role'            => 'super_admin',
            'tenant_slug'     => 'vixcard',
            'avatar_initials' => 'VA',
            'active'          => true,
        ]);

        // ── Usuários por empresa ───────────────────────────────────────────────
        User::create([
            'name'            => 'Gerente MedSênior',
            'email'           => 'gerente@medsenior.com.br',
            'password'        => Hash::make('password'),
            'role'            => 'tenant_admin',
            'tenant_slug'     => 'medsenior',
            'avatar_initials' => 'GM',
            'whatsapp'        => '27999000001',
            'active'          => true,
        ]);

        User::create([
            'name'            => 'Operador MedSênior',
            'email'           => 'operador@medsenior.com.br',
            'password'        => Hash::make('password'),
            'role'            => 'operator',
            'tenant_slug'     => 'medsenior',
            'avatar_initials' => 'OM',
            'active'          => true,
        ]);

        User::create([
            'name'            => 'Gerente Unimed',
            'email'           => 'gerente@unimed.com.br',
            'password'        => Hash::make('password'),
            'role'            => 'tenant_admin',
            'tenant_slug'     => 'unimed',
            'avatar_initials' => 'GU',
            'whatsapp'        => '27999000002',
            'active'          => true,
        ]);

        // ── Produtos ──────────────────────────────────────────────────────────
        $products = [
            ['name' => 'Cartão PVC Standard',     'category' => 'Cartão',     'code' => 'VIX-CAR-001'],
            ['name' => 'Cartão PVC Premium',       'category' => 'Cartão',     'code' => 'VIX-CAR-002'],
            ['name' => 'Cracha Personalizado',     'category' => 'Cracha',     'code' => 'VIX-CRA-001'],
            ['name' => 'Cartão Fidelidade',        'category' => 'Fidelidade', 'code' => 'VIX-FID-001'],
            ['name' => 'Adesivo Vinílico',         'category' => 'Adesivo',    'code' => 'VIX-ADE-001'],
            ['name' => 'Cartão RFID',              'category' => 'RFID',       'code' => 'VIX-RFI-001'],
        ];

        $productModels = collect($products)->map(fn($p) => Product::create([
            'name'     => $p['name'],
            'code'     => $p['code'],
            'category' => $p['category'],
            'active'   => true,
        ]));

        // Associa todos os produtos à VIXCard; subconjuntos aos clientes
        $vixcard->products()->sync($productModels->pluck('id')->toArray());
        $medsenior->products()->sync($productModels->take(3)->pluck('id')->toArray());
        $unimed->products()->sync($productModels->take(4)->pluck('id')->toArray());

        // ── Ordens de serviço de exemplo ─────────────────────────────────────
        $this->seedOrders($productModels);
    }

    private function seedOrders($products): void
    {
        $samples = [
            [
                'tenant'   => 'medsenior',
                'title'    => 'Lote Cartões Janeiro 2025',
                'status'   => 'done',
                'created'  => '-30 days',
                'requester'=> 'Gerente MedSênior',
            ],
            [
                'tenant'   => 'medsenior',
                'title'    => 'Crachás Funcionários Q1',
                'status'   => 'production',
                'created'  => '-5 days',
                'requester'=> 'Gerente MedSênior',
            ],
            [
                'tenant'   => 'unimed',
                'title'    => 'Cartões Fidelidade Março',
                'status'   => 'pending',
                'created'  => '-1 days',
                'requester'=> 'Gerente Unimed',
            ],
            [
                'tenant'   => 'medsenior',
                'title'    => 'Reposição Cartões PVC',
                'status'   => 'started',
                'created'  => '-15 days',
                'requester'=> 'Operador MedSênior',
            ],
        ];

        foreach ($samples as $s) {
            $createdAt = Carbon::now()->modify($s['created']);

            $order = Order::create([
                'tenant_slug'  => $s['tenant'],
                'title'        => $s['title'],
                'status'       => $s['status'],
                'requested_by' => $s['requester'],
                'files'        => [],
                'created_at'   => $createdAt,
                'updated_at'   => $createdAt,
            ]);

            $order->items()->create([
                'product_id'   => $products->first()->id,
                'product_name' => $products->first()->name,
                'quantity'     => rand(100, 500),
            ]);

            $order->events()->create([
                'type'        => 'created',
                'description' => 'Ordem de serviço criada',
                'author_name' => $s['requester'],
                'created_at'  => $createdAt,
            ]);
        }
    }
}
