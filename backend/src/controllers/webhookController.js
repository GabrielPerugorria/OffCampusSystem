'use strict';
const db = require('../config/db');
const logger = require('../utils/logger');
const { ok } = require('../utils/response');
const notificationOutboxService = require('../services/notificationOutboxService');

/**
 * webhookController — Recepção e processamento idempotente de webhooks do Resend.
 *
 * Eventos do Resend:
 * - email.sent: Notificação enviada pelo servidor do Resend
 * - email.delivered: Entrega confirmada na caixa de entrada do destinatário
 * - email.delivery_delayed: Atraso temporário
 * - email.bounced: Rejeitado ou devolvido
 * - email.complained: Destinatário marcou como spam
 */

async function handleResendWebhook(req, res) {
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
      // Confirmação de entrega definitiva
      await notificationOutboxService.markDelivered(emailId);
      logger.info(`[Webhook Resend] E-mail ${emailId} marcado como DELIVERED.`);
      break;
    }

    case 'email.bounced': {
      const reason = data.bounce?.message || 'E-mail devolvido (bounced)';
      await notificationOutboxService.markBounced(emailId, reason);
      logger.warn(`[Webhook Resend] E-mail ${emailId} marcado como BOUNCED: ${reason}`);
      break;
    }

    case 'email.complained': {
      await notificationOutboxService.markBounced(emailId, 'Destinatário reportou como spam (complaint)');
      logger.warn(`[Webhook Resend] E-mail ${emailId} reportado como SPAM.`);
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
};
