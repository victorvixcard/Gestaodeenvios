<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    private string $provider;
    private string $instanceId;
    private string $token;
    private string $clientToken;

    public function __construct()
    {
        $this->provider    = config('services.whatsapp.provider', 'zapi');
        $this->instanceId  = config('services.whatsapp.zapi.instance_id', '');
        $this->token       = config('services.whatsapp.zapi.token', '');
        $this->clientToken = config('services.whatsapp.zapi.client_token', '');
    }

    /**
     * Envia mensagem de texto simples.
     */
    public function sendText(string $phone, string $message): bool
    {
        $phone = preg_replace('/\D/', '', $phone);

        if (!str_starts_with($phone, '55')) {
            $phone = '55' . $phone;
        }

        try {
            return match ($this->provider) {
                'zapi'  => $this->sendViaZapi($phone, $message),
                default => false,
            };
        } catch (\Exception $e) {
            Log::error("WhatsApp send failed: {$e->getMessage()}", compact('phone'));
            return false;
        }
    }

    /**
     * Notifica cliente sobre OS atrasada.
     */
    public function sendOverdueAlert(string $phone, string $clientName, string $orderId, string $orderTitle, int $overdueDays): bool
    {
        $message = "⚠️ *Alerta VIXCard* ⚠️\n\n"
            . "Olá, {$clientName}!\n\n"
            . "A Ordem de Serviço *{$orderId}* está com o prazo de entrega em atraso.\n\n"
            . "📋 OS: {$orderTitle}\n"
            . "🔴 Atraso: *{$overdueDays} dia(s)*\n\n"
            . "Nossa equipe já foi notificada e está trabalhando para regularizar sua entrega o mais breve possível.\n\n"
            . "Pedimos desculpas pelo inconveniente. Em caso de dúvidas, entre em contato conosco.";

        return $this->sendText($phone, $message);
    }

    /**
     * Envia credenciais de acesso ao sistema.
     */
    public function sendCredentials(string $phone, string $userName, string $email, string $password, string $tenantSlug): bool
    {
        $url = config('app.frontend_url', 'https://gestaodeenvios-two.vercel.app');

        $message = "👋 Olá, {$userName}!\n\n"
            . "Seus dados de acesso ao *VIXCard Gestão de Pedidos*:\n\n"
            . "📧 E-mail: {$email}\n"
            . "🔑 Senha: {$password}\n\n"
            . "🔗 Acesso: {$url}/{$tenantSlug}/login\n\n"
            . "_Por segurança, altere sua senha no primeiro acesso._";

        return $this->sendText($phone, $message);
    }

    private function sendViaZapi(string $phone, string $message): bool
    {
        if (empty($this->instanceId) || empty($this->token)) {
            Log::warning('WhatsApp Z-API não configurado. Mensagem não enviada.');
            return false;
        }

        $response = Http::withHeaders([
            'Client-Token' => $this->clientToken,
        ])->post(
            "https://api.z-api.io/instances/{$this->instanceId}/token/{$this->token}/send-text",
            ['phone' => $phone, 'message' => $message]
        );

        return $response->successful();
    }
}
