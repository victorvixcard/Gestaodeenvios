<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user  = $request->user();
        $isSA  = $user->isSuperAdmin();
        $slug  = $user->tenant_slug;

        $orderQuery = Order::query();
        if (!$isSA) $orderQuery->where('tenant_slug', $slug);

        $orders     = $orderQuery->get();
        $now        = Carbon::now();
        $thisMonth  = Carbon::now()->startOfMonth();

        $overdue = $orders->filter(fn($o) =>
            !in_array($o->status, ['done', 'cancelled']) &&
            $o->deadline &&
            Carbon::parse($o->deadline)->lt($now)
        );

        $stats = [
            'totalOrders'      => $orders->count(),
            'pendingOrders'    => $orders->where('status', 'pending')->count(),
            'inProgressOrders' => $orders->whereIn('status', ['started', 'production', 'finishing'])->count(),
            'completedOrders'  => $orders->where('status', 'done')->count(),
            'overdueOrders'    => $overdue->count(),
            'cancelledOrders'  => $orders->where('status', 'cancelled')->count(),
            'ordersThisMonth'  => $orders->filter(
                fn($o) => Carbon::parse($o->created_at)->gte($thisMonth)
            )->count(),
        ];

        if ($isSA) {
            $stats['totalCompanies']  = Company::count();
            $stats['activeCompanies'] = Company::where('active', true)->count();
            $stats['totalProducts']   = Product::count();
            $stats['totalUsers']      = User::count();
        }

        $recentOrders = $orderQuery->clone()
            ->with(['items', 'company'])
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(fn($o) => [
                'id'         => $o->id,
                'title'      => $o->title,
                'status'     => $o->status,
                'deadline'   => $o->deadline?->format('Y-m-d'),
                'isOverdue'  => $o->isOverdue(),
                'tenantName' => $o->company?->name ?? $o->tenant_slug,
                'createdAt'  => $o->created_at,
            ]);

        return response()->json(compact('stats', 'recentOrders'));
    }
}
