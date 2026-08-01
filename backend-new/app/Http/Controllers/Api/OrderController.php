<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Order;
use App\Services\BusinessDayService;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class OrderController extends Controller
{
    public function __construct(
        private BusinessDayService $businessDayService,
        private WhatsAppService    $whatsApp,
    ) {}

    // ── Helper: garante que o usuário tem acesso ao pedido ──────────────────
    private function authorizeOrder(Order $order, Request $request): bool
    {
        $user = $request->user();
        if ($user->isSuperAdmin()) return true;
        return $order->tenant_slug === $user->tenant_slug;
    }

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

    public function show(Request $request, string $id): JsonResponse
    {
        $order = Order::with(['items', 'notes', 'events', 'company'])->findOrFail($id);

        if (!$this->authorizeOrder($order, $request)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 403);
        }

        return response()->json($this->formatOrder($order));
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title'                       => 'required|string|max:255',
            'items'                       => 'required|array|min:1',
            'items.*.product_id'          => 'required|exists:products,id',
            'items.*.product_name'        => 'required|string',
            'items.*.quantity'            => 'required|integer|min:1',
            'items.*.specifications'      => 'nullable|string',
            'items.*.selected_variations' => 'nullable|array',
        ]);

        $user  = $request->user();
        $order = Order::create([
            'tenant_slug'  => $user->tenant_slug,
            'title'        => $request->title,
            'status'       => 'pending',
            'requested_by' => $user->name,
            'files'        => [],
        ]);

        // Prazo por item: cada produto tem o prazo negociado com esta empresa.
        // Congelamos aqui — mudar o cadastro depois não altera pedido já aberto.
        // Uma consulta só monta o mapa produto => dias, em vez de uma por item.
        $default  = (int) config('app.order_deadline_days', 7);
        $company  = Company::with('products')->find($user->tenant_slug);
        $diasPorProduto = $company
            ? $company->products->pluck('pivot.deadline_days', 'id')->all()
            : [];

        foreach ($request->items as $item) {
            $dias = (int) ($diasPorProduto[$item['product_id']] ?? $default);

            // Conta a partir de HOJE no fuso do negócio. Em UTC, um pedido feito
            // às 22h de Brasília já contaria a partir do dia seguinte.
            $order->items()->create($item + [
                'deadline_days' => $dias,
                'deadline'      => $this->businessDayService
                    ->addBusinessDays(OrderItem::hoje(), $dias)
                    ->toDateString(),
            ]);
        }

        // O pedido vence junto com seu item mais demorado.
        $order->syncDeadlineFromItems();

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
        $user = $request->user();

        // Super admin pode usar qualquer status, inclusive cancelled (reabrir/cancelar livremente).
        // Demais usuários ficam restritos aos status do fluxo normal.
        $allowedStatuses = $user->isSuperAdmin()
            ? 'pending,started,production,finishing,done,cancelled'
            : 'pending,started,production,finishing,done';

        $request->validate([
            'status' => "required|in:{$allowedStatuses}",
        ]);

        $order = Order::findOrFail($id);

        if (!$this->authorizeOrder($order, $request)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 403);
        }

        $prev = $order->status;
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

        if (!$this->authorizeOrder($order, $request)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 403);
        }

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
        $request->validate(['content' => 'required|string|max:2000']);

        $order = Order::findOrFail($id);

        if (!$this->authorizeOrder($order, $request)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 403);
        }

        $user = $request->user();

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

    public function uploadFile(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'file' => [
                'required',
                'file',
                'max:20480', // 20 MB
                'mimes:pdf,jpg,jpeg,png,gif,webp,ai,eps,cdr,psd,tif,tiff,svg,zip,rar,doc,docx,xls,xlsx',
            ],
        ]);

        $order = Order::findOrFail($id);

        if (!$this->authorizeOrder($order, $request)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 403);
        }

        $file = $request->file('file');
        $path = $file->store('order-files', 'public');

        $entry = [
            'name' => $file->getClientOriginalName(),
            'size' => $file->getSize(),
            'type' => $file->getMimeType(),
            'url'  => Storage::url($path),
            'path' => $path,
        ];

        $files   = $order->files ?? [];
        $files[] = $entry;
        $order->update(['files' => $files]);

        $order->events()->create([
            'type'        => 'file_upload',
            'description' => "Arquivo anexado: {$file->getClientOriginalName()}",
            'author_name' => $request->user()->name,
        ]);

        AuditLog::record(
            'pedido_arquivo', 'Pedido', $order->id, $order->title,
            $request->user(), "Arquivo: {$file->getClientOriginalName()}"
        );

        return response()->json($this->formatOrder($order->fresh(['items', 'notes', 'events'])));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        // Rota já está protegida por role:super_admin, mas mantemos a checagem
        // como defesa em profundidade.
        if (!$request->user()->isSuperAdmin()) {
            return response()->json(['message' => 'Apenas super admin pode excluir pedidos.'], 403);
        }

        $order = Order::findOrFail($id);
        $title = $order->title;
        $tenant = $order->tenant_slug;

        // Remove arquivos do storage para não deixar lixo
        foreach (($order->files ?? []) as $file) {
            if (!empty($file['path'])) {
                Storage::disk('public')->delete($file['path']);
            }
        }

        // Cascade: items, notes e events devem ter onDelete('cascade') na migration.
        $order->delete();

        AuditLog::record(
            'pedido_removido', 'Pedido', $id, $title,
            $request->user(), "Tenant: {$tenant}"
        );

        return response()->json(null, 204);
    }

    public function deleteFile(Request $request, string $id, int $fileIndex): JsonResponse
    {
        $order = Order::findOrFail($id);

        if (!$this->authorizeOrder($order, $request)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 403);
        }

        $files = $order->files ?? [];

        if (isset($files[$fileIndex])) {
            Storage::disk('public')->delete($files[$fileIndex]['path'] ?? '');
            array_splice($files, $fileIndex, 1);
            $order->update(['files' => array_values($files)]);
        }

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
            'items'        => $order->items->map(fn($i) => [
                'id'                 => $i->id,
                'product_id'         => $i->product_id,
                'product_name'       => $i->product_name,
                'quantity'           => $i->quantity,
                'specifications'     => $i->specifications,
                'selected_variations' => $i->selected_variations,
                // Prazo do item — a tela exibe estes valores, nunca recalcula
                'deadline'           => $i->deadline?->format('Y-m-d'),
                'deadlineDays'       => $i->deadline_days,
                'isOverdue'          => $i->isOverdue($order->status),
                'overdueDays'        => $i->overdueDays($order->status),
            ]),
            'notes'        => $order->notes,
            'events'       => $order->events,
            'files'        => $order->files ?? [],
            'createdAt'    => $order->created_at,
            'updatedAt'    => $order->updated_at,
        ];
    }
}
