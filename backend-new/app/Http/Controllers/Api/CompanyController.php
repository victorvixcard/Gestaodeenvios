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
            ->with(['products' => fn($q) => $q->where('active', true)])
            ->get()
            ->map(fn($c) => $this->formatCompany($c));

        return response()->json($companies);
    }

    public function show(string $slug): JsonResponse
    {
        $company = Company::with(['users', 'products'])->findOrFail($slug);
        return response()->json($this->formatCompany($company));
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
     * Matriz de prazos da empresa: os produtos vinculados a ela e o prazo de
     * entrega de cada um, em dias úteis. deadlineDays null significa "usa o
     * padrão" — o admin só precisa preencher as exceções.
     */
    public function deadlines(string $slug): JsonResponse
    {
        $company = Company::with('products')->findOrFail($slug);

        return response()->json([
            'companySlug'  => $company->slug,
            'companyName'  => $company->name,
            'defaultDays'  => (int) config('app.order_deadline_days', 7),
            'products'     => $company->products->map(fn($p) => [
                'id'           => $p->id,
                'code'         => $p->code,
                'name'         => $p->name,
                'category'     => $p->category,
                'active'       => (bool) $p->active,
                'deadlineDays' => $p->pivot->deadline_days,
            ])->values(),
        ]);
    }

    /**
     * Grava os prazos. Só mexe no pivot — não vincula nem desvincula produto,
     * para não esbarrar na tela de "produtos liberados", que é outra coisa.
     * Prazo ausente ou null volta a usar o padrão.
     */
    public function syncDeadlines(Request $request, string $slug): JsonResponse
    {
        $request->validate([
            'deadlines'                 => 'required|array',
            'deadlines.*.product_id'    => 'required|exists:products,id',
            'deadlines.*.deadline_days' => 'nullable|integer|min:1|max:365',
        ]);

        $company  = Company::findOrFail($slug);
        $vinculados = $company->products()->pluck('products.id')->all();
        $alterados  = 0;

        foreach ($request->deadlines as $linha) {
            // Ignora produto que não pertence a esta empresa
            if (!in_array($linha['product_id'], $vinculados)) continue;

            $company->products()->updateExistingPivot($linha['product_id'], [
                'deadline_days' => $linha['deadline_days'] ?? null,
            ]);
            $alterados++;
        }

        AuditLog::record(
            'empresa_prazos_atualizados', 'Empresa', $company->slug, $company->name,
            $request->user(), "{$alterados} produto(s)"
        );

        return response()->json($this->deadlines($slug)->getData(true));
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
            'createdAt'    => $company->created_at,
        ];
    }
}
