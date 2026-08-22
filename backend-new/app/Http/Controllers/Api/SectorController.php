<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Sector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SectorController extends Controller
{
    /**
     * Setores organizam a equipe interna da VIXCard, então quem cria e edita
     * é o super admin. Listar é liberado porque o cadastro de usuário precisa
     * das opções.
     */
    private function denyIfNotSuperAdmin(Request $request): ?JsonResponse
    {
        if (!$request->user()->isSuperAdmin()) {
            return response()->json(
                ['message' => 'Apenas o super admin pode gerenciar setores.'],
                403
            );
        }
        return null;
    }

    public function index(Request $request): JsonResponse
    {
        $query = Sector::withCount('users');

        if (!$request->boolean('all')) {
            $query->where('active', true);
        }

        return response()->json(
            $query->orderBy('name')->get()->map(fn($s) => $this->format($s))
        );
    }

    public function store(Request $request): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $request->validate([
            'name' => 'required|string|max:100|unique:sectors,name',
        ]);

        $sector = Sector::create(['name' => $request->name, 'active' => true]);

        AuditLog::record(
            'setor_criado', 'Usuário', $sector->id, $sector->name, $request->user()
        );

        return response()->json($this->format($sector->loadCount('users')), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $sector = Sector::findOrFail($id);

        $request->validate([
            'name' => "sometimes|string|max:100|unique:sectors,name,{$id}",
        ]);

        if ($request->filled('name')) {
            $sector->update(['name' => $request->name]);
        }

        AuditLog::record(
            'setor_atualizado', 'Usuário', $sector->id, $sector->name, $request->user()
        );

        return response()->json($this->format($sector->fresh()->loadCount('users')));
    }

    /**
     * Excluir é bloqueado enquanto houver usuário vinculado — o caminho
     * nesse caso é desativar, mesma regra das categorias de produto.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $sector = Sector::withCount('users')->findOrFail($id);

        if ($sector->users_count > 0) {
            return response()->json([
                'message' => "Não é possível excluir: {$sector->users_count} usuário(s) estão neste setor. Desative-o em vez de excluir.",
            ], 422);
        }

        $nome = $sector->name;
        $sector->delete();

        AuditLog::record(
            'setor_removido', 'Usuário', $id, $nome, $request->user()
        );

        return response()->json(null, 204);
    }

    public function toggleActive(Request $request, string $id): JsonResponse
    {
        if ($deny = $this->denyIfNotSuperAdmin($request)) return $deny;

        $sector = Sector::findOrFail($id);
        $sector->update(['active' => !$sector->active]);

        AuditLog::record(
            $sector->active ? 'setor_ativado' : 'setor_desativado',
            'Usuário', $sector->id, $sector->name, $request->user()
        );

        return response()->json($this->format($sector->fresh()->loadCount('users')));
    }

    private function format(Sector $s): array
    {
        return [
            'id'         => (string) $s->id,
            'name'       => $s->name,
            'active'     => (bool) $s->active,
            'usersCount' => $s->users_count ?? 0,
        ];
    }
}
