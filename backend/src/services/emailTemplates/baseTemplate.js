'use strict';

/**
 * Escapa caracteres HTML para prevenir injeção em e-mails
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
 * Template base HTML e Texto puro para o EvoTech Events
 * Design Dark Tech: Fundo grafite profundo (#0a0d14), cartões (#121826), bordas sutis (#1e293b),
 * acentos em verde neon (#10b981 / #059669) e tipografia limpa.
 */
function renderBaseLayout({ title, previewText, contentHtml, contentText }) {
  const safeTitle = escapeHtml(title || 'EvoTech Events');
  const safePreview = escapeHtml(previewText || '');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeTitle}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, span { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#07090e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:#e2e8f0;line-height:1.6;">
  ${safePreview ? `<div style="display:none;font-size:1px;color:#07090e;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${safePreview}</div>` : ''}

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#07090e;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px 50px 16px;">
        <!-- Container Principal -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;background-color:#0f1523;border:1px solid #1e293b;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Header com Marca -->
          <tr>
            <td style="padding:32px 36px 24px 36px;border-bottom:1px solid #1a2234;background:linear-gradient(180deg,#131b2e 0%,#0f1523 100%);">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <div style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;text-decoration:none;">
                      EvoTech<span style="color:#10b981;font-weight:700;margin-left:2px;">Events</span>
                    </div>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;padding:4px 10px;background-color:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:20px;font-size:11px;font-weight:600;color:#10b981;text-transform:uppercase;letter-spacing:0.8px;">
                      Transacional
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corpo do E-mail -->
          <tr>
            <td style="padding:36px;background-color:#0f1523;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="padding:28px 36px;background-color:#0a0e18;border-top:1px solid #1a2234;text-align:center;">
              <p style="margin:0 0 10px 0;font-size:12px;color:#64748b;line-height:1.5;">
                Você recebeu esta notificação oficial gerada pela plataforma <strong>EvoTech Events</strong>.
              </p>
              <p style="margin:0;font-size:11px;color:#475569;">
                &copy; ${new Date().getFullYear()} EvoTech Events. Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `====================================================
EVOTECH EVENTS
====================================================

${safeTitle.toUpperCase()}

${contentText.trim()}

----------------------------------------------------
Esta é uma mensagem transacional do EvoTech Events.
© ${new Date().getFullYear()} EvoTech Events. Todos os direitos reservados.
`;

  return { html, text };
}

module.exports = {
  renderBaseLayout,
  escapeHtml,
};
