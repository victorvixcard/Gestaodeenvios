<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nova ordem de serviço</title>
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
              <p style="margin:0 0 6px; font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:1px;">
                Pedido novo
              </p>
              <h1 style="margin:0 0 16px; font-size:20px; color:#111827;">
                OS {{ $order->id }} — {{ $companyName }}
              </h1>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                     style="background:#f9fafb; border:1px solid #eceef1; border-radius:8px; margin-bottom:20px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0 0 4px; font-size:14px; color:#111827; font-weight:bold;">
                      {{ $order->title }}
                    </p>
                    <p style="margin:0; font-size:13px; color:#6b7280;">
                      {{ $order->items->count() }} {{ $order->items->count() === 1 ? 'item' : 'itens' }}
                      · solicitado por {{ $order->requested_by }}
                      @if ($order->deadline)
                        · prazo {{ $order->deadline->format('d/m/Y') }}
                      @endif
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#1C508A; border-radius:8px;">
                    <a href="{{ $link }}"
                       style="display:inline-block; padding:12px 26px; color:#ffffff; font-size:14px; font-weight:bold; text-decoration:none;">
                      Visualizar o pedido
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0; font-size:12px; color:#9ca3af;">
                Você recebeu este aviso porque atende a {{ $companyName }} no Gestão de Envios.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
