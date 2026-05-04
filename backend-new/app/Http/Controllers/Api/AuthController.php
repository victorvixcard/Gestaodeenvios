<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'       => 'required|email',
            'password'    => 'required',
            'tenant_slug' => 'nullable|string',
        ]);

        if ($request->filled('tenant_slug')) {
            // Login direto com tenant conhecido (URLs como /medsenior/login)
            $user = User::where('email', $request->email)
                        ->where('tenant_slug', $request->tenant_slug)
                        ->where('active', true)
                        ->first();

            if (!$user || !Hash::check($request->password, $user->password)) {
                return response()->json(['message' => 'Credenciais inválidas.'], 401);
            }
        } else {
            // Login universal: busca o usuário pelo e-mail em todos os tenants
            $candidates = User::where('email', $request->email)
                              ->where('active', true)
                              ->get();

            $user = $candidates->first(fn ($u) => Hash::check($request->password, $u->password));

            if (!$user) {
                return response()->json(['message' => 'Credenciais inválidas.'], 401);
            }
        }

        $token = $user->createToken('api-token')->plainTextToken;

        AuditLog::record('login', 'Sistema', $user->tenant_slug, 'Login', $user);

        return response()->json([
            'token'       => $token,
            'user'        => $user,
            'tenant_slug' => $user->tenant_slug,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        AuditLog::record('logout', 'Sistema', $request->user()->tenant_slug, 'Logout', $request->user());
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logout realizado.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user()->load('company'));
    }
}
