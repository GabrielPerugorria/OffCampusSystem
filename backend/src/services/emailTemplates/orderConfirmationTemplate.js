'use strict';
const { renderBaseLayout, escapeHtml } = require('./baseTemplate');

function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateVal) {
  if (!dateVal) return 'A definir';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateVal);
  }
}

/**
 * Template de e-mail de Confirmação de Compra de Ingressos
 */
function renderOrderConfirmationTemplate({
  buyerName,
  orderId,
  eventName,
  eventDate,
  venue,
  totalAmount,
  paymentMethod,
  items = [],
  tickets = [],
  accountUrl,
}) {
  const safeBuyerName = escapeHtml(buyerName || 'Participante');
  const safeOrderId = escapeHtml(String(orderId));
  const safeEventName = escapeHtml(eventName || 'Evento');
  const safeVenue = escapeHtml(venue || 'Local a confirmar');
  const safeDate = escapeHtml(formatDate(eventDate));
  const safeTotal = escapeHtml(formatCurrency(totalAmount));
  const safeMethod = escapeHtml(paymentMethod === 'free' ? 'Gratuito' : (paymentMethod || 'Confirmado').toUpperCase());
  const safeAccountUrl = escapeHtml(accountUrl || '');

  const title = `Confirmação do Pedido #${safeOrderId} — ${safeEventName}`;
  const previewText = `Seu pedido #${safeOrderId} para ${safeEventName} foi confirmado com sucesso! Seus ingressos estão prontos.`;

  // Renderiza tabela dos itens do pedido
  const itemsRowsHtml = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #1a2234;font-size:14px;color:#cbd5e1;">
        ${escapeHtml(item.batch_name || item.batchName || 'Ingresso')}
      </td>
      <td align="center" style="padding:10px 0;border-bottom:1px solid #1a2234;font-size:14px;color:#94a3b8;">
        ${escapeHtml(String(item.quantity || 1))}x
      </td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid #1a2234;font-size:14px;color:#ffffff;font-weight:600;">
        ${escapeHtml(formatCurrency((item.unit_price || item.unitPrice || 0) * (item.quantity || 1)))}
      </td>
    </tr>
  `).join('');

  // Renderiza lista dos ingressos emitidos
  const ticketsCardsHtml = tickets.map((t, idx) => `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#141c2e;border:1px solid #1e293b;border-left:4px solid #10b981;border-radius:8px;margin-bottom:12px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">
                  INGRESSO #${idx + 1} &bull; ${escapeHtml(t.batch_name || t.batchName || 'Lote Padrão')}
                </div>
                <div style="font-size:15px;font-weight:700;color:#ffffff;margin-top:2px;">
                  ${escapeHtml(t.holder_name || t.holderName || buyerName)}
                </div>
              </td>
              <td align="right">
                <span style="display:inline-block;padding:6px 14px;background-color:#0a0e18;border:1px dashed #10b981;border-radius:6px;font-family:Courier,monospace;font-size:15px;font-weight:800;color:#10b981;letter-spacing:1px;">
                  ${escapeHtml(t.code)}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `).join('');

  const contentHtml = `
    <!-- Badge de Status -->
    <div style="margin-bottom:14px;">
      <span style="display:inline-block;padding:5px 12px;background-color:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:20px;font-size:12px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:0.5px;">
        &check; Pagamento Confirmado
      </span>
    </div>

    <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.4px;">
      Tudo pronto para o evento!
    </h1>
    <p style="margin:0 0 24px 0;font-size:15px;color:#cbd5e1;line-height:1.5;">
      Olá, <strong style="color:#ffffff;">${safeBuyerName}</strong>. Seu pedido <strong style="color:#ffffff;">#${safeOrderId}</strong> foi processado e aprovado com sucesso.
    </p>

    <!-- Cartão com Dados do Evento -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#131a29;border:1px solid #202b3c;border-radius:10px;margin-bottom:28px;">
      <tr>
        <td style="padding:22px 24px;">
          <div style="font-size:12px;font-weight:600;color:#10b981;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">
            Evento Confirmado
          </div>
          <div style="font-size:19px;font-weight:800;color:#ffffff;margin-bottom:12px;">
            ${safeEventName}
          </div>

          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding-top:4px;font-size:13px;color:#94a3b8;line-height:1.6;">
                <strong style="color:#e2e8f0;">Data e Horário:</strong> ${safeDate}<br>
                <strong style="color:#e2e8f0;">Local:</strong> ${safeVenue}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Ingressos Emitidos -->
    <div style="margin-bottom:14px;font-size:14px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">
      Seus Ingressos Emitidos (${tickets.length}):
    </div>

    ${ticketsCardsHtml || `
      <div style="padding:16px;background-color:#141c2e;border:1px solid #1e293b;border-radius:8px;font-size:14px;color:#94a3b8;margin-bottom:20px;">
        Seus ingressos estão disponíveis diretamente na sua Área do Participante.
      </div>
    `}

    <p style="margin:14px 0 24px 0;font-size:12px;color:#64748b;line-height:1.5;">
      * Apresente o código alfanumérico do ingresso ou o QR Code diretamente no seu celular na portaria do evento.
    </p>

    <!-- Resumo Financeiro do Pedido -->
    <div style="margin-bottom:10px;font-size:14px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;">
      Resumo do Pedido:
    </div>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <thead>
        <tr>
          <th align="left" style="padding-bottom:8px;border-bottom:1px solid #202b3c;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Item</th>
          <th align="center" style="padding-bottom:8px;border-bottom:1px solid #202b3c;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Qtd</th>
          <th align="right" style="padding-bottom:8px;border-bottom:1px solid #202b3c;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
        <tr>
          <td colspan="2" style="padding-top:14px;font-size:15px;font-weight:700;color:#ffffff;">
            Total Pago (${safeMethod})
          </td>
          <td align="right" style="padding-top:14px;font-size:18px;font-weight:800;color:#10b981;">
            ${safeTotal}
          </td>
        </tr>
      </tbody>
    </table>

    ${safeAccountUrl ? `
      <!-- Botão para Área do Participante -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto 20px auto;">
        <tr>
          <td align="center" style="border-radius:6px;background-color:#10b981;">
            <a href="${safeAccountUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#041a11;text-decoration:none;border-radius:6px;letter-spacing:0.2px;">
              Visualizar Meus Ingressos &rarr;
            </a>
          </td>
        </tr>
      </table>
    ` : ''}
  `;

  const ticketsText = tickets.map((t, i) => 
    `  Ingresso #${i + 1} (${t.batch_name || t.batchName || 'Lote'}): CÓDIGO [ ${t.code} ] - Titular: ${t.holder_name || t.holderName || buyerName}`
  ).join('\n');

  const contentText = `Olá, ${buyerName}!

Seu pedido #${orderId} foi confirmado e pago com sucesso!

DADOS DO EVENTO:
- Evento: ${eventName}
- Data/Horário: ${formatDate(eventDate)}
- Local: ${venue || 'A confirmar'}

SEUS INGRESSOS:
${ticketsText || 'Acesse a área do participante para ver seus ingressos.'}

RESUMO FINANCEIRO:
- Valor Total: ${formatCurrency(totalAmount)}
- Forma de Pagamento: ${safeMethod}
- Situação: Confirmado / Pago

Apresente o código do seu ingresso na portaria do evento.
${accountUrl ? `Acesse seus ingressos online: ${accountUrl}` : ''}

Bom evento!
Equipe EvoTech Events`;

  return renderBaseLayout({ title, previewText, contentHtml, contentText });
}

module.exports = renderOrderConfirmationTemplate;
