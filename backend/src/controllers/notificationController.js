'use strict';
const db = require('../config/db');
const { ok, badRequest } = require('../utils/response');
const AppError = require('../utils/AppError');
const notificationOutboxService = require('../services/notificationOutboxService');
const notificationProcessor = require('../services/notificationProcessor');

/**
 * notificationController — Preferências e histórico de notificações empresariais
 */

async function getPreferences(req, res) {
  const organizationId = req.user.organizationId;
  const userId = req.user.id;

  // Busca preferência específica do usuário na org, ou preferência padrão da org
  let pref = await db.queryOne(
    `SELECT * FROM notification_preferences
      WHERE organization_id = ? AND recipient_user_id = ?
      LIMIT 1`,
    [organizationId, userId]
  );

  if (!pref) {
    pref = await db.queryOne(
      `SELECT * FROM notification_preferences
        WHERE organization_id = ? AND recipient_user_id IS NULL
        LIMIT 1`,
      [organizationId]
    );
  }

  // Valores padrão se não houver registro
  const data = pref || {
    organization_id: organizationId,
    recipient_user_id: userId,
    enabled: 1,
    sales_updates: 1,
    finance_updates: 1,
    stock_alerts: 1,
    goals_reached: 1,
    summaries_enabled: 1,
    grouping_window_minutes: 5,
    max_emails_per_event_per_hour: 10,
    min_interval_minutes: 2,
  };

  return ok(res, data);
}

async function updatePreferences(req, res) {
  const organizationId = req.user.organizationId;
  const userId = req.user.id;
  const body = req.body || {};

  const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1;
  const salesUpdates = body.salesUpdates !== undefined ? (body.salesUpdates ? 1 : 0) : 1;
  const financeUpdates = body.financeUpdates !== undefined ? (body.financeUpdates ? 1 : 0) : 1;
  const stockAlerts = body.stockAlerts !== undefined ? (body.stockAlerts ? 1 : 0) : 1;
  const goalsReached = body.goalsReached !== undefined ? (body.goalsReached ? 1 : 0) : 1;
  const summariesEnabled = body.summariesEnabled !== undefined ? (body.summariesEnabled ? 1 : 0) : 1;
  const groupingWindow = Math.max(1, Math.min(60, Number(body.groupingWindowMinutes || 5)));
  const maxEmailsPerHour = Math.max(1, Math.min(100, Number(body.maxEmailsPerEventPerHour || 10)));
  const minInterval = Math.max(1, Math.min(60, Number(body.minIntervalMinutes || 2)));

  await db.query(
    `INSERT INTO notification_preferences (
      organization_id, recipient_user_id, enabled,
      sales_updates, finance_updates, stock_alerts, goals_reached, summaries_enabled,
      grouping_window_minutes, max_emails_per_event_per_hour, min_interval_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      enabled = VALUES(enabled),
      sales_updates = VALUES(sales_updates),
      finance_updates = VALUES(finance_updates),
      stock_alerts = VALUES(stock_alerts),
      goals_reached = VALUES(goals_reached),
      summaries_enabled = VALUES(summaries_enabled),
      grouping_window_minutes = VALUES(grouping_window_minutes),
      max_emails_per_event_per_hour = VALUES(max_emails_per_event_per_hour),
      min_interval_minutes = VALUES(min_interval_minutes),
      updated_at = NOW()`,
    [
      organizationId, userId, enabled,
      salesUpdates, financeUpdates, stockAlerts, goalsReached, summariesEnabled,
      groupingWindow, maxEmailsPerHour, minInterval,
    ]
  );

  return ok(res, { message: 'Preferências de notificação salvas com sucesso.' });
}

async function getHistory(req, res) {
  const organizationId = req.user.organizationId;
  const { eventId, category, status, limit, offset } = req.query;

  const result = await notificationOutboxService.listHistory({
    organizationId,
    eventId: eventId ? Number(eventId) : null,
    category: category || null,
    status: status || null,
    limit: limit ? Number(limit) : 50,
    offset: offset ? Number(offset) : 0,
  });

  return ok(res, result);
}

async function getMetrics(req, res) {
  const organizationId = req.user.organizationId;

  const rows = await db.query(
    `SELECT status, COUNT(*) AS count
       FROM notification_outbox
      WHERE organization_id = ?
      GROUP BY status`,
    [organizationId]
  );

  const metrics = {
    pending: 0,
    processing: 0,
    resend_accepted: 0,
    delivered: 0,
    resend_failed: 0,
    bounced: 0,
    total: 0,
  };

  for (const r of rows) {
    if (metrics[r.status] !== undefined) {
      metrics[r.status] = Number(r.count);
    }
    metrics.total += Number(r.count);
  }

  return ok(res, metrics);
}

async function triggerSummary(req, res) {
  const organizationId = req.user.organizationId;
  const isOwner = req.user.orgRole === 'owner' || req.user.role === 'platform_admin';

  if (!isOwner) {
    throw AppError.forbidden('Apenas o proprietário da organização pode disparar o resumo consolidado manual.');
  }

  await notificationProcessor.sendConsolidatedSummary({
    organizationId,
    periodLabel: 'Resumo Sob Demanda',
  });

  return ok(res, { message: 'Resumo consolidado enfileirado para envio aos gestores autorizados.' });
}

module.exports = {
  getPreferences,
  updatePreferences,
  getHistory,
  getMetrics,
  triggerSummary,
};
