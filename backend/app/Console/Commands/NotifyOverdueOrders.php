<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\Order;
use App\Models\User;
use App\Services\WhatsAppService;
use Illuminate\Console\Command;

class NotifyOverdueOrders extends Command
{
    protected $signature   = 'orders:notify-overdue';
    protected $description = 'Envia WhatsApp para clientes com ordens de serviço em atraso';

    public function __construct(private WhatsAppService $whatsApp)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $overdueOrders = Order::with('company')
            ->whereNotIn('status', ['done', 'cancelled'])
            ->whereNotNull('deadline')
            ->where('deadline', '<', now()->toDateString())
            ->get();

        if ($overdueOrders->isEmpty()) {
            $this->info('Nenhuma OS em atraso.');
            return self::SUCCESS;
        }

        $this->info("Processando {$overdueOrders->count()} OS(s) em atraso...");

        foreach ($overdueOrders as $order) {
            $overdueDays = now()->diffInDays($order->deadline);

            // Notifica admins/tenants da empresa
            $admins = User::where('tenant_slug', $order->tenant_slug)
                ->whereIn('role', ['tenant_admin'])
                ->whereNotNull('whatsapp')
                ->where('active', true)
                ->get();

            foreach ($admins as $admin) {
                $sent = $this->whatsApp->sendOverdueAlert(
                    $admin->whatsapp,
                    $admin->name,
                    $order->id,
                    $order->title,
                    $overdueDays
                );

                $this->line("  → {$order->id} → {$admin->name}: " . ($sent ? 'OK' : 'FALHA'));

                AuditLog::record(
                    'whatsapp_overdue_alert', 'Pedido', $order->id, $order->title,
                    $admin, $sent ? "Enviado para {$admin->whatsapp}" : 'Falha no envio'
                );
            }
        }

        return self::SUCCESS;
    }
}
