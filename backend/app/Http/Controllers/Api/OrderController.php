<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\OrderNote;
use App\Services\BusinessDayService;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(
        private BusinessDayService $businessDayService,
        private WhatsAppService    $whatsApp,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Order::with(['items', 'notes', 'events', 'company'])
            ->orderBy('created_at', 'desc');

        // Super admin vê todas; outros só veem a própria empresa
        if (!$user->isSuperAdmin()) {
            $query->where('tenant_slug', $user->tenant_slug);
        }

        if ($request->status && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('title', 'like', "%{$request->search}%")
                  ->orWhere('id', 'like', "%{$request->search}%")
                  ->orWhere('requested_by', 'like', "%{$request->search}%");
            });
        }

        $orders = $query->get()->map(fn($o) => $this->formatOrder($o));

        return response()->json($orders);
    }

    public function show(string $id): JsonResponse
    {
        $order = Order::with(['items', 'notes', 'events', 'company'])->findOrFail($id);
        return response()->json($this->formatOrder($order));
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title'                    => 'required|string|max:255',
            'items'                    => 'required|array|min:1',
            'items.*.product_id'       => 'required|exists:products,id',
            'items.*.product_name'     => 'required|string',
            'items.*.quantity'         => 'required|integer|min:1',
            'items.*.specifications'   => 'nullable|string',
        ]);

        $user  = $request->user();
        $order = Order::create([
            'tenant_slug'  => $user->tenant_slug,
            'title'        => $request->title,
            'status'       => 'pending',
            'requested_by' => $user->name,
            'files'        => $request->files_list ?? [],
        ]);

        foreach ($request->items as $item) {
            $order->items()->create($item);
        }

        $order->events()->create([
            'type'        => 'created',
            'description' => 'Ordem de serviço criada',
            'author_name' => $user->name,
        ]);

        AuditLog::record(
            'pedido_criado', 'Pedido', $order->id, $order->title, $user,
            count($request->items) . ' item(s) — Prazo: ' . $order->deadline->format('d/m/Y')
        );

        return response()->json($this->formatOrder($order->load(['items', 'events'])), 201);
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:pending,started,production,finishing,done',
        ]);

        $order = Order::findOrFail($id);
        $prev  = $order->status;
        $order->update(['status' => $request->status]);

        $order->events()->create([
            'type'        => 'status_change',
            'description' => "Status alterado para {$request->status}",
            'author_name' => $request->user()->name,
            'status'      => $request->status,
        ]);

        AuditLog::record(
            'pedido_status', 'Pedido', $order->id, $order->title,
            $request->user(), "Status: {$prev} → {$request->status}"
        );

        return response()->json($this->formatOrder($order->fresh(['items', 'notes', 'events'])));
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $request->validate(['reason' => 'required|string|min:5']);

        $order = Order::findOrFail($id);
        $order->update(['status' => 'cancelled', 'cancel_reason' => $request->reason]);

        $order->events()->create([
            'type'        => 'cancel',
            'description' => "Pedido cancelado: {$request->reason}",
            'author_name' => $request->user()->name,
            'status'      => 'cancelled',
        ]);

        AuditLog::record(
            'pedido_cancelado', 'Pedido', $order->id, $order->title,
            $request->user(), "Motivo: {$request->reason}"
        );

        return response()->json($this->formatOrder($order->fresh(['items', 'notes', 'events'])));
    }

    public function addNote(Request $request, string $id): JsonResponse
    {
        $request->validate(['content' => 'required|string']);

        $order = Order::findOrFail($id);
        $user  = $request->user();

        $order->notes()->create([
            'author_name' => $user->name,
            'author_role' => $user->role,
            'content'     => $request->content,
        ]);

        $order->events()->create([
            'type'        => 'note',
            'description' => "Anotação adicionada por {$user->name}",
            'author_name' => $user->name,
        ]);

        AuditLog::record(
            'pedido_nota', 'Pedido', $order->id, $order->title,
            $user, mb_substr($request->content, 0, 100)
        );

        return response()->json($this->formatOrder($order->fresh(['items', 'notes', 'events'])));
    }

    private function formatOrder(Order $order): array
    {
        return [
            'id'           => $order->id,
            'tenantSlug'   => $order->tenant_slug,
            'tenantName'   => $order->company?->name ?? $order->tenant_slug,
            'title'        => $order->title,
            'status'       => $order->status,
            'deadline'     => $order->deadline?->format('Y-m-d'),
            'isOverdue'    => $order->isOverdue(),
            'overdueDays'  => $order->overdue_days,
            'cancelReason' => $order->cancel_reason,
            'requestedBy'  => $order->requested_by,
            'assignedTo'   => $order->assigned_to,
            'items'        => $order->items,
            'notes'        => $order->notes,
            'events'       => $order->events,
            'files'        => $order->files ?? [],
            'createdAt'    => $order->created_at,
            'updatedAt'    => $order->updated_at,
        ];
    }
}
