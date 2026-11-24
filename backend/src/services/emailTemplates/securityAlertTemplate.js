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
 * Template genérico para notificações de segurança e atividade da conta.
 * NUNCA inclui senhas, códigos OTP ou tokens.
 */
function renderSecurityAlertTemplate({
  name,
  badge = 'Alerta de Segurança',
  severity = 'info', // 'info' | 'warning' | 'critical'
  heading,
  message,
  details = [],
  recommendation = 'Se você reconhece esta atividade, nenhuma ação é necessária. Caso contrário, altere sua senha imediatamente e revogue suas sessões ativas.',
}) {
  const safeName = escapeHtml(name || 'Usuário');
  const safeBadge = escapeHtml(badge);
  const safeHeading = escapeHtml(heading);
  const safeMessage = escapeHtml(message);
  const safeRec = escapeHtml(recommendation);

  const palette = {
    info: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', color: '#10b981' },
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', color: '#f59e0b' },
    critical: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', color: '#ef4444' },
  }[severity] || { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', color: '#10b981' };

  const detailsHtml = Array.isArray(details) && details.length > 0
    ? `<div style="margin:22px 0;padding:16px 20px;background-color:#131c2e;border:1px solid #1e293b;border-radius:10px;">
        ${details.map(d => `
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;">
            <span style="color:#94a3b8;">${escapeHtml(d.label)}:</span>
            <strong style="color:#f1f5f9;">${escapeHtml(d.value)}</strong>
          </div>
        `).join('')}
      </div>`
    : '';

  const detailsText = Array.isArray(details) && details.length > 0
    ? '\nDetalhes:\n' + details.map(d => `- ${d.label}: ${d.value}`).join('\n') + '\n'
    : '';

  const contentHtml = `
    <div style="margin-bottom:24px;">
      <span style="display:inline-block;padding:4px 10px;background-color:${palette.bg};border:1px solid ${palette.border};border-radius:20px;font-size:11px;font-weight:700;color:${palette.color};text-transform:uppercase;letter-spacing:0.8px;">
        ${safeBadge}
      </span>
      <h1 style="margin:16px 0 8px 0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
        ${safeHeading}
      </h1>
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">
        Olá, <strong>${safeName}</strong>. ${safeMessage}
      </p>
    </div>

    ${detailsHtml}

    <div style="margin:24px 0 0 0;padding:16px;background-color:rgba(255,255,255,0.02);border-left:4px solid ${palette.color};border-radius:4px;">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
        ${safeRec}
      </p>
    </div>
  `;

  const contentText = `
${String(badge).toUpperCase()} — EVOTECH EVENTS

Olá, ${name || 'Usuário'},

${heading}
${message}
${detailsText}
${recommendation}
  `;

  return renderBaseLayout({
    title: `${heading} — EvoTech Events`,
    previewText: message,
    contentHtml,
    contentText,
  });
}

module.exports = renderSecurityAlertTemplate;
