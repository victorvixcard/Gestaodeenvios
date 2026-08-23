<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Saldo negativo</title>
</head>
<body style="margin:0; padding:0; background:#f4f5f7; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7; padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e4e6ea;">
          <tr>
            <td style="background:#1C508A; padding:20px 28px;">
              <p style="margin:0; color:#ffffff; font-size:15px; font-weight:bold;">
                Gestão de Envios
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 6px; font-size:13px; color:#b91c1c; text-transform:uppercase; letter-spacing:1px;">
                Saldo de crédito negativo
              </p>
              <h1 style="margin:0 0 16px; font-size:20px; color:#111827;">
                {{ $empresa }} — {{ $mov->product?->name }}
              </h1>

              <p style="margin:0 0 16px; font-size:14px; color:#374151; line-height:1.5;">
                A empresa consumiu além do crédito disponível neste produto.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                     style="font-size:14px; color:#374151; border-collapse:collapse;">
                <tr>
                  <td style="padding:6px 0; color:#6b7280;">Saldo antes</td>
                  <td style="padding:6px 0; text-align:right;">{{ $mov->saldo_anterior }}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; color:#6b7280;">Movimento</td>
                  <td style="padding:6px 0; text-align:right;">{{ $mov->quantidade }} ({{ $mov->tipo }})</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; color:#6b7280;">Saldo agora</td>
                  <td style="padding:6px 0; text-align:right; color:#b91c1c; font-weight:bold;">{{ $mov->saldo_posterior }}</td>
                </tr>
                @if ($mov->order_id)
                <tr>
                  <td style="padding:6px 0; color:#6b7280;">OS</td>
                  <td style="padding:6px 0; text-align:right;">{{ $mov->order_id }}</td>
                </tr>
                @endif
                <tr>
                  <td style="padding:6px 0; color:#6b7280;">Quando</td>
                  <td style="padding:6px 0; text-align:right;">{{ $mov->created_at?->timezone(config('app.business_timezone'))->format('d/m/Y H:i') }}</td>
                </tr>
              </table>

              <p style="margin:24px 0 0;">
                <a href="{{ $link }}"
                   style="display:inline-block; background:#1C508A; color:#ffffff; text-decoration:none;
                          padding:10px 18px; border-radius:8px; font-size:14px; font-weight:bold;">
                  Abrir movimentações da empresa
                </a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 28px; background:#f9fafb; font-size:12px; color:#9ca3af;">
              Aviso automático enviado uma vez a cada vez que o saldo cruza para negativo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
