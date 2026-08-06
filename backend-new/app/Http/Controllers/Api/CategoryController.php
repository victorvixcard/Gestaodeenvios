<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CategoryController extends Controller
{
    /**
     * O catálogo é da VIXCard, então quem cria e edita categoria é o super
     * admin — mesma regra dos produtos. Listar é liberado porque o formulário
     * de produto precisa das opções.
     */
    private function denyIfNotSuperAdmin(Request $request): ?JsonResponse
    {
        if (!$request->user()->isSuperAdmin()) {
            return response()->json(
                ['message' => 'Apenas o super admin pode gerenciar categorias.'],
                403
            );
        }
        return null;
    }

    public function index(Request $request): JsonResponse
    {
        $query = Category::withCount('products');

        if (!$request->boolean('all')) {
            $query->where('active', true);
        }

        return response()->json(
            $query->orderBy('name')->get()->map(fn($c) => $this->format($c))
        );
    }

    public function store(Request $request): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $request->validate([
            'name' => 'required|string|max:100|unique:categories,name',
            'code' => 'nullable|string|size:3|regex:/^[A-Za-z]{3}$/|unique:categories,code',
        ]);

        $category = Category::create([
            'name'   => $request->name,
            // Sem sigla informada, sugere a partir do nome (Adesivos -> ADE)
            'code'   => strtoupper($request->code ?: Category::sugerirSigla($request->name)),
            'active' => true,
        ]);

        AuditLog::record(
            'categoria_criada', 'Produto', $category->id, $category->name,
            $request->user(), "Sigla: {$category->code}"
        );

        return response()->json($this->format($category->loadCount('products')), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $category = Category::findOrFail($id);

        $request->validate([
            'name'   => "sometimes|string|max:100|unique:categories,name,{$id}",
            'code'   => "sometimes|string|size:3|regex:/^[A-Za-z]{3}$/|unique:categories,code,{$id}",
            'active' => 'sometimes|boolean',
        ]);

        $nomeAntigo = $category->name;

        DB::transaction(function () use ($request, $category, $nomeAntigo) {
            $category->update(array_filter([
                'name'   => $request->name,
                'code'   => $request->code ? strtoupper($request->code) : null,
                'active' => $request->has('active') ? $request->boolean('active') : null,
            ], fn($v) => $v !== null));

            // products.category guarda o NOME em texto e é o que as telas leem.
            // Sem isso, renomear a categoria deixaria os produtos com o nome
            // antigo e o filtro da tela pararia de encontrá-los.
            if ($request->name && $request->name !== $nomeAntigo) {
                Product::where('category_id', $category->id)
                       ->update(['category' => $request->name]);
            }
        });

        AuditLog::record(
            'categoria_atualizada', 'Produto', $category->id, $category->name,
            $request->user(),
            $nomeAntigo !== $category->name ? "Renomeada de: {$nomeAntigo}" : null
        );

        return response()->json($this->format($category->fresh()->loadCount('products')));
    }

    /**
     * Excluir é bloqueado quando há produto usando a categoria — apagar
     * deixaria os produtos órfãos e o código deles (VIX-CAR-001) sem
     * significado. Nesse caso o caminho é desativar.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $category = Category::withCount('products')->findOrFail($id);

        if ($category->products_count > 0) {
            return response()->json([
                'message' => "Não é possível excluir: {$category->products_count} produto(s) usam esta categoria. Desative-a em vez de excluir.",
            ], 422);
        }

        $nome = $category->name;
        $category->delete();

        AuditLog::record(
            'categoria_removida', 'Produto', $id, $nome, $request->user()
        );

        return response()->json(null, 204);
    }

    public function toggleActive(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $category = Category::findOrFail($id);
        $category->update(['active' => !$category->active]);

        AuditLog::record(
            $category->active ? 'categoria_ativada' : 'categoria_desativada',
            'Produto', $category->id, $category->name, $request->user()
        );

        return response()->json($this->format($category->fresh()->loadCount('products')));
    }

    private function format(Category $c): array
    {
        return [
            'id'            => (string) $c->id,
            'name'          => $c->name,
            'code'          => $c->code,
            'active'        => (bool) $c->active,
            'productsCount' => $c->products_count ?? 0,
        ];
    }
}
