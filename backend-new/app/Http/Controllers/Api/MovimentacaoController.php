<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\ProductMovement;
use App\Services\CreditoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Creditos de produto por empresa.
 *
 * Leitura: qualquer usuario da empresa ve os proprios saldos e historico;
 * o super admin ve qualquer empresa via /companies/{slug}/...
 * Escrita (entrada e saida manual): so super admin.
 */
class MovimentacaoController extends Controller
{
    public function __construct(private CreditoService $creditos) {}

    /** Empresa alvo: a da URL (super admin) ou a do token (demais). */
    private function empresa(Request $request, ?string $slug): ?Company
    {
        $user = $request->user();
        if ($slug !== null) {
            if (!$user->isSuperAdmin() && $slug !== $user->tenant_slug) return null;
            return Company::with('products')->find($slug);
        }
        return Company::with('products')->find($user->tenant_slug);
    }

    public function saldos(Request $request, ?string $slug = null): JsonResponse
    {
        $company = $this->empresa($request, $slug);
        if (!$company) return response()->json(['message' => 'Empresa não encontrada.'], 404);

        return response()->json([
            'tenantSlug'  => $company->slug,
            'companyName' => $company->name,
            'saldos'      => $this->creditos->saldos($company),
        ]);
    }

    public function index(Request $request, ?string $slug = null): JsonResponse
    {
        $company = $this->empresa($request, $slug);
        if (!$company) return response()->json(['message' => 'Empresa não encontrada.'], 404);

        $request->validate([
            'product_id' => 'nullable|integer',
            'order_id'   => 'nullable|string|max:20',
            'tipo'       => 'nullable|in:' . implode(',', ProductMovement::TIPOS),
            'from'       => 'nullable|date',
            'to'         => 'nullable|date',
            'limit'      => 'nullable|integer|min:1|max:1000',
        ]);

        $query = ProductMovement::with('product:id,name')
            ->where('tenant_slug', $company->slug)
            ->orderByDesc('id');

        if ($request->product_id) $query->where('product_id', $request->product_id);
        if ($request->order_id)   $query->where('order_id', $request->order_id);
        if ($request->tipo)       $query->where('tipo', $request->tipo);
        // Datas escolhidas no fuso do negocio; created_at fica em UTC
        $tz = config('app.business_timezone', 'America/Sao_Paulo');
        if ($request->from) $query->where('created_at', '>=', \Illuminate\Support\Carbon::parse($request->from, $tz)->startOfDay()->utc());
        if ($request->to)   $query->where('created_at', '<=', \Illuminate\Support\Carbon::parse($request->to, $tz)->endOfDay()->utc());

        $limite = (int) ($request->limit ?? 300);
        $total  = (clone $query)->count();

        return response()->json([
            'total'        => $total,
            'movimentacoes'=> $query->limit($limite)->get()->map(fn ($m) => $m->toPayload())->values(),
        ]);
    }

    /** Lancamento manual: entrada (cria lote) ou saida (desconta). Super admin. */
    public function store(Request $request, string $slug): JsonResponse
    {
        $company = Company::with('products')->find($slug);
        if (!$company) return response()->json(['message' => 'Empresa não encontrada.'], 404);

        $data = $request->validate([
            'product_id' => 'required|integer|exists:products,id',
            'tipo'       => 'required|in:entrada,saida',
            'quantidade' => 'required|integer|min:1|max:1000000',
            'motivo'     => 'required|string|min:3|max:500',
        ]);

        if (!$company->products->contains('id', $data['product_id'])) {
            return response()->json(['message' => 'Este produto não está vinculado à empresa.'], 422);
        }

        $user = $request->user();
        $mov  = $data['tipo'] === 'entrada'
            ? $this->creditos->entrada($company->slug, $data['product_id'], $data['quantidade'], $data['motivo'], $user)
            : $this->creditos->saidaManual($company->slug, $data['product_id'], $data['quantidade'], $data['motivo'], $user);

        $produto = $company->products->firstWhere('id', $data['product_id']);
        AuditLog::record(
            $data['tipo'] === 'entrada' ? 'credito_entrada' : 'credito_saida',
            'Empresa', $company->slug, $company->name, $user,
            "{$produto->name}: {$data['quantidade']} un. — {$data['motivo']} (saldo {$mov->saldo_anterior} -> {$mov->saldo_posterior})"
        );

        return response()->json($mov->load('product:id,name')->toPayload(), 201);
    }
}
