'use strict';
const { renderBaseLayout, escapeHtml } = require('./baseTemplate');

/**
 * Template de notificação de Senha Alterada
 */
function renderPasswordChangedTemplate({ name, timestamp }) {
  const safeName = escapeHtml(name || 'Usuário');
  const dateStr = escapeHtml(new Date(timestamp || Date.now()).toLocaleString('pt-BR'));

  const title = 'Segurança: Senha Alterada — EvoTech Events';
  const previewText = `A senha da sua conta EvoTech Events foi alterada com sucesso em ${dateStr}.`;

  const contentHtml = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.3px;">
      Sua senha foi alterada
    </h1>
    <p style="margin:0 0 16px 0;font-size:15px;color:#cbd5e1;line-height:1.6;">
      Olá, <strong style="color:#ffffff;">${safeName}</strong>. Este e-mail confirma que a senha de acesso à sua conta <strong style="color:#ffffff;">EvoTech Events</strong> foi alterada em <strong style="color:#10b981;">${dateStr}</strong>.
    </p>

    <!-- Alerta de Segurança -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#141c2e;border:1px solid #1e293b;border-left:4px solid #10b981;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 18px;">
          <div style="font-size:13px;font-weight:600;color:#ffffff;margin-bottom:4px;">
            Foi você quem realizou esta alteração?
          </div>
          <div style="font-size:13px;color:#94a3b8;line-height:1.5;">
            Se você solicitou e concluiu esta alteração, nenhuma ação adicional é necessária. Suas sessões anteriores foram desconectadas por segurança.
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#ef4444;line-height:1.5;">
      <strong>ATENÇÃO:</strong> Caso você NÃO tenha realizado ou reconheça esta alteração, redefina sua senha imediatamente na tela inicial ou contate o administrador do sistema.
    </p>
  `;

  const contentText = `Olá, ${name || 'Usuário'}!

Confirmamos que a senha da sua conta no EvoTech Events foi alterada com sucesso em ${new Date(timestamp || Date.now()).toLocaleString('pt-BR')}.

Se foi você quem fez a alteração, nenhuma ação é necessária. Todas as sessões anteriores foram encerradas por segurança.

IMPORTANTE: Se você NÃO realizou esta alteração, recupere o acesso à sua conta imediatamente ou contate o administrador do evento.

Atenciosamente,
Segurança EvoTech Events`;

  return renderBaseLayout({ title, previewText, contentHtml, contentText });
}

module.exports = renderPasswordChangedTemplate;
