<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::query()->orderBy('created_at', 'desc');

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('entity_name', 'like', "%{$request->search}%")
                  ->orWhere('user_name', 'like', "%{$request->search}%")
                  ->orWhere('action', 'like', "%{$request->search}%")
                  ->orWhere('details', 'like', "%{$request->search}%");
            });
        }

        if ($request->entity_type) {
            $query->where('entity_type', $request->entity_type);
        }

        if ($request->action) {
            $query->where('action', $request->action);
        }

        if ($request->tenant_slug) {
            $query->where('tenant_slug', $request->tenant_slug);
        }

        if ($request->date_from) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->date_to) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $perPage = min((int) ($request->per_page ?? 50), 200);
        $logs    = $query->paginate($perPage);

        return response()->json($logs);
    }
}
