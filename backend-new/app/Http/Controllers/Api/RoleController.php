<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoleController extends Controller
{
    /**
     * Menus que um papel pode liberar ou esconder. O papel so RESTRINGE por
     * cima do nivel de acesso — um Operador com "logs" marcado continua sem
     * ver logs, porque a rota exige super_admin. A lista existe para validar
     * o que chega da tela.
     */
    public const MENUS = [
        'dashboard', 'pedidos', 'kanban', 'relatorios', 'movimentacoes',
        'cadastros.empresas', 'cadastros.produtos', 'cadastros.categorias',
        'cadastros.usuarios', 'cadastros.setores', 'cadastros.papeis',
        'logs',
    ];

    private function denyIfNotSuperAdmin(Request $request): ?JsonResponse
    {
        if (!$request->user()->isSuperAdmin()) {
            return response()->json(
                ['message' => 'Apenas o super admin pode gerenciar papéis.'],
                403
            );
        }
        return null;
    }

    public function index(Request $request): JsonResponse
    {
        $query = Role::withCount('users');

        if (!$request->boolean('all')) {
            $query->where('active', true);
        }

        // Tenant admin monta usuarios do proprio tenant: só ve papeis que ele
        // pode atribuir (nunca os de nivel super_admin)
        if (!$request->user()->isSuperAdmin()) {
            $query->where('base_role', '!=', 'super_admin');
        }

        return response()->json(
            $query->orderBy('name')->get()->map(fn($r) => $this->format($r))
        );
    }

    public function store(Request $request): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $request->validate([
            'name'      => 'required|string|max:100|unique:roles,name',
            'base_role' => 'required|in:super_admin,tenant_admin,operator',
            'menus'     => 'nullable|array',
            'menus.*'   => 'in:' . implode(',', self::MENUS),
            'acoes'     => 'nullable|array',
            'acoes.*'   => 'in:' . implode(',', Role::ACOES),
        ]);

        $role = Role::create([
            'name'      => $request->name,
            'base_role' => $request->base_role,
            'menus'     => $request->menus,
            'acoes'     => $request->acoes,
            'active'    => true,
        ]);

        AuditLog::record(
            'papel_criado', 'Usuário', $role->id, $role->name,
            $request->user(), "Nível: {$role->base_role}"
        );

        return response()->json($this->format($role->loadCount('users')), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $role = Role::findOrFail($id);

        $request->validate([
            'name'      => "sometimes|string|max:100|unique:roles,name,{$id}",
            'base_role' => 'sometimes|in:super_admin,tenant_admin,operator',
            'menus'     => 'nullable|array',
            'menus.*'   => 'in:' . implode(',', self::MENUS),
            'acoes'     => 'nullable|array',
            'acoes.*'   => 'in:' . implode(',', Role::ACOES),
        ]);

        DB::transaction(function () use ($request, $role) {
            $role->update(array_merge(
                $request->only(['name', 'base_role']),
                $request->has('menus') ? ['menus' => $request->menus] : [],
                $request->has('acoes') ? ['acoes' => $request->acoes] : []
            ));

            // users.role e quem manda na autorizacao — se o nivel do papel
            // mudou, todo usuario com esse papel acompanha na hora.
            if ($request->filled('base_role')) {
                User::where('role_id', $role->id)->update(['role' => $request->base_role]);
            }
        });

        AuditLog::record(
            'papel_atualizado', 'Usuário', $role->id, $role->name, $request->user()
        );

        return response()->json($this->format($role->fresh()->loadCount('users')));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $role = Role::withCount('users')->findOrFail($id);

        if ($role->users_count > 0) {
            return response()->json([
                'message' => "Não é possível excluir: {$role->users_count} usuário(s) têm este papel. Desative-o ou troque o papel deles antes.",
            ], 422);
        }

        $nome = $role->name;
        $role->delete();

        AuditLog::record(
            'papel_removido', 'Usuário', $id, $nome, $request->user()
        );

        return response()->json(null, 204);
    }

    public function toggleActive(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $role = Role::findOrFail($id);
        $role->update(['active' => !$role->active]);

        AuditLog::record(
            $role->active ? 'papel_ativado' : 'papel_desativado',
            'Usuário', $role->id, $role->name, $request->user()
        );

        return response()->json($this->format($role->fresh()->loadCount('users')));
    }

    private function format(Role $r): array
    {
        return [
            'id'         => (string) $r->id,
            'name'       => $r->name,
            'baseRole'   => $r->base_role,
            'menus'      => $r->menus,
            'acoes'      => $r->acoes,
            'active'     => (bool) $r->active,
            'usersCount' => $r->users_count ?? 0,
        ];
    }
}
