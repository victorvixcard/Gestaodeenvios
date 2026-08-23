<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\CancellationRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Fila de solicitações de cancelamento — só a VIXCard (super admin) decide.
 * Aprovar cancela a OS de fato; rejeitar mantém a OS e registra o motivo.
 * Nos dois casos o motivo vai para o histórico da OS.
 */
class CancellationRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = CancellationRequest::with('order:id,title,tenant_slug,status,timeline')
            ->orderByRaw("FIELD(status, 'pending') DESC")   // pendentes primeiro
            ->orderBy('created_at', 'desc');

        if ($request->status && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        return response()->json(
            $query->limit(200)->get()->map(fn($r) => $r->toPayload() + [
                'orderTitle'  => $r->order?->title,
                'orderStatus' => $r->order?->status,
                'tenantName'  => $r->order?->company?->name ?? $r->tenant_slug,
            ])
        );
    }

    public function pendingCount(): JsonResponse
    {
        return response()->json(['pending' => CancellationRequest::where('status', 'pending')->count()]);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        $request->validate(['reason' => 'nullable|string|max:1000']);

        $pedido = CancellationRequest::with('order')->findOrFail($id);
        if ($pedido->status !== 'pending') {
            return response()->json(['message' => 'Esta solicitação já foi respondida.'], 422);
        }

        $user  = $request->user();
        $order = $pedido->order;

        DB::transaction(function () use ($pedido, $order, $user, $request) {
            $pedido->update([
                'status'          => 'approved',
                'decided_by'      => $user->name,
                'decision_reason' => $request->reason,
                'decided_at'      => now(),
            ]);

            $motivo = $request->reason ? "{$pedido->reason} (VIXCard: {$request->reason})" : $pedido->reason;
            $order->update(['status' => 'cancelled', 'cancel_reason' => $motivo]);

            $order->events()->create([
                'type'        => 'cancel',
                'description' => "Cancelamento aprovado por {$user->name}"
                    . ($request->reason ? ": {$request->reason}" : ''),
                'author_name' => $user->name,
                'status'      => 'cancelled',
            ]);
        });

        AuditLog::record(
            'pedido_cancelamento_aprovado', 'Pedido', $order->id, $order->title,
            $user, $request->reason ?: 'Sem observação'
        );

        return response()->json($pedido->fresh()->toPayload());
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        $request->validate(['reason' => 'required|string|min:5|max:1000']);

        $pedido = CancellationRequest::with('order')->findOrFail($id);
        if ($pedido->status !== 'pending') {
            return response()->json(['message' => 'Esta solicitação já foi respondida.'], 422);
        }

        $user  = $request->user();
        $order = $pedido->order;

        $pedido->update([
            'status'          => 'rejected',
            'decided_by'      => $user->name,
            'decision_reason' => $request->reason,
            'decided_at'      => now(),
        ]);

        $order->events()->create([
            'type'        => 'note',
            'description' => "Solicitação de cancelamento rejeitada por {$user->name}: {$request->reason}",
            'author_name' => $user->name,
        ]);

        AuditLog::record(
            'pedido_cancelamento_rejeitado', 'Pedido', $order->id, $order->title,
            $user, "Motivo: {$request->reason}"
        );

        return response()->json($pedido->fresh()->toPayload());
    }
}
