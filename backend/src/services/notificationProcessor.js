'use strict';
const db = require('../config/db');
const logger = require('../utils/logger');
const env = require('../config/env');
const businessEventService = require('./businessEventService');
const notificationOutboxService = require('./notificationOutboxService');
const notificationRateLimitService = require('./notificationRateLimitService');
const recipientResolver = require('./recipientResolver');
const emailService = require('./emailService');
const inAppNotificationService = require('./inAppNotificationService');

// Templates
const renderSalesUpdateTemplate = require('./emailTemplates/salesUpdateTemplate');
const renderFinanceUpdateTemplate = require('./emailTemplates/financeUpdateTemplate');
const renderStockAlertTemplate = require('./emailTemplates/stockAlertTemplate');
const renderGoalReachedTemplate = require('./emailTemplates/goalReachedTemplate');
const renderSummaryTemplate = require('./emailTemplates/summaryTemplate');

/**
 * notificationProcessor — Núcleo de processamento inteligente de eventos e outbox.
 *
 * Desacoplado do scheduler (setInterval) para possibilitar testes unitários/integrados
 * determinísticos e fácil migração futura para workers BullMQ, AWS SQS ou threads.
 */

/**
 * Processa a fila de eventos de negócio brutos e converte em notificações outbox inteligentes.
 */
async function processBusinessEvents(limit = 100) {
  const events = await businessEventService.fetchUnprocessed(limit);
  if (!events || events.length === 0) return 0;

  const processedEventIds = [];

  for (const ev of events) {
    try {
      const payload = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : (ev.payload || {});
      const orgId = ev.organization_id;
      const eventId = ev.event_id;

      switch (ev.type) {
        case 'order_paid':
          await handleOrderPaidEvent({ orgId, eventId, payload });
          break;

        case 'stock_critical':
          await handleStockCriticalEvent({ orgId, eventId, payload });
          break;

        case 'goal_reached':
          await handleGoalReachedEvent({ orgId, eventId, payload });
          break;

        case 'batch_sold_out':
          await handleBatchSoldOutEvent({ orgId, eventId, payload });
          break;

        case 'expense_created':
        case 'expense_paid':
          await handleExpenseEvent({ orgId, eventId, payload, type: ev.type });
          break;

        default:
          logger.debug(`[Processor] Evento ${ev.type} sem regra de notificação direta.`);
          break;
      }

      processedEventIds.push(ev.id);
    } catch (err) {
      logger.error(`[Processor] Erro ao processar business_event #${ev.id}:`, err.message);
      // Ainda assim adiciona para marcar processado e não travar o loop
      processedEventIds.push(ev.id);
    }
  }

  if (processedEventIds.length > 0) {
    await businessEventService.markProcessedBatch(processedEventIds);
  }

  return processedEventIds.length;
}

/**
 * Trata evento de venda confirmada:
 * Agrupa movimentações de venda em janela configurada (padrão 5 min).
 * Se for a primeira venda recente, agenda o e-mail de atualização para o final da janela.
 */
async function handleOrderPaidEvent({ orgId, eventId, payload }) {
  if (!eventId) return;

  // Busca preferências de janela da organização
  const pref = await db.queryOne(
    'SELECT grouping_window_minutes, enabled, sales_updates FROM notification_preferences WHERE organization_id = ? AND recipient_user_id IS NULL LIMIT 1',
    [orgId]
  );

  if (pref && (!pref.enabled || !pref.sales_updates)) {
    return; // Notificações de vendas desativadas nesta org
  }

  const windowMinutes = Math.max(1, (pref ? pref.grouping_window_minutes : 5));

  // Verifica se o lote esgotou com esta venda
  if (payload.batchId) {
    const batch = await db.queryOne(
      'SELECT id, name, quantity_total, quantity_sold FROM ticket_batches WHERE id = ? LIMIT 1',
      [payload.batchId]
    );
    if (batch && Number(batch.quantity_sold) >= Number(batch.quantity_total)) {
      await businessEventService.emit({
        type: 'batch_sold_out',
        organizationId: orgId,
        eventId,
        payload: { batchId: batch.id, batchName: batch.name, total: batch.quantity_total },
      });
    }
  }

  // Verifica se atingiu a meta de faturamento ou participantes
  const eventRow = await db.queryOne(
    `SELECT e.id, e.name, e.goal_revenue, e.goal_attendance, e.capacity,
            COALESCE(SUM(t.price_paid), 0) AS current_revenue,
            COUNT(t.id) AS current_sold
       FROM events e
       LEFT JOIN tickets t ON t.event_id = e.id
       LEFT JOIN orders o ON o.id = t.order_id AND o.status = 'paid'
      WHERE e.id = ?
      GROUP BY e.id`,
    [eventId]
  );

  if (eventRow && eventRow.goal_revenue > 0 && Number(eventRow.current_revenue) >= Number(eventRow.goal_revenue)) {
    await businessEventService.emit({
      type: 'goal_reached',
      organizationId: orgId,
      eventId,
      payload: {
        metric: 'revenue',
        goalValue: Number(eventRow.goal_revenue),
        currentValue: Number(eventRow.current_revenue),
        eventName: eventRow.name,
      },
    });
  }

  // Idempotência e agrupamento: chave baseada no bloco de tempo de agrupamento
  // Agrupa blocos de windowMinutes para consolidar vendas
  const nowMs = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const timeSlot = Math.floor(nowMs / windowMs);

  // Destinatários autorizados para sales_update
  const recipients = await recipientResolver.resolveAuthorizedRecipients({
    organizationId: orgId,
    eventId,
    category: 'sales_update',
  });

  if (recipients.length === 0) return;

  // Agenda ou enfileira com scheduled_for
  const scheduledTime = new Date(nowMs + windowMs);

  for (const r of recipients) {
    const idempotencyKey = `sales_group_${orgId}_${eventId}_${r.userId}_slot_${timeSlot}`;

    // Obtém dados atuais do evento para compor o e-mail agrupado
    const stats = await getEventSalesMetrics(eventId);

    const { html, text } = renderSalesUpdateTemplate({
      eventName: stats.eventName,
      periodLabel: `Últimos ${windowMinutes} minutos`,
      ticketsSold: stats.ticketsSoldRecent || payload.ticketsCount || 1,
      revenueConfirmed: stats.revenueRecent || Number(payload.totalAmount || 0),
      uniqueBuyers: stats.buyersRecent || 1,
      currentBatchName: stats.currentBatchName,
      batchFillPct: stats.batchFillPct,
      eventFillPct: stats.eventFillPct,
      goalRevenue: stats.goalRevenue,
      goalProgress: stats.goalProgress,
      avgTicket: stats.avgTicket,
      prevPeriodTickets: stats.prevPeriodTickets || 0,
      dashboardUrl: `${env.frontendUrl}/admin.html`,
    });

    await notificationOutboxService.enqueueNotification({
      organizationId: orgId,
      eventId,
      category: 'sales_update',
      priority: 'grouped',
      recipientUserId: r.userId,
      recipientEmail: r.email,
      recipientName: r.name,
      subject: `EvoTech Events | Atualização de vendas — ${stats.eventName}`,
      htmlBody: html,
      textBody: text,
      idempotencyKey,
      scheduledFor: scheduledTime,
      payload: { slot: timeSlot, eventId },
    });
  }
}

/**
 * Trata alerta imediato de estoque crítico com deduplicação
 */
async function handleStockCriticalEvent({ orgId, eventId, payload }) {
  const alertKey = `stock_critical_product_${payload.productId}`;

  const rateCheck = await notificationRateLimitService.checkAndRecordRateLimit({
    organizationId: orgId,
    eventId,
    category: 'stock_alert',
    alertKey,
    currentState: { quantity: payload.currentQuantity, minStock: payload.minStock },
    minIntervalMinutes: 30, // não repete o mesmo alerta dentro de 30 minutos
  });

  if (!rateCheck.allowed) {
    logger.info(`[Alerta Estoque] Suprimido por rate limit/deduplicação: ${rateCheck.reason}`);
    return;
  }

  const recipients = await recipientResolver.resolveAuthorizedRecipients({
    organizationId: orgId,
    eventId,
    category: 'stock_alert',
  });

  for (const r of recipients) {
    const { html, text } = renderStockAlertTemplate({
      productName: payload.productName || 'Item do Bar',
      eventName: payload.eventName || 'Evento Geral',
      currentStock: payload.currentQuantity,
      minStock: payload.minStock,
      unit: payload.unit || 'un',
      dashboardUrl: `${env.frontendUrl}/admin.html`,
    });

    await notificationOutboxService.enqueueNotification({
      organizationId: orgId,
      eventId,
      category: 'stock_alert',
      priority: 'immediate',
      recipientUserId: r.userId,
      recipientEmail: r.email,
      recipientName: r.name,
      subject: `EvoTech Events | Atenção ao estoque — ${payload.eventName || 'Bar'}`,
      htmlBody: html,
      textBody: text,
      idempotencyKey: `stock_crit_${alertKey}_${Date.now()}_${r.userId}`,
      scheduledFor: new Date(), // envio imediato
    });
  }
}

/**
 * Trata alerta imediato de meta atingida com deduplicação
 */
async function handleGoalReachedEvent({ orgId, eventId, payload }) {
  const alertKey = `goal_reached_${eventId}_${payload.metric}`;

  const rateCheck = await notificationRateLimitService.checkAndRecordRateLimit({
    organizationId: orgId,
    eventId,
    category: 'goal_reached',
    alertKey,
    currentState: { metric: payload.metric, goal: payload.goalValue },
    minIntervalMinutes: 1440, // meta atingida dispara no máximo 1x ao dia por métrica
  });

  if (!rateCheck.allowed) return;

  const recipients = await recipientResolver.resolveAuthorizedRecipients({
    organizationId: orgId,
    eventId,
    category: 'goal_reached',
  });

  for (const r of recipients) {
    const { html, text } = renderGoalReachedTemplate({
      eventName: payload.eventName,
      goalName: payload.metric === 'revenue' ? 'Meta de Faturamento' : 'Meta de Público',
      targetValue: payload.goalValue,
      currentValue: payload.currentValue,
      isRevenue: payload.metric === 'revenue',
      dashboardUrl: `${env.frontendUrl}/admin.html`,
    });

    await notificationOutboxService.enqueueNotification({
      organizationId: orgId,
      eventId,
      category: 'goal_reached',
      priority: 'immediate',
      recipientUserId: r.userId,
      recipientEmail: r.email,
      recipientName: r.name,
      subject: `EvoTech Events | Meta atingida — ${payload.eventName}`,
      htmlBody: html,
      textBody: text,
      idempotencyKey: `goal_reached_${alertKey}_${r.userId}`,
      scheduledFor: new Date(),
    });
  }
}

/**
 * Trata alerta imediato de lote esgotado
 */
async function handleBatchSoldOutEvent({ orgId, eventId, payload }) {
  const alertKey = `batch_sold_out_${payload.batchId}`;

  const rateCheck = await notificationRateLimitService.checkAndRecordRateLimit({
    organizationId: orgId,
    eventId,
    category: 'sales_update',
    alertKey,
    currentState: { batchId: payload.batchId, total: payload.total },
    minIntervalMinutes: 1440,
  });

  if (!rateCheck.allowed) return;

  const recipients = await recipientResolver.resolveAuthorizedRecipients({
    organizationId: orgId,
    eventId,
    category: 'sales_update',
  });

  const eventRow = await db.queryOne('SELECT name FROM events WHERE id = ? LIMIT 1', [eventId]);
  const eventName = eventRow ? eventRow.name : 'Evento';

  for (const r of recipients) {
    const { html, text } = renderGoalReachedTemplate({
      eventName,
      goalName: `Lote "${payload.batchName}" 100% Esgotado!`,
      targetValue: payload.total,
      currentValue: payload.total,
      isRevenue: false,
      dashboardUrl: `${env.frontendUrl}/admin.html`,
    });

    await notificationOutboxService.enqueueNotification({
      organizationId: orgId,
      eventId,
      category: 'sales_update',
      priority: 'immediate',
      recipientUserId: r.userId,
      recipientEmail: r.email,
      recipientName: r.name,
      subject: `EvoTech Events | Lote esgotado — ${eventName}`,
      htmlBody: html,
      textBody: text,
      idempotencyKey: `batch_sold_out_${payload.batchId}_${r.userId}`,
      scheduledFor: new Date(),
    });
  }
}

/**
 * Trata eventos de despesas financeiras (saldo negativo / alerta crítico)
 */
async function handleExpenseEvent({ orgId, eventId, payload, type }) {
  // Verifica se o saldo operacional ficou negativo
  const revRow = await db.queryOne(
    `SELECT COALESCE(SUM(t.price_paid), 0) AS revenue
       FROM tickets t
       JOIN orders o ON o.id = t.order_id
       JOIN events e ON e.id = t.event_id
      WHERE e.organization_id = ? AND o.status = 'paid'`,
    [orgId]
  );
  const expRow = await db.queryOne(
    `SELECT COALESCE(SUM(amount), 0) AS expenses_paid
       FROM expenses
      WHERE organization_id = ? AND status = 'paid'`,
    [orgId]
  );

  const revenue = Number(revRow ? revRow.revenue : 0);
  const expensesPaid = Number(expRow ? expRow.expenses_paid : 0);
  const balance = revenue - expensesPaid;

  // Se o saldo operacional for negativo, emite alerta crítico imediato
  if (balance < 0) {
    const alertKey = `finance_negative_balance_${orgId}`;
    const rateCheck = await notificationRateLimitService.checkAndRecordRateLimit({
      organizationId: orgId,
      eventId,
      category: 'finance_update',
      alertKey,
      currentState: { balance: Math.round(balance) },
      minIntervalMinutes: 60,
    });

    if (rateCheck.allowed) {
      const recipients = await recipientResolver.resolveAuthorizedRecipients({
        organizationId: orgId,
        eventId,
        category: 'finance_update',
      });

      for (const r of recipients) {
        const { html, text } = renderFinanceUpdateTemplate({
          eventName: 'Organização Geral',
          periodLabel: 'Alerta Operacional',
          revenueConfirmed: revenue,
          expensesTotal: expensesPaid,
          expensesPaid,
          expensesPending: 0,
          operationalBalance: balance,
          roi: expensesPaid > 0 ? ((revenue - expensesPaid) / expensesPaid) * 100 : 0,
          alertMessage: `Atenção: Saldo operacional da organização ficou negativo após registro de despesas. Saldo atual: R$ ${balance.toFixed(2)}.`,
          alertLevel: 'critical',
          dashboardUrl: `${env.frontendUrl}/admin.html`,
        });

        await notificationOutboxService.enqueueNotification({
          organizationId: orgId,
          eventId,
          category: 'finance_update',
          priority: 'immediate',
          recipientUserId: r.userId,
          recipientEmail: r.email,
          recipientName: r.name,
          subject: 'EvoTech Events | Atualização financeira — Alerta Crítico',
          htmlBody: html,
          textBody: text,
          idempotencyKey: `fin_neg_${alertKey}_${Date.now()}_${r.userId}`,
          scheduledFor: new Date(),
        });
      }
    }
  }
}

/**
 * Consulta métricas consolidadas de vendas do evento a partir do banco de dados oficial
 */
async function getEventSalesMetrics(eventId) {
  const ev = await db.queryOne(
    `SELECT e.id, e.name, e.capacity, e.goal_revenue,
            COALESCE(SUM(t.price_paid), 0) AS revenue,
            COUNT(t.id) AS sold
       FROM events e
       LEFT JOIN tickets t ON t.event_id = e.id
       LEFT JOIN orders o ON o.id = t.order_id AND o.status = 'paid'
      WHERE e.id = ?
      GROUP BY e.id`,
    [eventId]
  );

  const activeBatch = await db.queryOne(
    `SELECT name, quantity_total, quantity_sold
       FROM ticket_batches
      WHERE event_id = ? AND status = 'open'
      ORDER BY id ASC LIMIT 1`,
    [eventId]
  );

  const eventName = ev ? ev.name : 'Evento';
  const totalRevenue = Number(ev ? ev.revenue : 0);
  const totalSold = Number(ev ? ev.sold : 0);
  const capacity = Number(ev ? ev.capacity : 0);
  const goalRevenue = Number(ev ? ev.goal_revenue : 0);

  const batchTotal = Number(activeBatch ? activeBatch.quantity_total : 0);
  const batchSold = Number(activeBatch ? activeBatch.quantity_sold : 0);

  return {
    eventName,
    ticketsSoldRecent: totalSold,
    revenueRecent: totalRevenue,
    buyersRecent: totalSold,
    currentBatchName: activeBatch ? activeBatch.name : 'Lote Principal',
    batchFillPct: batchTotal > 0 ? (batchSold / batchTotal) * 100 : 0,
    eventFillPct: capacity > 0 ? (totalSold / capacity) * 100 : 0,
    goalRevenue,
    goalProgress: goalRevenue > 0 ? (totalRevenue / goalRevenue) * 100 : 0,
    avgTicket: totalSold > 0 ? totalRevenue / totalSold : 0,
    prevPeriodTickets: 0,
  };
}

/**
 * Executa o envio real das notificações prontas da outbox através do emailService (Resend).
 *
 * Atualiza os status:
 * - resend_accepted (com resend_message_id) se HTTP 200 do Resend
 * - resend_failed / retry com backoff se erro
 */
async function dispatchClaimedNotifications(batchSize = 10) {
  // 1. Claim atômico de tarefas pendentes
  const jobs = await notificationOutboxService.claimPendingNotifications(batchSize);
  if (!jobs || jobs.length === 0) return 0;

  for (const job of jobs) {
    try {
      const sendResult = await emailService.sendMail({
        to: job.recipient_email,
        subject: job.subject,
        html: job.html_body,
        text: job.text_body || job.subject,
      });

      if (sendResult.success) {
        // Sucesso na aceitação pelo Resend
        await notificationOutboxService.markResendAccepted(job.id, sendResult.id);
        logger.info(`[Outbox] Notificação #${job.id} aceita pelo Resend (ID: ${sendResult.id}).`);
      } else {
        // Falha no envio (ex: rate limit do Resend, rede, erro de formatação)
        await notificationOutboxService.markResendFailed(job.id, sendResult.error || 'Erro no Resend');

        // Cria alerta interno de operação para os administradores
        await inAppNotificationService.createNotification({
          organizationId: job.organization_id,
          eventId: job.event_id,
          category: 'operation',
          severity: 'warning',
          title: 'Falha no envio de e-mail pelo provedor',
          message: `E-mail "${job.subject}" para ${emailService.maskEmail(job.recipient_email)} não foi aceito: ${sendResult.error || 'Erro no Resend'}`,
          metadata: { jobId: job.id, recipientEmail: emailService.maskEmail(job.recipient_email) },
        }).catch(() => {});
      }
    } catch (err) {
      logger.error(`[Outbox] Exceção ao despachar notificação #${job.id}:`, err.message);
      await notificationOutboxService.markResendFailed(job.id, err.message);

      await inAppNotificationService.createNotification({
        organizationId: job.organization_id,
        eventId: job.event_id,
        category: 'operation',
        severity: 'critical',
        title: 'Exceção crítica no processamento de e-mails',
        message: `Exceção ao despachar notificação #${job.id}: ${err.message}`,
        metadata: { jobId: job.id, error: err.message },
      }).catch(() => {});
    }
  }

  return jobs.length;
}

/**
 * Dispara resumo periódico consolidado para a organização.
 */
async function sendConsolidatedSummary({ organizationId, periodLabel = 'Resumo Executivo' }) {
  const org = await db.queryOne('SELECT id, name FROM organizations WHERE id = ? LIMIT 1', [organizationId]);
  if (!org) return;

  // Busca dados de receita confirmada
  const revRow = await db.queryOne(
    `SELECT COALESCE(SUM(t.price_paid), 0) AS revenue, COUNT(t.id) AS sold
       FROM tickets t
       JOIN orders o ON o.id = t.order_id
       JOIN events e ON e.id = t.event_id
      WHERE e.organization_id = ? AND o.status = 'paid'`,
    [organizationId]
  );
  // Busca despesas
  const expRow = await db.queryOne(
    `SELECT COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending
       FROM expenses WHERE organization_id = ?`,
    [organizationId]
  );

  // Busca resumo dos eventos
  const events = await db.query(
    `SELECT e.id, e.name, e.capacity,
            COALESCE(SUM(t.price_paid), 0) AS revenue,
            COUNT(t.id) AS sold
       FROM events e
       LEFT JOIN tickets t ON t.event_id = e.id
       LEFT JOIN orders o ON o.id = t.order_id AND o.status = 'paid'
      WHERE e.organization_id = ?
      GROUP BY e.id`,
    [organizationId]
  );

  const totalRevenue = Number(revRow ? revRow.revenue : 0);
  const totalSold = Number(revRow ? revRow.sold : 0);
  const expensesPaid = Number(expRow ? expRow.paid : 0);
  const expensesPending = Number(expRow ? expRow.pending : 0);
  const balance = totalRevenue - expensesPaid;

  const eventsSummary = events.map(ev => ({
    name: ev.name,
    sold: Number(ev.sold),
    revenue: Number(ev.revenue),
    occupancy: Number(ev.capacity) > 0 ? (Number(ev.sold) / Number(ev.capacity)) * 100 : 0,
  }));

  const recipients = await recipientResolver.resolveAuthorizedRecipients({
    organizationId,
    category: 'summary',
  });

  for (const r of recipients) {
    const { html, text } = renderSummaryTemplate({
      organizationName: org.name,
      periodLabel,
      totalRevenue,
      totalTicketsSold: totalSold,
      expensesPaid,
      expensesPending,
      operationalBalance: balance,
      eventsSummary,
      dashboardUrl: `${env.frontendUrl}/admin.html`,
    });

    await notificationOutboxService.enqueueNotification({
      organizationId,
      category: 'summary',
      priority: 'summary',
      recipientUserId: r.userId,
      recipientEmail: r.email,
      recipientName: r.name,
      subject: `EvoTech Events | ${periodLabel} — ${org.name}`,
      htmlBody: html,
      textBody: text,
      idempotencyKey: `summary_${organizationId}_${r.userId}_${new Date().toISOString().substring(0, 10)}`,
      scheduledFor: new Date(),
    });
  }
}

module.exports = {
  processBusinessEvents,
  dispatchClaimedNotifications,
  sendConsolidatedSummary,
  handleOrderPaidEvent,
  handleStockCriticalEvent,
  handleGoalReachedEvent,
  handleBatchSoldOutEvent,
  handleExpenseEvent,
  getEventSalesMetrics,
};
