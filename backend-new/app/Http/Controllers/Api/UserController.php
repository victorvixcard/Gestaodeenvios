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

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = User::query();

        if (!$actor->isSuperAdmin()) {
            $query->where('tenant_slug', $actor->tenant_slug);
        }

        if ($request->tenant_slug) {
            $query->where('tenant_slug', $request->tenant_slug);
        }

        return response()->json($query->orderBy('name')->get()->makeHidden('password'));
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $request->user();

        $request->validate([
            'name'        => 'required|string|max:255',
            'email'       => 'required|email|unique:users,email',
            'role'        => 'required|in:super_admin,tenant_admin,operator',
            'tenant_slug' => 'required|exists:companies,slug',
            'whatsapp'    => 'nullable|string|max:20',
        ]);

        $password = Str::random(10);

        $user = User::create([
            'name'             => $request->name,
            'email'            => $request->email,
            'password'         => Hash::make($password),
            'role'             => $request->role,
            'tenant_slug'      => $request->tenant_slug,
            'avatar_initials'  => $this->initials($request->name),
            'whatsapp'         => $request->whatsapp,
            'active'           => true,
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
        $actor = $request->user();
        $user  = User::findOrFail($id);

        $request->validate([
            'name'      => 'sometimes|string|max:255',
            'email'     => "sometimes|email|unique:users,email,{$id}",
            'role'      => 'sometimes|in:super_admin,tenant_admin,operator',
            'whatsapp'  => 'nullable|string|max:20',
        ]);

        $user->update($request->only(['name', 'email', 'role', 'whatsapp']));

        if ($request->name) {
            $user->update(['avatar_initials' => $this->initials($request->name)]);
        }

        AuditLog::record(
            'usuario_atualizado', 'Usuário', $user->id, $user->name, $actor
        );

        return response()->json($user->fresh()->makeHidden('password'));
    }

    public function toggleActive(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $user->update(['active' => !$user->active]);

        $action = $user->active ? 'usuario_ativado' : 'usuario_desativado';
        AuditLog::record(
            $action, 'Usuário', $user->id, $user->name, $request->user()
        );

        return response()->json($user->fresh()->makeHidden('password'));
    }

    public function changePassword(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::findOrFail($id);
        $user->update(['password' => Hash::make($request->password)]);

        AuditLog::record(
            'usuario_senha_alterada', 'Usuário', $user->id, $user->name,
            $request->user()
        );

        return response()->json(['message' => 'Senha alterada com sucesso.']);
    }

    public function sendCredentials(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = User::findOrFail($id);

        if (!$user->whatsapp) {
            return response()->json(['message' => 'Usuário não possui WhatsApp cadastrado.'], 422);
        }

        $sent = $this->whatsApp->sendCredentials(
            $user->whatsapp,
            $user->name,
            $user->email,
            $request->password,
            $user->tenant_slug
        );

        AuditLog::record(
            'usuario_credenciais_enviadas', 'Usuário', $user->id, $user->name,
            $request->user(), $sent ? 'Enviado via WhatsApp' : 'Falha no envio'
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
