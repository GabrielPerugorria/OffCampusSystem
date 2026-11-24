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
 * Template de verificação de e-mail para ativação de novo cadastro (código de 6 dígitos)
 */
function renderEmailVerificationTemplate({ name, code, expiresMinutes = 15 }) {
  const safeName = escapeHtml(name || 'Participante');
  const safeCode = escapeHtml(code || '------');

  const contentHtml = `
    <div style="margin-bottom:24px;">
      <span style="display:inline-block;padding:4px 10px;background-color:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:20px;font-size:11px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:0.8px;">
        Confirmação de Cadastro
      </span>
      <h1 style="margin:16px 0 8px 0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
        Confirme seu e-mail para ativar sua conta
      </h1>
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">
        Olá, <strong>${safeName}</strong>! Falta apenas um passo para concluir seu cadastro no EvoTech Events. Digite o código abaixo na tela de confirmação:
      </p>
    </div>

    <div style="margin:30px 0;padding:24px;background-color:#131c2e;border:1px solid #1e293b;border-radius:10px;text-align:center;">
      <p style="margin:0 0 10px 0;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">
        Código de Verificação
      </p>
      <div style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:8px;color:#10b981;padding:8px 0;">
        ${safeCode}
      </div>
      <p style="margin:10px 0 0 0;font-size:12px;color:#64748b;">
        Válido por <strong>${expiresMinutes} minutos</strong> &bull; Uso único
      </p>
    </div>

    <p style="margin:24px 0 0 0;font-size:12px;color:#64748b;line-height:1.5;">
      Se você não criou uma conta no EvoTech Events, ignore este e-mail com segurança. Nenhuma conta será ativada sem esta confirmação.
    </p>
  `;

  const contentText = `
CONFIRMAÇÃO DE CADASTRO — EVOTECH EVENTS

Olá, ${name || 'Participante'},

Para ativar sua conta no EvoTech Events, informe o código de verificação abaixo:

SEU CÓDIGO DE VERIFICAÇÃO:
${code}

Válido por ${expiresMinutes} minutos (uso único).

Se você não solicitou este cadastro, ignore este e-mail.
  `;

  return renderBaseLayout({
    title: 'Confirme seu e-mail — EvoTech Events',
    previewText: `Código de verificação de cadastro válido por ${expiresMinutes} minutos.`,
    contentHtml,
    contentText,
  });
}

module.exports = renderEmailVerificationTemplate;
