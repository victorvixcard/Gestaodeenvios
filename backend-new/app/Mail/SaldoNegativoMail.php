<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\ProductMovement;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Aviso ao responsavel da VIXCard quando o saldo de credito de um produto
 * cruza para negativo (a empresa consumiu alem do que comprou). Enviado uma
 * vez por cruzamento — nao repete a cada OS enquanto continua negativo.
 */
class SaldoNegativoMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public ProductMovement $movement) {}

    public function envelope(): Envelope
    {
        $empresa = Company::find($this->movement->tenant_slug)?->name ?? $this->movement->tenant_slug;
        return new Envelope(
            subject: "Saldo negativo — {$empresa}: {$this->movement->product?->name}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.saldo-negativo',
            with: [
                'mov'     => $this->movement,
                'empresa' => Company::find($this->movement->tenant_slug)?->name ?? $this->movement->tenant_slug,
                'link'    => rtrim(config('app.frontend_url'), '/') . "/vixcard/empresas/{$this->movement->tenant_slug}",
            ],
        );
    }
}
