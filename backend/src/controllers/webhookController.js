'use strict';
const crypto = require('crypto');
const db = require('../config/db');
const env = require('../config/env');
const logger = require('../utils/logger');
const { ok } = require('../utils/response');
const notificationOutboxService = require('../services/notificationOutboxService');

/**
 * webhookController — Recepção e processamento idempotente de webhooks do Resend.
 *
 * Suporta validação criptográfica de assinaturas Svix enviadas pelo Resend
 * (headers svix-id, svix-timestamp, svix-signature) com proteção anti-replay.
 *
 * Eventos do Resend:
 * - email.sent: Notificação enviada pelo servidor do Resend
 * - email.delivered: Entrega confirmada na caixa de entrada do destinatário
 * - email.delivery_delayed: Atraso temporário
 * - email.bounced: Rejeitado ou devolvido
 * - email.complained: Destinatário marcou como spam
 */

/**
 * Valida a assinatura de webhook enviada pelo Resend (padrão Svix).
 * Retorna true se a assinatura for válida ou se o segredo não estiver configurado (modo dev/testes).
 */
function verifyWebhookSignature(req) {
  const secret = env.email.webhookSecret;
  if (!secret) {
    // Segredo não configurado: permite passagem em dev/testes, emitindo alerta
    return true;
  }

  const svixId = req.headers['svix-id'] || req.headers['webhook-id'];
  const svixTimestamp = req.headers['svix-timestamp'] || req.headers['webhook-timestamp'];
  const svixSignature = req.headers['svix-signature'] || req.headers['webhook-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.warn('[Webhook Resend] Cabeçalhos de assinatura Svix ausentes.');
    return false;
  }

  // Tolerância contra replay attack: 5 minutos (300 segundos)
  const timestampSec = parseInt(svixTimestamp, 10);
  if (isNaN(timestampSec)) {
    logger.warn('[Webhook Resend] Timestamp Svix inválido.');
    return false;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > 300) {
    logger.warn(`[Webhook Resend] Webhook expirado: timestamp=${timestampSec}, atual=${nowSec}`);
    return false;
  }

  try {
    const secretBytes = secret.startsWith('whsec_')
      ? Buffer.from(secret.slice(6), 'base64')
      : Buffer.from(secret, 'utf-8');

    const bodyString = req.rawBody
      ? req.rawBody.toString('utf-8')
      : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

    const toSign = `${svixId}.${svixTimestamp}.${bodyString}`;
    const computedHash = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');
    const expectedSig = `v1,${computedHash}`;

    // svix-signature pode conter múltiplas assinaturas separadas por espaço
    const signatures = svixSignature.split(' ');
    for (const item of signatures) {
      if (item === expectedSig) {
        return true;
      }
      if (item.startsWith('v1,')) {
        const itemBuf = Buffer.from(item);
        const expBuf = Buffer.from(expectedSig);
        if (itemBuf.length === expBuf.length && crypto.timingSafeEqual(itemBuf, expBuf)) {
          return true;
        }
      }
    }

    logger.warn('[Webhook Resend] Assinatura Svix incompatível.');
    return false;
  } catch (err) {
    logger.error('[Webhook Resend] Erro ao validar assinatura:', err.message);
    return false;
  }
}

async function handleResendWebhook(req, res) {
  // 1. Validação criptográfica de integridade e autenticidade da requisição
  if (!verifyWebhookSignature(req)) {
    return res.status(401).json({ error: 'Assinatura do webhook inválida ou expirada.' });
  }

  const event = req.body || {};
  const type = event.type;
  const data = event.data || {};
  const emailId = data.email_id || data.id;

  if (!emailId) {
    logger.warn('[Webhook Resend] Webhook recebido sem email_id — ignorado.');
    return ok(res, { received: true, ignored: true, reason: 'missing email_id' });
  }

  logger.info(`[Webhook Resend] Evento recebido: ${type} para messageId: ${emailId}`);

  switch (type) {
    case 'email.delivered': {
      // Confirmação de entrega definitiva (máquina de estados: só transiciona de resend_accepted ou processing)
      const updated = await notificationOutboxService.markDelivered(emailId);
      logger.info(`[Webhook Resend] E-mail ${emailId} marcado como DELIVERED (atualizado: ${updated}).`);
      break;
    }

    case 'email.bounced': {
      const reason = data.bounce?.message || 'E-mail devolvido (bounced)';
      const updated = await notificationOutboxService.markBounced(emailId, reason);
      logger.warn(`[Webhook Resend] E-mail ${emailId} marcado como BOUNCED: ${reason} (atualizado: ${updated}).`);
      break;
    }

    case 'email.complained': {
      const updated = await notificationOutboxService.markBounced(emailId, 'Destinatário reportou como spam (complaint)');
      logger.warn(`[Webhook Resend] E-mail ${emailId} reportado como SPAM (atualizado: ${updated}).`);
      break;
    }

    default:
      logger.debug(`[Webhook Resend] Evento ${type} processado sem alteração de estado final.`);
      break;
  }

  return ok(res, { received: true, processed: true, emailId, type });
}

module.exports = {
  handleResendWebhook,
  verifyWebhookSignature,
};
