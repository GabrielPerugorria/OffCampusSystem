'use strict';
const { renderBaseLayout, escapeHtml } = require('./baseTemplate');

/**
 * Template de e-mail para Recuperação de Senha
 */
function renderPasswordResetTemplate({ name, resetLink, expiresMinutes }) {
  const safeName = escapeHtml(name || 'Usuário');
  const safeResetLink = escapeHtml(resetLink);
  const minutes = Number(expiresMinutes) || 30;

  const title = 'Recuperação de Senha — EvoTech Events';
  const previewText = `Instruções para redefinir sua senha no EvoTech Events. Link válido por ${minutes} minutos.`;

  const contentHtml = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.3px;">
      Recuperação de Senha
    </h1>
    <p style="margin:0 0 16px 0;font-size:15px;color:#cbd5e1;line-height:1.6;">
      Olá, <strong style="color:#ffffff;">${safeName}</strong>. Recebemos uma solicitação para redefinir a senha da sua conta no <strong style="color:#ffffff;">EvoTech Events</strong>.
    </p>
    <p style="margin:0 0 24px 0;font-size:15px;color:#cbd5e1;line-height:1.6;">
      Para criar uma nova senha de acesso, clique no botão seguro abaixo. Por motivos de segurança, este link é de uso único e expira em <strong style="color:#10b981;">${minutes} minutos</strong>.
    </p>

    <!-- Botão de Ação -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto 28px auto;">
      <tr>
        <td align="center" style="border-radius:6px;background-color:#10b981;">
          <a href="${safeResetLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#041a11;text-decoration:none;border-radius:6px;letter-spacing:0.2px;">
            Redefinir Minha Senha &rarr;
          </a>
        </td>
      </tr>
    </table>

    <!-- Aviso de Link manual e Segurança -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#141c2e;border:1px solid #1e293b;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 18px;">
          <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:6px;">
            Se o botão não funcionar, copie e cole o link no seu navegador:
          </div>
          <div style="font-size:12px;color:#10b981;word-break:break-all;line-height:1.4;">
            ${safeResetLink}
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">
      <strong>Não solicitou esta alteração?</strong> Não se preocupe, sua conta continua totalmente segura. Você pode ignorar este e-mail tranquilamente; nenhum dado foi modificado.
    </p>
  `;

  const contentText = `Olá, ${name || 'Usuário'}!

Recebemos uma solicitação para redefinir a senha da sua conta no EvoTech Events.

Para criar sua nova senha, acesse o link abaixo (válido por ${minutes} minutos):
${resetLink}

IMPORTANTE: Este link é de uso único. Caso você não tenha solicitado a recuperação de senha, desconsidere esta mensagem. Sua conta permanece protegida.

Atenciosamente,
Segurança EvoTech Events`;

  return renderBaseLayout({ title, previewText, contentHtml, contentText });
}

module.exports = renderPasswordResetTemplate;
