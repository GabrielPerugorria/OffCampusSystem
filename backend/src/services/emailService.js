'use strict';
const { Resend } = require('resend');
const env = require('../config/env');
const logger = require('../utils/logger');
const renderWelcomeTemplate = require('./emailTemplates/welcomeTemplate');
const renderPasswordResetTemplate = require('./emailTemplates/passwordResetTemplate');
const renderOrderConfirmationTemplate = require('./emailTemplates/orderConfirmationTemplate');
const renderPasswordChangedTemplate = require('./emailTemplates/passwordChangedTemplate');
const renderAdminLoginCodeTemplate = require('./emailTemplates/adminLoginCodeTemplate');
const renderEmailVerificationTemplate = require('./emailTemplates/emailVerificationTemplate');
const renderLoginCodeTemplate = require('./emailTemplates/loginCodeTemplate');
const renderEmailChangeCodeTemplate = require('./emailTemplates/emailChangeCodeTemplate');
const renderSecurityAlertTemplate = require('./emailTemplates/securityAlertTemplate');

// Instancia Resend se a chave estiver presente
let resendClient = null;
if (env.email.resendApiKey) {
  try {
    resendClient = new Resend(env.email.resendApiKey);
  } catch (err) {
    logger.error('Erro ao inicializar cliente Resend:', err.message);
  }
}

/**
 * Função utilitária para mascarar e-mails em logs (privacidade LGPD / conformidade)
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? name[0] + '*' : name[0] + '***' + name[name.length - 1];
  return `${maskedName}@${domain}`;
}

/**
 * Envio base centralizado através do Resend
 */
async function sendMail({ to, subject, html, text }) {
  if (!to) {
    logger.warn('Tentativa de envio de e-mail sem destinatário.');
    return { success: false, error: 'Destinatário obrigatório.' };
  }

  const maskedTo = maskEmail(to);

  // Fallback caso a chave do Resend não esteja configurada
  if (!resendClient) {
    logger.warn(`[SIMULAÇÃO] Resend não configurado (RESEND_API_KEY ausente). E-mail para ${maskedTo} [Assunto: "${subject}"] não foi disparado.`);
    return {
      success: false,
      simulated: true,
      error: 'RESEND_API_KEY ausente no ambiente. Envio em modo simulação.',
    };
  }

  const from = env.email.from;

  try {
    const payload = {
      from,
      to,
      subject,
      html,
      text,
    };

    const response = await resendClient.emails.send(payload);

    if (response.error) {
      logger.error(`Falha na resposta do Resend ao enviar para ${maskedTo}:`, response.error.message || response.error);
      return {
        success: false,
        error: response.error.message || 'Erro no serviço Resend.',
        code: response.error.name,
      };
    }

    logger.info(`E-mail enviado com sucesso via Resend para ${maskedTo}. ID: ${response.data?.id}`);
    return {
      success: true,
      id: response.data?.id,
    };
  } catch (err) {
    logger.error(`Exceção ao comunicar com Resend para ${maskedTo}:`, err.message);
    return {
      success: false,
      error: err.message || 'Erro de conexão com provedor de e-mail.',
    };
  }
}

/**
 * Dispara e-mail de confirmação de cadastro / boas-vindas
 */
async function sendWelcomeEmail({ to, name }) {
  try {
    const loginUrl = `${env.frontendUrl}/index.html`;
    const { html, text } = renderWelcomeTemplate({ name, loginUrl });
    return await sendMail({
      to,
      subject: 'Bem-vindo ao EvoTech Events',
      html,
      text,
    });
  } catch (err) {
    logger.error('Erro ao gerar template de boas-vindas:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dispara e-mail de recuperação de senha com link seguro
 */
async function sendPasswordResetEmail({ to, name, token, expiresMinutes = 30 }) {
  try {
    const resetLink = `${env.frontendUrl}/index.html?reset_token=${encodeURIComponent(token)}`;
    const { html, text } = renderPasswordResetTemplate({ name, resetLink, expiresMinutes });
    return await sendMail({
      to,
      subject: 'Recuperação de Senha — EvoTech Events',
      html,
      text,
    });
  } catch (err) {
    logger.error('Erro ao gerar template de recuperação de senha:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dispara e-mail de confirmação de compra de ingressos
 */
async function sendOrderConfirmationEmail({
  to,
  buyerName,
  orderId,
  eventName,
  eventDate,
  venue,
  totalAmount,
  paymentMethod,
  items,
  tickets,
}) {
  try {
    const accountUrl = `${env.frontendUrl}/index.html`;
    const { html, text } = renderOrderConfirmationTemplate({
      buyerName,
      orderId,
      eventName,
      eventDate,
      venue,
      totalAmount,
      paymentMethod,
      items,
      tickets,
      accountUrl,
    });

    return await sendMail({
      to,
      subject: `Pedido Confirmado #${orderId} — ${eventName || 'EvoTech Events'}`,
      html,
      text,
    });
  } catch (err) {
    logger.error('Erro ao gerar template de confirmação de compra:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dispara notificação de senha alterada
 */
async function sendPasswordChangedNotification({ to, name }) {
  try {
    const { html, text } = renderPasswordChangedTemplate({ name, timestamp: Date.now() });
    return await sendMail({
      to,
      subject: 'Segurança: Sua senha foi alterada — EvoTech Events',
      html,
      text,
    });
  } catch (err) {
    logger.error('Erro ao gerar template de alteração de senha:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dispara código de verificação em 2 etapas para login administrativo
 */
async function sendAdminLoginCodeEmail({ to, name, code, expiresMinutes = 10, ipAddress = null }) {
  try {
    const { html, text } = renderAdminLoginCodeTemplate({ name, code, expiresMinutes, ipAddress });
    return await sendMail({
      to,
      subject: 'Código de Acesso Administrativo — EvoTech Events',
      html,
      text,
    });
  } catch (err) {
    logger.error('Erro ao gerar template de código administrativo:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dispara código de verificação de e-mail no cadastro
 */
async function sendEmailVerificationCode({ to, name, code, expiresMinutes = 15 }) {
  try {
    const { html, text } = renderEmailVerificationTemplate({ name, code, expiresMinutes });
    return await sendMail({
      to,
      subject: `Código de Verificação: ${code} — EvoTech Events`,
      html,
      text,
    });
  } catch (err) {
    logger.error('Erro ao gerar template de verificação de e-mail:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dispara código de verificação de login para participante
 */
async function sendLoginCodeEmail({ to, name, code, expiresMinutes = 10, ipAddress = null, userAgent = null }) {
  try {
    const { html, text } = renderLoginCodeTemplate({ name, code, expiresMinutes, ipAddress, userAgent });
    return await sendMail({
      to,
      subject: `Código de Segurança para Login: ${code} — EvoTech Events`,
      html,
      text,
    });
  } catch (err) {
    logger.error('Erro ao gerar template de código de login:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dispara código de confirmação para alteração de e-mail
 */
async function sendEmailChangeCodeEmail({ to, name, newEmail, code, expiresMinutes = 15 }) {
  try {
    const { html, text } = renderEmailChangeCodeTemplate({ name, newEmail, code, expiresMinutes });
    return await sendMail({
      to,
      subject: `Confirme seu novo e-mail: ${code} — EvoTech Events`,
      html,
      text,
    });
  } catch (err) {
    logger.error('Erro ao gerar template de alteração de e-mail:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dispara notificação de segurança da conta (sem códigos ou tokens)
 */
async function sendSecurityAlertEmail({ to, name, subject, badge, severity, heading, message, details, recommendation }) {
  try {
    const { html, text } = renderSecurityAlertTemplate({
      name,
      badge,
      severity,
      heading,
      message,
      details,
      recommendation,
    });
    return await sendMail({
      to,
      subject: subject || `${heading} — EvoTech Events`,
      html,
      text,
    });
  } catch (err) {
    logger.error('Erro ao gerar template de alerta de segurança:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Retorna status resumido da configuração do Resend (sem expor segredos)
 */
function getConfigStatus() {
  const from = env.email.from || '';
  const isSandboxFrom = from.includes('onboarding@resend.dev');
  return {
    configured: Boolean(resendClient),
    hasApiKey: Boolean(env.email.resendApiKey),
    hasWebhookSecret: Boolean(env.email.webhookSecret),
    from,
    isSandboxFrom,
  };
}

/**
 * Permite recarregar ou injetar cliente (útil para testes unitários ou alteração de chave)
 */
function _setResendClient(client) {
  resendClient = client;
}

module.exports = {
  sendMail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendPasswordChangedNotification,
  sendAdminLoginCodeEmail,
  sendEmailVerificationCode,
  sendLoginCodeEmail,
  sendEmailChangeCodeEmail,
  sendSecurityAlertEmail,
  getConfigStatus,
  _setResendClient,
  maskEmail,
};
