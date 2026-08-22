<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Aviso de OS nova para os atendentes da empresa. Enviado de forma
 * sincrona no OrderController@store (a fila database nao tem worker
 * rodando; se um dia tiver, basta implementar ShouldQueue aqui).
 */
class NovaOsMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Order $order,
        public string $companyName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "OS {$this->order->id} — {$this->companyName}: pedido novo",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.nova-os',
            with: [
                'order'       => $this->order,
                'companyName' => $this->companyName,
                // Link direto para a OS na visao da VIXCard (quem atende)
                'link'        => rtrim(config('app.frontend_url'), '/')
                    . "/vixcard/pedidos/{$this->order->id}",
            ],
        );
    }
}
