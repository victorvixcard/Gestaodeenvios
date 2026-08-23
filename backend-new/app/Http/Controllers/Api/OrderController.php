<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\NovaOsMail;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Order;
use App\Models\OrderItem;
use App\Services\BusinessDayService;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
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

        $query = Order::with(['items', 'notes', 'events', 'company', 'cancellationRequests'])
            ->orderBy('created_at', 'desc');

        // Super admin vê todas; outros só veem a própria empresa
        if (!$user->isSuperAdmin()) {
            $query->where('tenant_slug', $user->tenant_slug);
        }

        // Arquivadas ficam fora por padrão; super admin pede com ?archived=1
        if ($user->isSuperAdmin() && $request->boolean('archived')) {
            $query->onlyTrashed();
        } elseif (!$request->boolean('all')) {
            // Janela padrão: OS abertas + criadas nos últimos 90 dias. A tela
            // pede ?all=1 quando precisa do histórico completo (relatórios,
            // "ver mais antigas"). Com 50 OS/dia isso mantém a resposta pequena.
            $query->where(function ($q) {
                $q->whereNull('closed_at')
                  ->orWhere('created_at', '>=', now()->subDays(Order::JANELA_DIAS));
            });
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
        $order = Order::with(['items', 'notes', 'events', 'company', 'cancellationRequests'])->findOrFail($id);

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

        $user = $request->user();
        if (!$user->podeAcao('criar_os')) {
            return response()->json(['message' => 'Seu papel não permite criar OS.'], 403);
        }
        $company = Company::with('products')->find($user->tenant_slug);

        // Fluxo da empresa congelado aqui: mudar a linha do tempo dela depois
        // so afeta OS futuras, mesma regra dos prazos e precos. A OS nasce na
        // PRIMEIRA etapa do proprio fluxo (num fluxo custom a chave nao e
        // 'pending' — e o slug do nome da etapa).
        $timeline = $company?->timeline;

        $order = Order::create([
            'tenant_slug'  => $user->tenant_slug,
            'title'        => $request->title,
            'status'       => $timeline[0]['key'] ?? 'pending',
            'requested_by' => $user->name,
            'files'        => [],
            'timeline'     => $timeline,
        ]);

        // Prazo por item, congelado aqui — mudar o cadastro depois não altera
        // pedido já aberto. Precedência: exceção da empresa > padrão do produto
        // > padrão global. Uma consulta só, em vez de uma por item.
        $default = (int) config('app.order_deadline_days', 7);

        $prazos = [];
        $precos = [];
        foreach (($company?->products ?? []) as $p) {
            $prazos[$p->id] = $p->pivot->deadline_days ?? $p->deadline_days;
            $precos[$p->id] = $p->priceFor($p->pivot->price);
        }

        foreach ($request->items as $item) {
            $dias = (int) ($prazos[$item['product_id']] ?? $default);

            // Prazo e preço congelados aqui. Um reajuste de tabela depois nao
            // pode reescrever o que foi acordado neste pedido.
            // Conta a partir de HOJE no fuso do negócio. Em UTC, um pedido feito
            // às 22h de Brasília já contaria a partir do dia seguinte.
            $order->items()->create($item + [
                'deadline_days' => $dias,
                'unit_price'    => $precos[$item['product_id']] ?? null,
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

        // Aviso por e-mail aos atendentes da empresa. Falha de e-mail nunca
        // pode derrubar a criação da OS — só registra no log.
        try {
            $atendentes = $company?->attendants()
                ->where('users.active', true)
                ->whereNotNull('users.email')
                ->get() ?? collect();

            foreach ($atendentes as $atendente) {
                Mail::to($atendente->email)->send(
                    new NovaOsMail($order->fresh('items'), $company->name)
                );
            }
        } catch (\Throwable $e) {
            Log::warning("Falha ao enviar e-mail de nova OS {$order->id}: {$e->getMessage()}");
        }

        return response()->json($this->formatOrder($order->load(['items', 'events'])), 201);
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $user  = $request->user();
        $order = Order::findOrFail($id);

        if (!$this->authorizeOrder($order, $request)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 403);
        }

        // Quem avança etapas é a VIXCard. A empresa cliente acompanha, cancela
        // (dentro da janela) ou solicita cancelamento — nunca move a OS.
        if (!$user->isSuperAdmin()) {
            return response()->json(['message' => 'Apenas a VIXCard pode mover a OS entre etapas.'], 403);
        }

        // Cada pedido só transita pelas etapas do PRÓPRIO fluxo (congelado na
        // criação). Cancelar/reabrir é livre para o super admin.
        $allowed   = $order->timelineStatuses();
        $allowed[] = 'cancelled';

        $request->validate([
            'status' => 'required|in:' . implode(',', $allowed),
        ]);

        $prev = $order->status;
        $order->update(['status' => $request->status]);

        $order->events()->create([
            'type'        => 'status_change',
            // Rótulo da etapa, não a chave — "Aprovação da arte" em vez de
            // "aprovacao-da-arte" no histórico
            'description' => 'Status alterado para ' . $order->statusLabel(),
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

        if (!$request->user()->podeAcao('cancelar_os')) {
            return response()->json(['message' => 'Seu papel não permite cancelar OS.'], 403);
        }

        if (in_array($order->faseAtual(), ['done', 'cancelled'])) {
            return response()->json(['message' => 'Esta OS já foi encerrada.'], 422);
        }

        // Empresa cliente cancela por conta própria só nos primeiros 15 min.
        // Depois disso o caminho é a solicitação de cancelamento.
        if (!$request->user()->isSuperAdmin() && !$order->dentroDaJanelaDeCancelamento()) {
            return response()->json([
                'message' => 'O prazo de ' . Order::CANCEL_WINDOW_MINUTES
                    . ' minutos para cancelar direto já passou. Solicite o cancelamento à VIXCard.',
            ], 422);
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

    /**
     * Empresa cliente pede o cancelamento depois da janela de 15 min. Fica
     * pendente até a VIXCard aprovar ou rejeitar (CancellationRequestController).
     */
    public function requestCancel(Request $request, string $id): JsonResponse
    {
        $request->validate(['reason' => 'required|string|min:5|max:1000']);

        $order = Order::findOrFail($id);

        if (!$this->authorizeOrder($order, $request)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 403);
        }

        if (!$request->user()->podeAcao('cancelar_os')) {
            return response()->json(['message' => 'Seu papel não permite cancelar OS.'], 403);
        }

        if (in_array($order->faseAtual(), ['done', 'cancelled'])) {
            return response()->json(['message' => 'Esta OS já foi encerrada.'], 422);
        }

        if ($order->cancellationRequests()->where('status', 'pending')->exists()) {
            return response()->json(['message' => 'Já existe uma solicitação de cancelamento aguardando resposta.'], 422);
        }

        $user = $request->user();

        $pedido = $order->cancellationRequests()->create([
            'tenant_slug'     => $order->tenant_slug,
            'requested_by_id' => $user->id,
            'requested_by'    => $user->name,
            'reason'          => $request->reason,
            'status'          => 'pending',
        ]);

        $order->events()->create([
            'type'        => 'note',
            'description' => "Cancelamento solicitado por {$user->name}: {$request->reason}",
            'author_name' => $user->name,
        ]);

        AuditLog::record(
            'pedido_cancelamento_solicitado', 'Pedido', $order->id, $order->title,
            $user, "Motivo: {$request->reason}"
        );

        return response()->json($this->formatOrder($order->fresh(['items', 'notes', 'events', 'cancellationRequests'])), 201);
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
        // Lista permissiva: imagens, documentos office, planilhas, texto, arte, compactados,
        // video curto e formatos de e-mail/log. Executaveis (exe, bat, sh, etc) ficam de fora.
        $allowedExtensions = implode(',', [
            // Imagens
            'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'ico',
            // PDFs e documentos
            'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md',
            // Planilhas
            'xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'tsv', 'ods', 'numbers',
            // Apresentacoes
            'ppt', 'pptx', 'odp', 'key',
            // Arte e design
            'ai', 'eps', 'cdr', 'psd', 'indd', 'sketch', 'fig', 'xd',
            // Compactados
            'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
            // Video curto
            'mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi',
            // E-mail e logs
            'eml', 'msg', 'log', 'xml', 'json', 'yaml', 'yml',
            // Audio
            'mp3', 'wav', 'm4a', 'ogg',
        ]);

        $request->validate([
            'file' => [
                'required',
                'file',
                'max:51200', // 50 MB
                "extensions:{$allowedExtensions}",
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

    public function updateItems(Request $request, string $id): JsonResponse
    {
        // Apenas super admin pode editar itens de pedidos ja criados.
        // Tenant comum nao deve mexer em pedidos depois que a producao iniciou.
        if (!$request->user()->isSuperAdmin()) {
            return response()->json(['message' => 'Apenas super admin pode editar itens do pedido.'], 403);
        }

        $request->validate([
            'items'                       => 'required|array|min:1',
            'items.*.product_id'          => 'required|exists:products,id',
            'items.*.product_name'        => 'required|string',
            'items.*.quantity'            => 'required|integer|min:1',
            'items.*.specifications'      => 'nullable|string',
            'items.*.selected_variations' => 'nullable|array',
        ]);

        $order = Order::with('items')->findOrFail($id);

        $previousCount = $order->items->count();
        $previousTotal = $order->items->sum('quantity');

        // Estrategia simples e robusta: substituir todos os items.
        // As linhas filhas usam onDelete('cascade'), entao o delete e seguro.
        $order->items()->delete();
        foreach ($request->items as $item) {
            $order->items()->create($item);
        }

        $newCount = count($request->items);
        $newTotal = collect($request->items)->sum('quantity');

        $order->events()->create([
            'type'        => 'note',
            'description' => "Itens do pedido editados por {$request->user()->name} "
                . "(antes: {$previousCount} item(s)/{$previousTotal} un. — "
                . "agora: {$newCount} item(s)/{$newTotal} un.)",
            'author_name' => $request->user()->name,
        ]);

        AuditLog::record(
            'pedido_itens_editados', 'Pedido', $order->id, $order->title,
            $request->user(),
            "De {$previousCount} item(s)/{$previousTotal} un. para {$newCount} item(s)/{$newTotal} un."
        );

        return response()->json($this->formatOrder($order->fresh(['items', 'notes', 'events'])));
    }

    /**
     * "Excluir" é arquivar: a OS some das listagens mas fica no banco com
     * itens, eventos e arquivos, e pode ser restaurada. Exclusão física não
     * existe mais pela API — um clique errado não apaga histórico.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if (!$request->user()->isSuperAdmin()) {
            return response()->json(['message' => 'Apenas super admin pode arquivar pedidos.'], 403);
        }

        $order = Order::findOrFail($id);
        $order->delete();   // soft delete

        AuditLog::record(
            'pedido_arquivado', 'Pedido', $order->id, $order->title,
            $request->user(), "Tenant: {$order->tenant_slug}"
        );

        return response()->json(null, 204);
    }

    public function restore(Request $request, string $id): JsonResponse
    {
        if (!$request->user()->isSuperAdmin()) {
            return response()->json(['message' => 'Apenas super admin pode restaurar pedidos.'], 403);
        }

        $order = Order::onlyTrashed()->findOrFail($id);
        $order->restore();

        AuditLog::record(
            'pedido_restaurado', 'Pedido', $order->id, $order->title, $request->user()
        );

        return response()->json($this->formatOrder($order->fresh(['items', 'notes', 'events', 'company', 'cancellationRequests'])));
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
        // Fase e rótulo resolvidos aqui para a tela não precisar reimplementar
        // a resolução chave -> etapa em todo lugar que exibe status
        $fase = $order->faseAtual();

        return [
            'id'           => $order->id,
            'tenantSlug'   => $order->tenant_slug,
            'tenantName'   => $order->company?->name ?? $order->tenant_slug,
            'title'        => $order->title,
            'status'       => $order->status,
            'statusFase'   => $fase,
            'statusLabel'  => $order->statusLabel(),
            // Fluxo congelado na criação, já normalizado {key,label,fase};
            // null = padrão (a tela resolve)
            'timeline'     => $order->timeline ? $order->timelineSteps() : null,
            'deadline'     => $order->deadline?->format('Y-m-d'),
            'isOverdue'    => $order->isOverdue(),
            'overdueDays'  => $order->overdue_days,
            'cancelReason' => $order->cancel_reason,
            // Solicitação de cancelamento mais recente (pendente ou decidida)
            'cancelRequest' => $order->cancellationRequests->first()?->toPayload(),
            // A empresa cliente ainda pode cancelar direto? (janela de 15 min)
            'canCancelDirectly' => $order->dentroDaJanelaDeCancelamento()
                && !in_array($fase, ['done', 'cancelled']),
            'requestedBy'  => $order->requested_by,
            'assignedTo'   => $order->assigned_to,
            'items'        => $order->items->map(fn($i) => [
                'id'                 => $i->id,
                'product_id'         => $i->product_id,
                'product_name'       => $i->product_name,
                'quantity'           => $i->quantity,
                'specifications'     => $i->specifications,
                'selected_variations' => $i->selected_variations,
                // Preço praticado, congelado na criação
                'unitPrice'          => $i->unit_price !== null ? (float) $i->unit_price : null,
                'lineTotal'          => $i->lineTotal(),
                // Prazo do item — a tela exibe estes valores, nunca recalcula.
                // Passa a FASE: etapa final personalizada também encerra atraso
                'deadline'           => $i->deadline?->format('Y-m-d'),
                'deadlineDays'       => $i->deadline_days,
                'isOverdue'          => $i->isOverdue($fase),
                'overdueDays'        => $i->overdueDays($fase),
            ]),
            'notes'        => $order->notes,
            'events'       => $order->events,
            'files'        => $order->files ?? [],
            'createdAt'    => $order->created_at,
            'updatedAt'    => $order->updated_at,
            'archivedAt'   => $order->deleted_at,
        ];
    }
}
