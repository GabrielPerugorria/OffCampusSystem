'use strict';
const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * inAppNotificationService — Central de notificações internas em tempo real para o painel administrativo.
 *
 * Categorias suportadas:
 * - sales: Nova venda confirmada, pagamento aprovado/recusado, cancelamento, meta atingida, lote esgotado
 * - account: Novo cadastro, desafio 2FA emitido, login administrativo bem-sucedido, tentativa suspeita, reset de senha
 * - financial: Nova despesa, despesa paga, alerta financeiro / inconsistência
 * - stock: Movimentação de bar, estoque baixo, estoque crítico, produto esgotado
 * - operation: Check-in realizado, erro de envio Resend, falha em integrações
 */

async function createNotification({
  organizationId = null,
  eventId = null,
  category, // 'sales' | 'account' | 'financial' | 'stock' | 'operation'
  severity = 'info', // 'info' | 'warning' | 'critical'
  title,
  message,
  metadata = null,
  conn = null,
}) {
  const queryFn = conn ? conn.execute.bind(conn) : db.query.bind(db);
  const sql = `
    INSERT INTO in_app_notifications (
      organization_id, event_id, category, severity, title, message, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `;
  const params = [
    organizationId || null,
    eventId || null,
    category,
    severity,
    title,
    message,
    metadata ? JSON.stringify(metadata) : null,
  ];

  try {
    const result = await queryFn(sql, params);
    const insertId = result.insertId || (result[0] && result[0].insertId);
    logger.debug(`[InAppNotif] Criada notificação #${insertId} [${category}/${severity}]: ${title}`);
    return insertId;
  } catch (err) {
    logger.error('[InAppNotif] Erro ao criar notificação interna:', err.message);
    return null;
  }
}

async function listNotifications({
  organizationId = null,
  category = null,
  severity = null,
  unreadOnly = false,
  limit = 50,
  offset = 0,
}) {
  const where = [];
  const params = [];

  if (organizationId) {
    where.push('(organization_id = ? OR organization_id IS NULL)');
    params.push(organizationId);
  }

  if (category) {
    where.push('category = ?');
    params.push(category);
  }

  if (severity) {
    where.push('severity = ?');
    params.push(severity);
  }

  if (unreadOnly) {
    where.push('read_at IS NULL');
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END), 0) AS unread
       FROM in_app_notifications ${whereClause}`,
    params
  );

  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const safeOffset = Math.max(0, Number(offset) || 0);

  const items = await db.query(
    `SELECT id, organization_id, event_id, category, severity, title, message, metadata, read_at, created_at
       FROM in_app_notifications
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?`,
    [...params, safeLimit, safeOffset]
  );

  return {
    items: (items || []).map(i => ({
      ...i,
      metadata: typeof i.metadata === 'string' ? JSON.parse(i.metadata) : i.metadata,
    })),
    total: Number(countRow ? countRow.total : 0),
    unreadCount: Number(countRow ? countRow.unread : 0),
  };
}

async function getUnreadCount(organizationId = null) {
  let sql = 'SELECT COUNT(*) AS unread FROM in_app_notifications WHERE read_at IS NULL';
  const params = [];
  if (organizationId) {
    sql += ' AND (organization_id = ? OR organization_id IS NULL)';
    params.push(organizationId);
  }
  const row = await db.queryOne(sql, params);
  return Number(row ? row.unread : 0);
}

async function markAsRead(id, organizationId = null) {
  let sql = 'UPDATE in_app_notifications SET read_at = NOW() WHERE id = ? AND read_at IS NULL';
  const params = [id];
  if (organizationId) {
    sql += ' AND (organization_id = ? OR organization_id IS NULL)';
    params.push(organizationId);
  }
  const result = await db.query(sql, params);
  return (result.affectedRows || (result[0] && result[0].affectedRows)) > 0;
}

async function markAllAsRead(organizationId = null) {
  let sql = 'UPDATE in_app_notifications SET read_at = NOW() WHERE read_at IS NULL';
  const params = [];
  if (organizationId) {
    sql += ' AND (organization_id = ? OR organization_id IS NULL)';
    params.push(organizationId);
  }
  const result = await db.query(sql, params);
  return (result.affectedRows || (result[0] && result[0].affectedRows)) || 0;
}

module.exports = {
  createNotification,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
