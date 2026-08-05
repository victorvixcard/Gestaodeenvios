<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\BusinessDayService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Cenário completo para testar o sistema na máquina local.
 *
 * Recria empresas, produtos, usuários dos três papéis e pedidos espalhados
 * por todos os status, com prazos que produzem atrasado / vence hoje / no
 * prazo. Serve para exercitar todas as telas sem depender de dado de produção.
 *
 *   php artisan db:seed --class=DemoSeeder
 *
 * APAGA pedidos e vínculos antes de recriar. Recusa rodar fora de local.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command->error('DemoSeeder nao roda em producao. Abortado.');
            return;
        }

        $bd = app(BusinessDayService::class);

        $this->command->info('Limpando pedidos e vinculos...');
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        foreach (['order_events', 'order_notes', 'order_items', 'orders', 'company_products'] as $t) {
            DB::table($t)->truncate();
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        // ── Empresas ──────────────────────────────────────────────────────
        $empresas = [
            ['vixcard',   'VIXCard',   '#6366f1', 'VX'],
            ['medsenior', 'MedSênior', '#0F7A5A', 'MS'],
            ['unimed',    'Unimed',    '#00875A', 'UN'],
            ['technip',   'Technip',   '#7C3AED', 'TP'],
        ];
        foreach ($empresas as [$slug, $nome, $cor, $iniciais]) {
            Company::updateOrCreate(['slug' => $slug], [
                'name' => $nome, 'logo_color' => $cor,
                'logo_initials' => $iniciais, 'active' => true,
            ]);
        }
        $this->command->info('4 empresas.');

        // ── Produtos: nome, categoria, preço base, prazo base ─────────────
        $produtos = [
            ['Cartão PVC',              'Cartões',   12.50,  5],
            ['Cartão PVC Premium',      'Cartões',   24.90,  7],
            ['Carnê 2-4 lâminas',       'Carnês',     3.80,  6],
            ['Carnê 11-12 lâminas',     'Carnês',     9.40, 12],
            ['Etiqueta adesiva',        'Etiquetas',  0.45,  3],
            ['Carta de notificação',    'Impressão',  1.90,  4],
            ['Carta timbrada',          'Impressão',  1.20,  4],
            ['Serviço de manuseio',     'Serviços',   0.80,  2],
        ];
        Product::query()->delete();
        $prod = [];
        foreach ($produtos as [$nome, $cat, $preco, $prazo]) {
            $prod[$nome] = Product::create([
                'name' => $nome, 'code' => Product::generateCode($cat),
                'category' => $cat, 'price' => $preco,
                'deadline_days' => $prazo, 'stock' => 0, 'active' => true,
                'description' => "Produto de demonstracao: {$nome}",
            ]);
        }
        $this->command->info('8 produtos com prazo e preco base.');

        // ── Vínculos com prazo/preço negociados por cliente ────────────────
        // MedSênior tem contrato antigo: prazos curtos e preço menor.
        // Unimed usa quase tudo padrão. Technip negociou só alguns.
        $catalogo = [
            'medsenior' => [
                'Cartão PVC'          => [3, 9.90],
                'Cartão PVC Premium'  => [4, 19.90],
                'Carnê 11-12 lâminas' => [8, 7.50],
                'Etiqueta adesiva'    => [2, null],
                'Carta de notificação'=> [null, null],
            ],
            'unimed' => [
                'Cartão PVC'          => [null, null],
                'Etiqueta adesiva'    => [null, null],
                'Carta timbrada'      => [6, null],
            ],
            'technip' => [
                'Cartão PVC'          => [null, 14.00],
                'Carnê 2-4 lâminas'   => [4, null],
                'Carnê 11-12 lâminas' => [15, 11.00],
                'Serviço de manuseio' => [null, null],
            ],
            'vixcard' => [
                'Cartão PVC' => [null, null],
                'Etiqueta adesiva' => [null, null],
            ],
        ];
        foreach ($catalogo as $slug => $itens) {
            $c = Company::find($slug);
            foreach ($itens as $nomeProd => [$dias, $preco]) {
                $c->products()->attach($prod[$nomeProd]->id, [
                    'deadline_days' => $dias, 'price' => $preco,
                ]);
            }
        }
        $this->command->info('Catalogo por empresa, com excecoes negociadas.');

        // ── Usuários: um de cada papel nas empresas cliente ────────────────
        User::query()->delete();
        $usuarios = [
            ['Victor Admin',    'admin@vixcard.com.br', 'super_admin',  'vixcard'],
            ['Ana MedSênior',   'ana@medsenior.com',    'tenant_admin', 'medsenior'],
            ['Bruno MedSênior', 'bruno@medsenior.com',  'operator',     'medsenior'],
            ['Carla Unimed',    'carla@unimed.com',     'tenant_admin', 'unimed'],
            ['Diego Technip',   'diego@technip.com',    'tenant_admin', 'technip'],
            ['Elena Technip',   'elena@technip.com',    'operator',     'technip'],
        ];
        $perms = [
            'super_admin'  => ['view_dashboard','view_orders','create_orders','manage_orders','view_products','view_reports','manage_users'],
            'tenant_admin' => ['view_dashboard','view_orders','create_orders','manage_orders','view_products','view_reports','manage_users'],
            'operator'     => ['view_dashboard','view_orders','create_orders','view_products'],
        ];
        foreach ($usuarios as [$nome, $email, $papel, $slug]) {
            $ini = explode(' ', $nome);
            User::create([
                'name' => $nome, 'email' => $email,
                'password' => Hash::make('senha123'),
                'role' => $papel, 'tenant_slug' => $slug,
                'avatar_initials' => strtoupper($ini[0][0] . ($ini[1][0] ?? '')),
                'permissions' => $perms[$papel], 'active' => true,
            ]);
        }
        $this->command->info('6 usuarios (senha: senha123).');

        // ── Pedidos ───────────────────────────────────────────────────────
        // atraso: quantos dias no passado o prazo do item deve cair.
        // null = mantem o prazo calculado (futuro).
        $pedidos = [
            ['medsenior', 'Cartões de acesso - lote maio',   'pending',    ['Cartão PVC' => [500, -9]]],
            ['medsenior', 'Carnês mensalidade junho',        'production', ['Carnê 11-12 lâminas' => [1200, -3], 'Etiqueta adesiva' => [3000, 0]]],
            ['medsenior', 'Cartas de reajuste',              'started',    ['Carta de notificação' => [800, null]]],
            ['medsenior', 'Cartões premium - diretoria',     'done',       ['Cartão PVC Premium' => [50, null]]],
            ['unimed',    'Etiquetas campanha vacinação',    'pending',    ['Etiqueta adesiva' => [10000, -1]]],
            ['unimed',    'Cartões de carteirinha',          'finishing',  ['Cartão PVC' => [2500, null]]],
            ['unimed',    'Comunicado aos cooperados',       'started',    ['Carta timbrada' => [4000, 0]]],
            ['technip',   'Kit boas-vindas colaboradores',   'production', ['Cartão PVC' => [300, null], 'Serviço de manuseio' => [300, -5]]],
            ['technip',   'Carnês de convênio',              'pending',    ['Carnê 11-12 lâminas' => [700, null]]],
            ['technip',   'Crachás temporários',             'cancelled',  ['Cartão PVC' => [80, null]]],
            ['technip',   'Etiquetas de identificação',      'done',       ['Carnê 2-4 lâminas' => [150, null]]],
            ['medsenior', 'Reimpressão urgente',             'finishing',  ['Cartão PVC' => [120, -14]]],
        ];

        foreach ($pedidos as [$slug, $titulo, $status, $itens]) {
            $empresa = Company::with('products')->find($slug);
            $autor   = User::where('tenant_slug', $slug)->first();

            $order = Order::create([
                'tenant_slug'  => $slug,
                'title'        => $titulo,
                'status'       => $status,
                'requested_by' => $autor?->name ?? 'Sistema',
                'files'        => [],
                'cancel_reason' => $status === 'cancelled' ? 'Cliente cancelou por mudanca de escopo.' : null,
            ]);

            foreach ($itens as $nomeProd => [$qtd, $atraso]) {
                $p     = $prod[$nomeProd];
                $pivot = $empresa->products->firstWhere('id', $p->id)?->pivot;
                $dias  = $pivot?->deadline_days ?? $p->deadline_days ?? 7;
                $preco = $pivot?->price ?? $p->price;

                $prazo = $atraso === null
                    ? $bd->addBusinessDays(now(config('app.business_timezone')), $dias)->toDateString()
                    : now(config('app.business_timezone'))->addDays($atraso)->toDateString();

                $order->items()->create([
                    'product_id' => $p->id, 'product_name' => $p->name,
                    'quantity' => $qtd, 'unit_price' => $preco,
                    'deadline' => $prazo, 'deadline_days' => $dias,
                    'specifications' => '',
                ]);
            }

            $order->syncDeadlineFromItems();
            $order->events()->create([
                'type' => 'created', 'description' => 'Ordem de serviço criada',
                'author_name' => $autor?->name ?? 'Sistema',
            ]);
            if ($status !== 'pending') {
                $order->events()->create([
                    'type' => 'status_change', 'description' => "Status alterado para {$status}",
                    'author_name' => 'Victor Admin', 'status' => $status,
                ]);
            }
        }

        $this->command->info('12 pedidos em todos os status, com atrasos variados.');
        $this->command->info('');
        $this->command->info('Login de qualquer usuario: senha123');
    }
}
