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
 * Template de código de verificação em 2 etapas para login de participante
 */
function renderLoginCodeTemplate({ name, code, expiresMinutes = 10, ipAddress = null, userAgent = null }) {
  const safeName = escapeHtml(name || 'Participante');
  const safeCode = escapeHtml(code || '------');
  const safeIp = ipAddress ? escapeHtml(ipAddress) : null;
  const safeUa = userAgent ? escapeHtml(String(userAgent).slice(0, 120)) : null;

  const contentHtml = `
    <div style="margin-bottom:24px;">
      <span style="display:inline-block;padding:4px 10px;background-color:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:20px;font-size:11px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:0.8px;">
        Verificação de Login
      </span>
      <h1 style="margin:16px 0 8px 0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
        Código de Segurança para Entrar
      </h1>
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">
        Olá, <strong>${safeName}</strong>. Recebemos uma solicitação de acesso à sua conta no EvoTech Events. Informe o código abaixo para concluir o login:
      </p>
    </div>

    <div style="margin:30px 0;padding:24px;background-color:#131c2e;border:1px solid #1e293b;border-radius:10px;text-align:center;">
      <p style="margin:0 0 10px 0;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">
        Seu Código de Acesso
      </p>
      <div style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:8px;color:#10b981;padding:8px 0;">
        ${safeCode}
      </div>
      <p style="margin:10px 0 0 0;font-size:12px;color:#64748b;">
        Válido por <strong>${expiresMinutes} minutos</strong> &bull; Uso único e intransferível
      </p>
    </div>

    ${safeIp || safeUa ? `
    <div style="margin:20px 0 10px 0;padding:14px 16px;background-color:rgba(255,255,255,0.03);border:1px solid #1e293b;border-radius:8px;">
      <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#cbd5e1;">Detalhes da solicitação:</p>
      ${safeIp ? `<p style="margin:2px 0;font-size:11px;color:#94a3b8;">Endereço IP: ${safeIp}</p>` : ''}
      ${safeUa ? `<p style="margin:2px 0;font-size:11px;color:#94a3b8;">Dispositivo: ${safeUa}</p>` : ''}
    </div>` : ''}

    <p style="margin:24px 0 0 0;font-size:12px;color:#64748b;line-height:1.5;">
      Nunca compartilhe este código com terceiros. Se não foi você quem tentou entrar, altere sua senha imediatamente.
    </p>
  `;

  const contentText = `
CÓDIGO DE VERIFICAÇÃO DE LOGIN — EVOTECH EVENTS

Olá, ${name || 'Participante'},

Recebemos uma solicitação de login para sua conta.

SEU CÓDIGO DE ACESSO:
${code}

Válido por ${expiresMinutes} minutos (uso único).
${ipAddress ? `IP: ${ipAddress}\n` : ''}${userAgent ? `Dispositivo: ${String(userAgent).slice(0, 120)}\n` : ''}
Se não foi você, redefina sua senha imediatamente.
  `;

  return renderBaseLayout({
    title: 'Código de Login — EvoTech Events',
    previewText: `Código de verificação de login válido por ${expiresMinutes} minutos.`,
    contentHtml,
    contentText,
  });
}

module.exports = renderLoginCodeTemplate;
