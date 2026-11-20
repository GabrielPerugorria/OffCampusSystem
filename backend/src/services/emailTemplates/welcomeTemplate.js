'use strict';
const { renderBaseLayout, escapeHtml } = require('./baseTemplate');

/**
 * Template de e-mail de Boas-vindas após cadastro
 */
function renderWelcomeTemplate({ name, loginUrl }) {
  const safeName = escapeHtml(name || 'Participante');
  const safeLoginUrl = escapeHtml(loginUrl);

  const title = 'Bem-vindo ao EvoTech Events';
  const previewText = `Olá, ${safeName}! Sua conta no EvoTech Events foi criada com sucesso.`;

  const contentHtml = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.3px;">
      Sua conta está pronta, ${safeName}!
    </h1>
    <p style="margin:0 0 20px 0;font-size:15px;color:#cbd5e1;line-height:1.6;">
      É um prazer ter você conosco. Seu cadastro no <strong style="color:#ffffff;">EvoTech Events</strong> foi concluído com sucesso e agora você já pode explorar eventos, adquirir ingressos com total segurança e gerenciar seus acessos em um só lugar.
    </p>

    <!-- Caixa de destaque informativo -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#141c2e;border:1px solid #1e293b;border-radius:8px;margin-bottom:28px;">
      <tr>
        <td style="padding:18px 20px;">
          <div style="font-size:13px;font-weight:600;color:#10b981;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
            O que você pode fazer agora:
          </div>
          <ul style="margin:0;padding-left:18px;font-size:14px;color:#94a3b8;line-height:1.6;">
            <li>Navegar pelos eventos em destaque</li>
            <li>Acompanhar seus pedidos em tempo real</li>
            <li>Acessar seus ingressos diretamente na área do participante</li>
          </ul>
        </td>
      </tr>
    </table>

    <!-- Botão de Ação -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto 28px auto;">
      <tr>
        <td align="center" style="border-radius:6px;background-color:#10b981;">
          <a href="${safeLoginUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#041a11;text-decoration:none;border-radius:6px;letter-spacing:0.2px;">
            Acessar o EvoTech Events &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">
      Dica: Você pode acessar seus ingressos a qualquer momento fazendo login na plataforma com o seu e-mail cadastrado.
    </p>
  `;

  const contentText = `Olá, ${name || 'Participante'}!

Sua conta no EvoTech Events foi criada com sucesso.

Agora você já pode explorar os eventos disponíveis, garantir seus ingressos e gerenciar suas participações em uma plataforma tecnológica, rápida e segura.

Para acessar sua conta, utilize o endereço abaixo:
${loginUrl}

Atenciosamente,
Equipe EvoTech Events`;

  return renderBaseLayout({ title, previewText, contentHtml, contentText });
}

module.exports = renderWelcomeTemplate;
