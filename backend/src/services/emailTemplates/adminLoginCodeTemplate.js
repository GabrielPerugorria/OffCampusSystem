'use strict';
const { renderBaseLayout } = require('./baseTemplate');

/**
 * Escapa HTML para prevenir injeção
 */
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
 * Template de código de verificação em 2 etapas para login administrativo
 */
function renderAdminLoginCodeTemplate({ name, code, expiresMinutes = 10, ipAddress = null }) {
  const safeName = escapeHtml(name || 'Administrador');
  const safeCode = escapeHtml(code || '------');
  const safeIp = ipAddress ? escapeHtml(ipAddress) : null;

  const contentHtml = `
    <div style="margin-bottom:24px;">
      <span style="display:inline-block;padding:4px 10px;background-color:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:20px;font-size:11px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:0.8px;">
        Autenticação de Segurança (2FA)
      </span>
      <h1 style="margin:16px 0 8px 0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
        Código de Acesso Administrativo
      </h1>
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">
        Olá, <strong>${safeName}</strong>. Uma tentativa de login administrativo foi iniciada para a sua conta no EvoTech Events.
      </p>
    </div>

    <!-- Caixa de Destaque com o Código OTP -->
    <div style="margin:30px 0;padding:24px;background-color:#131c2e;border:1px solid #1e293b;border-radius:10px;text-align:center;">
      <p style="margin:0 0 10px 0;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">
        Seu Código de Verificação
      </p>
      <div style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:8px;color:#10b981;padding:8px 0;">
        ${safeCode}
      </div>
      <p style="margin:10px 0 0 0;font-size:12px;color:#64748b;">
        Válido por <strong>${expiresMinutes} minutos</strong> &bull; Uso único e intransferível
      </p>
    </div>

    <!-- Alerta de Segurança -->
    <div style="margin:24px 0 10px 0;padding:16px;background-color:rgba(239,68,68,0.08);border-left:4px solid #ef4444;border-radius:4px;">
      <p style="margin:0;font-size:13px;color:#fca5a5;line-height:1.5;">
        <strong>Atenção:</strong> Este código concede acesso aos controles administrativos, financeiros e operacionais. 
        A equipe do EvoTech Events nunca solicita seu código por telefone ou mensagem.
      </p>
      ${safeIp ? `<p style="margin:8px 0 0 0;font-size:11px;color:#94a3b8;">Origem da solicitação: IP ${safeIp}</p>` : ''}
    </div>

    <p style="margin:24px 0 0 0;font-size:12px;color:#64748b;line-height:1.5;">
      Se você não tentou fazer login no painel administrativo, sua senha pode estar comprometida. 
      Recomendamos redefinir sua senha imediatamente e avisar o responsável pelo evento.
    </p>
  `;

  const contentText = `
CÓDIGO DE VERIFICAÇÃO DE ACESSO ADMINISTRATIVO

Olá, ${name || 'Administrador'},

Uma tentativa de login administrativo foi iniciada para a sua conta no EvoTech Events.

SEU CÓDIGO DE VERIFICAÇÃO:
${code}

Este código é válido por ${expiresMinutes} minutos e expira após o uso.

ATENÇÃO: Nunca compartilhe este código. Ele concede acesso total ao painel administrativo.
${ipAddress ? `Origem da solicitação: IP ${ipAddress}\n` : ''}
Se você não solicitou este acesso, altere sua senha imediatamente.
  `;

  return renderBaseLayout({
    title: 'Código de Acesso Administrativo — EvoTech Events',
    previewText: `Seu código de verificação é ${code}. Válido por ${expiresMinutes} minutos.`,
    contentHtml,
    contentText,
  });
}

module.exports = renderAdminLoginCodeTemplate;
