<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    /**
     * O catálogo de produtos pertence à VIXCard e é compartilhado entre todas as
     * empresas. Alterar ou excluir um produto afeta todo mundo que o utiliza, por
     * isso a escrita é exclusiva do super admin.
     *
     * As rotas já aplicam role:super_admin — esta checagem é defesa em profundidade,
     * para o caso de alguém afrouxar o middleware no futuro.
     */
    private function denyIfNotSuperAdmin(Request $request): ?JsonResponse
    {
        if (!$request->user()->isSuperAdmin()) {
            return response()->json(
                ['message' => 'Apenas o super admin pode gerenciar o catálogo de produtos.'],
                403
            );
        }
        return null;
    }

    public function index(Request $request): JsonResponse
    {
        $user  = $request->user();
        $query = Product::query();

        // Non-super-admins see only products linked to their company
        if (!$user->isSuperAdmin()) {
            $query->whereHas('companies', fn($q) => $q->where('companies.slug', $user->tenant_slug));
        }

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('code', 'like', "%{$request->search}%")
                  ->orWhere('category', 'like', "%{$request->search}%");
            });
        }

        if ($request->has('active')) {
            $query->where('active', (bool) $request->active);
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $request->validate([
            'name'        => 'required|string|max:255',
            'category'    => 'required|string|max:100',
            'description' => 'nullable|string',
            'image_url'   => 'nullable|string',
            'video_url'   => 'nullable|string',
            'price'       => 'nullable|numeric|min:0',
            'stock'       => 'nullable|integer|min:0',
            'variations'  => 'nullable|array',
        ]);

        $product = Product::create([
            'name'        => $request->name,
            'code'        => Product::generateCode($request->category),
            'category'    => $request->category,
            'description' => $request->description,
            'image_url'   => $request->image_url,
            'video_url'   => $request->video_url,
            'price'       => $request->price,
            'stock'       => $request->stock ?? 0,
            'variations'  => $request->variations,
            'active'      => true,
        ]);

        AuditLog::record(
            'produto_criado', 'Produto', $product->id, $product->name,
            $request->user(), "Código: {$product->code}"
        );

        return response()->json($product, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $product = Product::findOrFail($id);

        $request->validate([
            'name'        => 'sometimes|string|max:255',
            'category'    => 'sometimes|string|max:100',
            'description' => 'nullable|string',
            'image_url'   => 'nullable|string',
            'video_url'   => 'nullable|string',
            'price'       => 'nullable|numeric|min:0',
            'stock'       => 'nullable|integer|min:0',
            'variations'  => 'nullable|array',
            'active'      => 'sometimes|boolean',
        ]);

        $product->update($request->only([
            'name', 'category', 'description',
            'image_url', 'video_url', 'price', 'stock', 'variations', 'active',
        ]));

        AuditLog::record(
            'produto_atualizado', 'Produto', $product->id, $product->name,
            $request->user()
        );

        return response()->json($product->fresh());
    }

    /**
     * Prazos de alerta do produto: o padrão dele e as exceções por empresa.
     * Alimenta a aba "Prazo de alerta" dentro do cadastro do produto.
     */
    public function deadlines(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $product = Product::findOrFail($id);

        // Paginado e com busca: um produto pode estar vinculado a milhares de
        // empresas. "only_overrides" mostra só quem tem valor proprio, que e
        // a lista curta e util no dia a dia.
        //
        // Encadeia na relacao, NAO em getQuery(): getQuery() devolve o builder
        // cru e o pivot chega nulo nos resultados.
        $query = $product->companies();

        if ($busca = trim((string) $request->search)) {
            $query->where(function ($q) use ($busca) {
                $q->where('companies.name', 'like', "%{$busca}%")
                  ->orWhere('companies.slug', 'like', "%{$busca}%");
            });
        }

        if ($request->boolean('only_overrides')) {
            $query->where(function ($q) {
                $q->whereNotNull('company_products.deadline_days')
                  ->orWhereNotNull('company_products.price');
            });
        }

        $page = $query->orderBy('companies.name')->paginate(20);

        return response()->json([
            'productId'    => $product->id,
            'productName'  => $product->name,
            'defaultDays'  => (int) config('app.order_deadline_days', 7),
            'deadlineDays' => $product->deadline_days,
            'price'        => $product->price !== null ? (float) $product->price : null,
            'totalVinculos' => $product->companies()->count(),
            'totalExcecoes' => $product->companies()
                ->where(function ($q) {
                    $q->whereNotNull('company_products.deadline_days')
                      ->orWhereNotNull('company_products.price');
                })->count(),
            'companies'    => collect($page->items())->map(fn($c) => [
                'slug'         => $c->slug,
                'name'         => $c->name,
                'active'       => (bool) $c->active,
                'deadlineDays' => $c->pivot->deadline_days,
                'price'        => $c->pivot->price !== null ? (float) $c->pivot->price : null,
            ])->values(),
            'pagina'       => $page->currentPage(),
            'totalPaginas' => $page->lastPage(),
        ]);
    }

    /**
     * Grava o prazo padrão do produto e as exceções por empresa.
     * Empresa que não estiver vinculada ao produto é ignorada.
     */
    public function syncDeadlines(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $request->validate([
            'deadline_days'               => 'nullable|integer|min:1|max:365',
            'price'                       => 'nullable|numeric|min:0|max:9999999',
            'companies'                   => 'nullable|array',
            'companies.*.slug'            => 'required|string',
            'companies.*.deadline_days'   => 'nullable|integer|min:1|max:365',
            'companies.*.price'           => 'nullable|numeric|min:0|max:9999999',
        ]);

        $product = Product::findOrFail($id);
        $product->update([
            'deadline_days' => $request->deadline_days,
            'price'         => $request->price,
        ]);

        // Confere so os slugs enviados, em vez de carregar todos os vinculos —
        // com milhares de empresas, puxar a lista inteira nao escala.
        $enviados = collect($request->companies ?? [])->pluck('slug')->all();
        $validos  = $enviados
            ? $product->companies()->whereIn('companies.slug', $enviados)->pluck('companies.slug')->all()
            : [];

        foreach ($request->companies ?? [] as $linha) {
            if (!in_array($linha['slug'], $validos)) continue;

            $product->companies()->updateExistingPivot($linha['slug'], [
                'deadline_days' => $linha['deadline_days'] ?? null,
                'price'         => $linha['price'] ?? null,
            ]);
        }

        AuditLog::record(
            'produto_prazos_atualizados', 'Produto', $product->id, $product->name,
            $request->user(),
            'Padrão: ' . ($product->deadline_days ?? 'global') . ' dias | ' . count($validos) . ' empresa(s)'
        );

        return $this->deadlines($request, $id);
    }

    public function toggleActive(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $product = Product::findOrFail($id);
        $product->update(['active' => !$product->active]);

        $action = $product->active ? 'produto_ativado' : 'produto_desativado';
        AuditLog::record(
            $action, 'Produto', $product->id, $product->name,
            $request->user()
        );

        return response()->json($product->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $product = Product::findOrFail($id);
        $name    = $product->name;
        $product->delete();

        AuditLog::record(
            'produto_removido', 'Produto', $id, $name,
            $request->user()
        );

        return response()->json(null, 204);
    }
}
