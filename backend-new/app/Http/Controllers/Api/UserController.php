<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserController extends Controller
{
    public function __construct(private WhatsAppService $whatsApp) {}

    // ── Helper: garante que o ator pode agir sobre o usuário alvo ────────────
    private function authorizeUserAccess(User $actor, User $target): bool
    {
        // Super admin pode tudo
        if ($actor->isSuperAdmin()) return true;

        // Tenant admin só pode gerenciar usuários do próprio tenant
        return $actor->tenant_slug === $target->tenant_slug;
    }

    // ── Helper: roles que o ator pode atribuir ────────────────────────────────
    private function allowedRolesFor(User $actor): array
    {
        if ($actor->isSuperAdmin()) {
            return ['super_admin', 'tenant_admin', 'operator'];
        }
        // Tenant admin não pode criar super_admin
        return ['tenant_admin', 'operator'];
    }

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = User::query();

        if (!$actor->isSuperAdmin()) {
            $query->where('tenant_slug', $actor->tenant_slug);
        }

        if ($request->tenant_slug) {
            // Tenant admin só pode filtrar pelo próprio tenant
            if (!$actor->isSuperAdmin() && $request->tenant_slug !== $actor->tenant_slug) {
                return response()->json(['message' => 'Acesso não autorizado.'], 403);
            }
            $query->where('tenant_slug', $request->tenant_slug);
        }

        return response()->json($query->orderBy('name')->get()->makeHidden('password'));
    }

    public function store(Request $request): JsonResponse
    {
        $actor        = $request->user();
        $allowedRoles = $this->allowedRolesFor($actor);

        $request->validate([
            'name'          => 'required|string|max:255',
            'email'         => 'required|email|unique:users,email',
            'role'          => 'required|in:' . implode(',', $allowedRoles),
            'tenant_slug'   => 'required|exists:companies,slug',
            'password'      => 'nullable|string|min:8',
            'whatsapp'      => 'nullable|string|max:20',
            'avatar_url'    => 'nullable|string',
            'permissions'   => 'nullable|array',
            'permissions.*' => 'string',
        ]);

        // Tenant admin só pode criar usuários no próprio tenant
        if (!$actor->isSuperAdmin() && $request->tenant_slug !== $actor->tenant_slug) {
            return response()->json(['message' => 'Você não pode criar usuários em outro tenant.'], 403);
        }

        // Aceita senha definida pelo admin. Se não vier, gera uma aleatória.
        $password = $request->filled('password') ? $request->password : Str::random(10);

        $user = User::create([
            'name'            => $request->name,
            'email'           => $request->email,
            'password'        => Hash::make($password),
            'role'            => $request->role,
            'tenant_slug'     => $request->tenant_slug,
            'avatar_initials' => $this->initials($request->name),
            'avatar_url'      => $request->avatar_url,
            'whatsapp'        => $request->whatsapp,
            'permissions'     => $request->permissions ?? [],
            'active'          => true,
        ]);

        AuditLog::record(
            'usuario_criado', 'Usuário', $user->id, $user->name,
            $actor, "Role: {$user->role} | Empresa: {$user->tenant_slug}"
        );

        return response()->json(array_merge(
            $user->makeHidden('password')->toArray(),
            ['plain_password' => $password]
        ), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $actor  = $request->user();
        $target = User::findOrFail($id);

        if (!$this->authorizeUserAccess($actor, $target)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 403);
        }

        $allowedRoles = $this->allowedRolesFor($actor);

        $request->validate([
            'name'          => 'sometimes|string|max:255',
            'email'         => "sometimes|email|unique:users,email,{$id}",
            'role'          => 'sometimes|in:' . implode(',', $allowedRoles),
            'whatsapp'      => 'nullable|string|max:20',
            'avatar_url'    => 'nullable|string',
            'permissions'   => 'sometimes|array',
            'permissions.*' => 'string',
        ]);

        $target->update($request->only(['name', 'email', 'role', 'whatsapp', 'avatar_url', 'permissions']));

        if ($request->name) {
            $target->update(['avatar_initials' => $this->initials($request->name)]);
        }

        AuditLog::record(
            'usuario_atualizado', 'Usuário', $target->id, $target->name, $actor
        );

        return response()->json($target->fresh()->makeHidden('password'));
    }

    public function toggleActive(Request $request, string $id): JsonResponse
    {
        $actor  = $request->user();
        $target = User::findOrFail($id);

        if (!$this->authorizeUserAccess($actor, $target)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 403);
        }

        // Impede desativar a si mesmo
        if ($actor->id === $target->id) {
            return response()->json(['message' => 'Você não pode desativar sua própria conta.'], 422);
        }

        $target->update(['active' => !$target->active]);

        $action = $target->active ? 'usuario_ativado' : 'usuario_desativado';
        AuditLog::record(
            $action, 'Usuário', $target->id, $target->name, $actor
        );

        return response()->json($target->fresh()->makeHidden('password'));
    }

    public function changePassword(Request $request, string $id): JsonResponse
    {
        $actor  = $request->user();
        $target = User::findOrFail($id);

        if (!$this->authorizeUserAccess($actor, $target)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 403);
        }

        $request->validate([
            'password' => 'required|string|min:8|confirmed',
        ]);

        $target->update(['password' => Hash::make($request->password)]);

        // Invalida todos os tokens existentes do usuário
        $target->tokens()->delete();

        AuditLog::record(
            'usuario_senha_alterada', 'Usuário', $target->id, $target->name, $actor
        );

        return response()->json(['message' => 'Senha alterada com sucesso.']);
    }

    public function sendCredentials(Request $request, string $id): JsonResponse
    {
        $actor  = $request->user();
        $target = User::findOrFail($id);

        if (!$this->authorizeUserAccess($actor, $target)) {
            return response()->json(['message' => 'Acesso não autorizado.'], 403);
        }

        $request->validate([
            'password' => 'required|string',
        ]);

        if (!$target->whatsapp) {
            return response()->json(['message' => 'Usuário não possui WhatsApp cadastrado.'], 422);
        }

        $sent = $this->whatsApp->sendCredentials(
            $target->whatsapp,
            $target->name,
            $target->email,
            $request->password,
            $target->tenant_slug
        );

        AuditLog::record(
            'usuario_credenciais_enviadas', 'Usuário', $target->id, $target->name,
            $actor, $sent ? 'Enviado via WhatsApp' : 'Falha no envio'
        );

        return response()->json([
            'message' => $sent ? 'Credenciais enviadas via WhatsApp.' : 'Falha ao enviar WhatsApp.',
            'sent'    => $sent,
        ]);
    }

    private function initials(string $name): string
    {
        $words = explode(' ', trim($name));
        if (count($words) === 1) return strtoupper(substr($words[0], 0, 2));
        return strtoupper($words[0][0] . end($words)[0]);
    }
}
