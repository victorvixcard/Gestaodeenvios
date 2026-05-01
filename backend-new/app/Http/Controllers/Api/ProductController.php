<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::query();

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
        $request->validate([
            'name'        => 'required|string|max:255',
            'category'    => 'required|string|max:100',
            'description' => 'nullable|string',
            'photo_url'   => 'nullable|url|max:500',
        ]);

        $product = Product::create([
            'name'        => $request->name,
            'code'        => Product::generateCode($request->category),
            'category'    => $request->category,
            'description' => $request->description,
            'photo_url'   => $request->photo_url,
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
        $product = Product::findOrFail($id);

        $request->validate([
            'name'        => 'sometimes|string|max:255',
            'category'    => 'sometimes|string|max:100',
            'description' => 'nullable|string',
            'photo_url'   => 'nullable|url|max:500',
        ]);

        $product->update($request->only(['name', 'category', 'description', 'photo_url']));

        AuditLog::record(
            'produto_atualizado', 'Produto', $product->id, $product->name,
            $request->user()
        );

        return response()->json($product->fresh());
    }

    public function toggleActive(Request $request, string $id): JsonResponse
    {
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
