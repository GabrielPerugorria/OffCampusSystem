'use strict';
const { renderBaseLayout } = require('./baseTemplate');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Template de código de confirmação para alteração de e-mail
 */
function renderEmailChangeCodeTemplate({ name, newEmail, code, expiresMinutes = 15 }) {
  const safeName = escapeHtml(name || 'Usuário');
  const safeNewEmail = escapeHtml(newEmail || '');
  const safeCode = escapeHtml(code || '------');

  const contentHtml = `
    <div style="margin-bottom:24px;">
      <span style="display:inline-block;padding:4px 10px;background-color:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:20px;font-size:11px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.8px;">
        Alteração de E-mail
      </span>
      <h1 style="margin:16px 0 8px 0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
        Confirme seu novo endereço de e-mail
      </h1>
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">
        Olá, <strong>${safeName}</strong>. Recebemos uma solicitação para alterar o e-mail principal da sua conta para <strong>${safeNewEmail}</strong>.
      </p>
    </div>

    <div style="margin:30px 0;padding:24px;background-color:#131c2e;border:1px solid #1e293b;border-radius:10px;text-align:center;">
      <p style="margin:0 0 10px 0;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">
        Código de Confirmação
      </p>
      <div style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:8px;color:#10b981;padding:8px 0;">
        ${safeCode}
      </div>
      <p style="margin:10px 0 0 0;font-size:12px;color:#64748b;">
        Válido por <strong>${expiresMinutes} minutos</strong> &bull; Uso único
      </p>
    </div>

    <p style="margin:24px 0 0 0;font-size:12px;color:#64748b;line-height:1.5;">
      O endereço atual da conta permanecerá ativo até que este código seja confirmado. Se você não solicitou esta alteração, ignore este e-mail.
    </p>
  `;

  const contentText = `
CONFIRMAÇÃO DE ALTERAÇÃO DE E-MAIL — EVOTECH EVENTS

Olá, ${name || 'Usuário'},

Recebemos uma solicitação para definir ${newEmail} como o novo e-mail da sua conta.

SEU CÓDIGO DE CONFIRMAÇÃO:
${code}

Válido por ${expiresMinutes} minutos (uso único).

Se você não solicitou esta alteração, ignore este e-mail.
  `;

  return renderBaseLayout({
    title: 'Confirme seu novo e-mail — EvoTech Events',
    previewText: `Código para confirmar alteração de e-mail válido por ${expiresMinutes} minutos.`,
    contentHtml,
    contentText,
  });
}

module.exports = renderEmailChangeCodeTemplate;
