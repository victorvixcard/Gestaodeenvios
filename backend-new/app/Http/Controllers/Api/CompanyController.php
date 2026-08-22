<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompanyController extends Controller
{
    public function index(): JsonResponse
    {
        $companies = Company::withCount('users')
            ->with(['products' => fn($q) => $q->where('active', true), 'attendants:users.id'])
            ->get()
            ->map(fn($c) => $this->formatCompany($c));

        return response()->json($companies);
    }

    public function show(string $slug): JsonResponse
    {
        $company = Company::with(['users', 'products', 'attendants:users.id'])->findOrFail($slug);
        return response()->json($this->formatCompany($company));
    }

    /**
     * Define a linha do tempo (fluxo de etapas) da empresa. Recebido e
     * Entregue são obrigatórios; as etapas do meio a empresa escolhe e
     * pode renomear. Enviar null volta ao fluxo padrão.
     *
     * Só afeta OS criadas DEPOIS: o pedido congela o fluxo vigente na
     * criação, mesma regra dos prazos e preços.
     */
    public function syncTimeline(Request $request, string $slug): JsonResponse
    {
        $company = Company::findOrFail($slug);

        $request->validate([
            'timeline'          => 'nullable|array|min:2',
            'timeline.*.status' => 'required_with:timeline|in:pending,started,production,finishing,shipped,done',
            'timeline.*.label'  => 'required_with:timeline|string|max:40',
        ]);

        $steps = $request->timeline;

        if ($steps !== null) {
            $statuses = array_column($steps, 'status');
            if (count($statuses) !== count(array_unique($statuses))) {
                return response()->json(['message' => 'Cada etapa só pode aparecer uma vez.'], 422);
            }
            if ($statuses[0] !== 'pending' || end($statuses) !== 'done') {
                return response()->json(['message' => 'O fluxo precisa começar em Recebido e terminar em Entregue.'], 422);
            }
            // Mantém a ordem canônica das etapas intermediárias — o Kanban
            // depende dela para as colunas fazerem sentido
            $canonica  = ['pending', 'started', 'production', 'finishing', 'shipped', 'done'];
            $posicoes  = array_map(fn($s) => array_search($s, $canonica), $statuses);
            $ordenadas = $posicoes;
            sort($ordenadas);
            if ($posicoes !== $ordenadas) {
                return response()->json(['message' => 'As etapas devem seguir a ordem do fluxo de produção.'], 422);
            }
        }

        $company->update(['timeline' => $steps]);

        AuditLog::record(
            'empresa_fluxo_atualizado', 'Empresa', $company->slug, $company->name,
            $request->user(),
            $steps === null ? 'Fluxo padrão restaurado' : count($steps) . ' etapa(s)'
        );

        return response()->json($this->formatCompany(
            $company->fresh(['users', 'products', 'attendants'])
        ));
    }

    /**
     * Define quais colaboradores atendem esta empresa. Aceita qualquer
     * usuário ativo — na prática são os usuários do tenant vixcard.
     */
    public function syncAttendants(Request $request, string $slug): JsonResponse
    {
        $company = Company::findOrFail($slug);

        $request->validate([
            'user_ids'   => 'nullable|array',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        $company->attendants()->sync($request->user_ids ?? []);

        AuditLog::record(
            'empresa_atendentes_atualizados', 'Empresa', $company->slug, $company->name,
            $request->user(), count($request->user_ids ?? []) . ' atendente(s)'
        );

        return response()->json($this->formatCompany(
            $company->fresh(['users', 'products', 'attendants'])
        ));
    }

    /**
     * Branding público — rota SEM autenticação, consumida pela tela de login
     * do tenant. Retorna somente a identidade visual que já apareceria nessa
     * tela. Nunca use formatCompany() aqui: ele carrega usuários, produtos e
     * contadores, que não podem vazar para quem não está autenticado.
     *
     * Empresa inativa responde 404 para não indicar que o slug existe.
     */
    public function publicShow(string $slug): JsonResponse
    {
        $company = Company::where('slug', $slug)->where('active', true)->first();

        if (!$company) {
            return response()->json(['message' => 'Tenant não encontrado.'], 404);
        }

        return response()->json([
            'slug'         => $company->slug,
            'name'         => $company->name,
            'logoColor'    => $company->logo_color,
            'logoInitials' => $company->logo_initials,
            'logoUrl'      => $company->logo_url,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'slug'           => 'required|string|max:50|unique:companies,slug|regex:/^[a-z0-9\-]+$/',
            'name'           => 'required|string|max:255',
            'logo_color'     => 'required|string',
            'logo_initials'  => 'required|string|max:4',
            'logo_url'       => 'nullable|string',
        ]);

        $company = Company::create([
            'slug'          => $request->slug,
            'name'          => $request->name,
            'logo_color'    => $request->logo_color,
            'logo_initials' => $request->logo_initials,
            'logo_url'      => $request->logo_url,
            'active'        => true,
        ]);

        AuditLog::record(
            'empresa_criada', 'Empresa', $company->slug, $company->name,
            $request->user()
        );

        return response()->json($this->formatCompany($company), 201);
    }

    public function update(Request $request, string $slug): JsonResponse
    {
        $company = Company::findOrFail($slug);

        $request->validate([
            'name'          => 'sometimes|string|max:255',
            'logo_color'    => 'sometimes|string',
            'logo_initials' => 'sometimes|string|max:4',
            'logo_url'      => 'nullable|string',
        ]);

        $company->update($request->only(['name', 'logo_color', 'logo_initials', 'logo_url']));

        AuditLog::record(
            'empresa_atualizada', 'Empresa', $company->slug, $company->name,
            $request->user()
        );

        return response()->json($this->formatCompany($company->fresh(['users', 'products'])));
    }

    public function toggleActive(Request $request, string $slug): JsonResponse
    {
        $company = Company::findOrFail($slug);
        $company->update(['active' => !$company->active]);

        $action = $company->active ? 'empresa_ativada' : 'empresa_desativada';
        AuditLog::record(
            $action, 'Empresa', $company->slug, $company->name,
            $request->user()
        );

        return response()->json($this->formatCompany($company->fresh(['users', 'products'])));
    }

    public function products(string $slug): JsonResponse
    {
        $company  = Company::findOrFail($slug);
        $products = $company->products()->get();

        return response()->json($products);
    }

    public function syncProducts(Request $request, string $slug): JsonResponse
    {
        $request->validate([
            'product_ids' => 'required|array',
            'product_ids.*' => 'exists:products,id',
        ]);

        $company = Company::findOrFail($slug);
        $company->products()->sync($request->product_ids);

        AuditLog::record(
            'empresa_produtos_sincronizados', 'Empresa', $company->slug, $company->name,
            $request->user(), count($request->product_ids) . ' produto(s)'
        );

        return response()->json($company->products()->get());
    }

    /**
     * Catálogo da empresa: os produtos liberados para ela com o prazo e o preço
     * praticados. É o fluxo inverso da aba do produto — aqui você configura o
     * contrato de um cliente inteiro numa tela só.
     */
    public function catalog(Request $request, string $slug): JsonResponse
    {
        $company = Company::findOrFail($slug);

        // Encadeia na relacao, NAO em getQuery(): getQuery() devolve o builder
        // cru e o pivot (prazo e preco) chega nulo nos resultados.
        $query = $company->products();

        if ($busca = trim((string) $request->search)) {
            $query->where(function ($q) use ($busca) {
                $q->where('products.name', 'like', "%{$busca}%")
                  ->orWhere('products.code', 'like', "%{$busca}%");
            });
        }

        $page = $query->orderBy('products.name')->paginate(30);

        return response()->json([
            'companySlug' => $company->slug,
            'companyName' => $company->name,
            'defaultDays' => (int) config('app.order_deadline_days', 7),
            'total'       => $company->products()->count(),
            'products'    => collect($page->items())->map(fn($p) => [
                'id'             => (string) $p->id,
                'code'           => $p->code,
                'name'           => $p->name,
                'category'       => $p->category,
                'active'         => (bool) $p->active,
                // Padrões do produto, mostrados como referência (placeholder)
                'defaultDeadline' => $p->deadline_days,
                'defaultPrice'    => $p->price !== null ? (float) $p->price : null,
                // O que foi negociado com esta empresa
                'deadlineDays'   => $p->pivot->deadline_days,
                'price'          => $p->pivot->price !== null ? (float) $p->pivot->price : null,
            ])->values(),
            'pagina'       => $page->currentPage(),
            'totalPaginas' => $page->lastPage(),
        ]);
    }

    /** Grava prazo e preço dos produtos desta empresa. */
    public function syncCatalog(Request $request, string $slug): JsonResponse
    {
        $request->validate([
            'products'                 => 'required|array',
            'products.*.product_id'    => 'required',
            'products.*.deadline_days' => 'nullable|integer|min:1|max:365',
            'products.*.price'         => 'nullable|numeric|min:0|max:9999999',
        ]);

        $company  = Company::findOrFail($slug);
        $enviados = collect($request->products)->pluck('product_id')->all();
        $validos  = $company->products()->whereIn('products.id', $enviados)->pluck('products.id')->all();

        foreach ($request->products as $linha) {
            // Produto não liberado para esta empresa é ignorado
            if (!in_array((int) $linha['product_id'], $validos)) continue;

            $company->products()->updateExistingPivot($linha['product_id'], [
                'deadline_days' => $linha['deadline_days'] ?? null,
                'price'         => $linha['price'] ?? null,
            ]);
        }

        AuditLog::record(
            'empresa_catalogo_atualizado', 'Empresa', $company->slug, $company->name,
            $request->user(), count($validos) . ' produto(s)'
        );

        return $this->catalog($request, $slug);
    }

    private function formatCompany(Company $company): array
    {
        return [
            'slug'         => $company->slug,
            'name'         => $company->name,
            'logoColor'    => $company->logo_color,
            'logoInitials' => $company->logo_initials,
            'logoUrl'      => $company->logo_url,
            'active'       => (bool) $company->active,
            'usersCount'   => $company->users_count ?? $company->users?->count() ?? 0,
            'users'        => $company->relationLoaded('users') ? $company->users : null,
            'products'     => $company->relationLoaded('products') ? $company->products : null,
            'attendantIds' => $company->relationLoaded('attendants')
                ? $company->attendants->pluck('id')->map(fn($i) => (string) $i)->values()
                : null,
            'timeline'     => $company->timeline,
            'createdAt'    => $company->created_at,
        ];
    }
}
