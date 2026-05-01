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

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'slug'           => 'required|string|max:50|unique:companies,slug|regex:/^[a-z0-9\-]+$/',
            'name'           => 'required|string|max:255',
            'logo_color'     => 'required|string',
            'logo_initials'  => 'required|string|max:4',
        ]);

        $company = Company::create([
            'slug'          => $request->slug,
            'name'          => $request->name,
            'logo_color'    => $request->logo_color,
            'logo_initials' => $request->logo_initials,
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
        ]);

        $company->update($request->only(['name', 'logo_color', 'logo_initials']));

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

    private function formatCompany(Company $company): array
    {
        return [
            'slug'         => $company->slug,
            'name'         => $company->name,
            'logoColor'    => $company->logo_color,
            'logoInitials' => $company->logo_initials,
            'active'       => (bool) $company->active,
            'usersCount'   => $company->users_count ?? $company->users?->count() ?? 0,
            'users'        => $company->relationLoaded('users') ? $company->users : null,
            'products'     => $company->relationLoaded('products') ? $company->products : null,
            'createdAt'    => $company->created_at,
        ];
    }
}
