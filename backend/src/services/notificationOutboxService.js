'use strict';
const db = require('../config/db');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * notificationOutboxService — Gerenciamento da fila persistente de e-mails.
 *
 * Estados de uma notificação:
 * - pending: aguardando agendamento ou janela de agrupamento
 * - processing: sob claim de um worker/scheduler ativo
 * - resend_accepted: aceito pela API do Resend (NÃO garante entrega final)
 * - delivered: entrega confirmada pelo webhook oficial do Resend
 * - resend_failed: falha definitiva após esgotar tentativas
 * - bounced: rejeitado ou caixa postal inexistente
 * - cancelled: cancelado por regra de negócio ou desativação
 */

/**
 * Gera chave de idempotência segura para uma notificação
 */
function generateIdempotencyKey({ organizationId, eventId, category, recipientEmail, uniqueSuffix = '' }) {
  const raw = `${organizationId}_${eventId || 'none'}_${category}_${recipientEmail}_${uniqueSuffix}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Enfileira uma notificação na notification_outbox.
 * Se houver conflito de idempotência (mesma chave já existe), ignora silenciosamente.
 *
 * @param {object} opts
 * @param {number} opts.organizationId
 * @param {number|null} opts.eventId
 * @param {string} opts.category
 * @param {string} opts.priority - 'immediate' | 'grouped' | 'summary'
 * @param {number|null} opts.recipientUserId
 * @param {string} opts.recipientEmail
 * @param {string} opts.recipientName
 * @param {string} opts.subject
 * @param {string} opts.htmlBody
 * @param {string} opts.textBody
 * @param {string} opts.idempotencyKey
 * @param {Date|null} opts.scheduledFor
 * @param {object|null} opts.payload
 * @param {object|null} opts.conn - Conexão ativa caso esteja dentro de transação
 */
async function enqueueNotification({
  organizationId,
  eventId = null,
  category,
  priority = 'grouped',
  recipientUserId = null,
  recipientEmail,
  recipientName = null,
  subject,
  htmlBody,
  textBody = null,
  idempotencyKey = null,
  scheduledFor = null,
  payload = null,
  conn = null,
}) {
  const key = idempotencyKey || generateIdempotencyKey({
    organizationId,
    eventId,
    category,
    recipientEmail,
    uniqueSuffix: `${Date.now()}_${Math.random()}`,
  });

  const sql = `
    INSERT INTO notification_outbox (
      organization_id, event_id, category, priority,
      recipient_user_id, recipient_email, recipient_name,
      subject, html_body, text_body, status, idempotency_key,
      scheduled_for, payload, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, COALESCE(?, NOW()), ?, NOW())
    ON DUPLICATE KEY UPDATE id = id
  `;

  const params = [
    organizationId,
    eventId || null,
    category,
    priority,
    recipientUserId || null,
    recipientEmail,
    recipientName || null,
    subject,
    htmlBody,
    textBody || null,
    key,
    scheduledFor ? new Date(scheduledFor) : null,
    payload ? JSON.stringify(payload) : null,
  ];

  if (conn) {
    const [result] = await conn.execute(sql, params);
    return result.insertId || null;
  } else {
    const result = await db.query(sql, params);
    return result.insertId || null;
  }
}

/**
 * Claim atômico de notificações prontas para envio.
 *
 * Utiliza transação e controle de concorrência no banco para garantir que dois
 * workers nunca processem a mesma notificação simultaneamente.
 *
 * @param {number} limit - Quantidade máxima a ser reivindicada no ciclo
 * @returns {Promise<Array<object>>}
 */
async function claimPendingNotifications(limit = 10) {
  return db.transaction(async (conn) => {
    // 1. Localiza IDs pendentes e agendados para agora ou no passado
    const [rows] = await conn.execute(
      `SELECT id FROM notification_outbox
        WHERE status = 'pending'
          AND scheduled_for <= NOW()
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        ORDER BY CASE priority
                   WHEN 'immediate' THEN 1
                   WHEN 'grouped' THEN 2
                   WHEN 'summary' THEN 3
                   ELSE 4
                 END, scheduled_for ASC
        LIMIT ?
        FOR UPDATE`,
      [limit]
    );

    if (rows.length === 0) return [];

    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');

    // 2. Marca atomicamente como processing
    await conn.execute(
      `UPDATE notification_outbox
          SET status = 'processing',
              processing_started_at = NOW()
        WHERE id IN (${placeholders})`,
      ids
    );

    // 3. Retorna os registros completos agora bloqueados
    const [fullRows] = await conn.execute(
      `SELECT * FROM notification_outbox WHERE id IN (${placeholders})`,
      ids
    );

    return fullRows;
  });
}

/**
 * Marca uma notificação como aceita pelo Resend (API retornou HTTP 200 com ID).
 * IMPORTANTE: isso NÃO significa entregue na caixa de entrada do usuário.
 */
async function markResendAccepted(id, resendMessageId) {
  await db.query(
    `UPDATE notification_outbox
        SET status = 'resend_accepted',
            resend_message_id = ?,
            resend_accepted_at = NOW(),
            sent_at = NOW(),
            last_error = NULL
      WHERE id = ?`,
    [resendMessageId || null, id]
  );
}

/**
 * Registra falha de envio com cálculo de retry / backoff progressivo.
 */
async function markResendFailed(id, errorMessage) {
  const row = await db.queryOne('SELECT attempts, max_attempts FROM notification_outbox WHERE id = ?', [id]);
  if (!row) return;

  const nextAttempt = Number(row.attempts || 0) + 1;
  const isFinalFailure = nextAttempt >= Number(row.max_attempts || 3);

  if (isFinalFailure) {
    await db.query(
      `UPDATE notification_outbox
          SET status = 'resend_failed',
              attempts = ?,
              last_error = ?,
              processing_started_at = NULL
        WHERE id = ?`,
      [nextAttempt, errorMessage, id]
    );
    logger.error(`[Outbox] Notificação #${id} esgotou tentativas (${nextAttempt}/${row.max_attempts}). Status: resend_failed.`);
  } else {
    // Backoff exponencial simples: 2 min * tentativa (ex: 2m, 4m, 6m)
    const delayMinutes = nextAttempt * 2;
    await db.query(
      `UPDATE notification_outbox
          SET status = 'pending',
              attempts = ?,
              last_error = ?,
              next_retry_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
              processing_started_at = NULL
        WHERE id = ?`,
      [nextAttempt, errorMessage, delayMinutes, id]
    );
    logger.warn(`[Outbox] Notificação #${id} falhou (tentativa ${nextAttempt}). Reagendada para daqui a ${delayMinutes}min.`);
  }
}

/**
 * Confirmação de entrega definitiva recebida via webhook do Resend.
 */
async function markDelivered(resendMessageId) {
  if (!resendMessageId) return;

  const result = await db.query(
    `UPDATE notification_outbox
        SET status = 'delivered',
            delivered_at = NOW()
      WHERE resend_message_id = ?
        AND status IN ('resend_accepted', 'processing')`,
    [resendMessageId]
  );

  return result.affectedRows > 0;
}

/**
 * Rejeição / devolução confirmada via webhook do Resend.
 */
async function markBounced(resendMessageId, bounceReason) {
  if (!resendMessageId) return false;

  const result = await db.query(
    `UPDATE notification_outbox
        SET status = 'bounced',
            last_error = ?
      WHERE resend_message_id = ?
        AND status != 'bounced'`,
    [bounceReason || 'E-mail devolvido/rejeitado pelo destinatário', resendMessageId]
  );

  return result.affectedRows > 0;
}

/**
 * Recupera tarefas presas em 'processing' por mais de X minutos (ex: timeout de worker ou reinicialização).
 */
async function recoverStaleProcessingJobs(staleMinutes = 5) {
  const result = await db.query(
    `UPDATE notification_outbox
        SET status = 'pending',
            last_error = 'Recuperado automaticamente: worker anterior não concluiu dentro do limite de tempo.',
            processing_started_at = NULL
      WHERE status = 'processing'
        AND processing_started_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [staleMinutes]
  );

  if (result.affectedRows > 0) {
    logger.warn(`[Outbox] Recuperadas ${result.affectedRows} tarefas presas em 'processing'.`);
  }
  return result.affectedRows;
}

/**
 * Consulta histórico com filtros para o painel administrativo.
 */
async function listHistory({ organizationId, eventId = null, category = null, status = null, limit = 50, offset = 0 }) {
  const conditions = ['organization_id = ?'];
  const params = [organizationId];

  if (eventId) {
    conditions.push('event_id = ?');
    params.push(eventId);
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = conditions.join(' AND ');

  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total FROM notification_outbox WHERE ${whereClause}`,
    params
  );

  const rows = await db.query(
    `SELECT id, organization_id, event_id, category, priority,
            recipient_email, recipient_name, subject, status,
            resend_message_id, created_at, scheduled_for, resend_accepted_at,
            delivered_at, attempts, last_error
       FROM notification_outbox
      WHERE ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    total: Number(countRow ? countRow.total : 0),
    data: rows,
  };
}

module.exports = {
  enqueueNotification,
  claimPendingNotifications,
  markResendAccepted,
  markResendFailed,
  markDelivered,
  markBounced,
  recoverStaleProcessingJobs,
  listHistory,
  generateIdempotencyKey,
};
