'use strict';
const db = require('../config/db');
const eventService = require('./eventService');
const financeService = require('./financeService');
const inventoryService = require('./inventoryService');

function allocateGeneralCosts(events, generalTotal) {
  const totalRevenue = events.reduce((a, e) => a + e.revenue, 0);
  return events.map(e => {
    const share = totalRevenue > 0
      ? (e.revenue / totalRevenue) * generalTotal
      : (events.length ? generalTotal / events.length : 0);
    return { ...e, allocatedCost: share };
  });
}

async function eventFinancials(organizationId) {
  const events = await eventService.listByOrganization(organizationId);

  const revenueRows = await db.query(
    `SELECT t.event_id, COALESCE(SUM(t.price_paid),0) AS revenue, COUNT(t.id) AS sold
       FROM tickets t JOIN orders o ON o.id = t.order_id JOIN events e ON e.id = t.event_id
      WHERE e.organization_id = ? AND o.status = 'paid'
      GROUP BY t.event_id`,
    [organizationId]
  );
  const directRows = await db.query(
    `SELECT event_id, COALESCE(SUM(amount),0) AS total FROM expenses
      WHERE organization_id = ? AND event_id IS NOT NULL GROUP BY event_id`,
    [organizationId]
  );
  const generalRow = await db.queryOne(
    `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
      WHERE organization_id = ? AND event_id IS NULL`, [organizationId]
  );

  const revenueMap = Object.fromEntries(revenueRows.map(r => [r.event_id, r]));
  const directMap = Object.fromEntries(directRows.map(r => [r.event_id, Number(r.total)]));

  const base = events.map(ev => {
    const rev = revenueMap[ev.id];
    const revenue = rev ? Number(rev.revenue) : 0;
    const sold = rev ? Number(rev.sold) : 0;
    return {
      id: ev.id, name: ev.name, status: ev.status, capacity: ev.capacity,
      eventDate: ev.eventDate, goalAttendance: ev.goalAttendance, goalRevenue: ev.goalRevenue,
      checkins: ev.checkins, sold, revenue,
      occupancy: ev.capacity > 0 ? (sold / ev.capacity) * 100 : 0,
      averageTicket: sold > 0 ? revenue / sold : 0,
      directCost: directMap[ev.id] || 0,
    };
  });

  return allocateGeneralCosts(base, Number(generalRow.total)).map(e => {
    const cost = e.directCost + e.allocatedCost;
    return {
      ...e,
      totalCost: cost,
      profit: e.revenue - cost,
      margin: e.revenue > 0 ? ((e.revenue - cost) / e.revenue) * 100 : 0,
      roi: cost > 0 ? ((e.revenue - cost) / cost) * 100 : 0,
      goalAttendancePct: e.goalAttendance > 0 ? (e.sold / e.goalAttendance) * 100 : 0,
      goalRevenuePct: e.goalRevenue > 0 ? (e.revenue / e.goalRevenue) * 100 : 0,
    };
  });
}

async function dashboard(organizationId) {
  const events = await eventFinancials(organizationId);
  const finance = await financeService.summary(organizationId);
  const products = await inventoryService.list(organizationId);

  const entriesRows = await db.query(
    `SELECT c.guest_name, c.checked_in_at, e.name AS event_name
       FROM checkins c JOIN events e ON e.id = c.event_id
      WHERE e.organization_id = ?
      ORDER BY c.checked_in_at DESC LIMIT 10`,
    [organizationId]
  );
  const todayRow = await db.queryOne(
    `SELECT COUNT(*) AS n FROM checkins c JOIN events e ON e.id = c.event_id
      WHERE e.organization_id = ? AND DATE(c.checked_in_at) = CURDATE()`,
    [organizationId]
  );

  const sold = events.reduce((a, e) => a + e.sold, 0);
  const revenue = events.reduce((a, e) => a + e.revenue, 0);
  const expenses = finance.expenses;
  const upcoming = events
    .filter(e => e.eventDate && new Date(e.eventDate) > new Date())
    .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))[0] || null;

  return {
    kpis: {
      activeEvents: events.filter(e => e.status === 'active').length,
      totalEvents: events.length,
      ticketsSold: sold,
      revenue,
      expenses,
      expensesPaid: finance.expensesPaid,
      expensesPending: finance.expensesPending,
      balance: revenue - expenses,
      cashBalance: finance.cashBalance,
      averageTicket: sold > 0 ? revenue / sold : 0,
      roi: expenses > 0 ? ((revenue - expenses) / expenses) * 100 : 0,
      margin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0,
      checkinsToday: Number(todayRow.n),
      totalCheckins: events.reduce((a, e) => a + e.checkins, 0),
    },
    nextEvent: upcoming,
    events: events.map(e => ({
      id: e.id, name: e.name, sold: e.sold, capacity: e.capacity,
      occupancy: e.occupancy, revenue: e.revenue, checkins: e.checkins, status: e.status,
    })),
    stock: products.map(p => ({
      id: p.id, name: p.name,
      stockQuantity: p.stockQuantity, minStock: p.minStock, low: p.low,
    })),
    expensesByCategory: finance.byCategory.map(c => ({
      category: c.category, total: Number(c.total),
    })),
    recentEntries: entriesRows.map(r => ({
      name: r.guest_name, event: r.event_name, at: r.checked_in_at,
    })),
    alerts: buildAlerts(events, products, finance),
  };
}

function buildAlerts(events, products, finance) {
  const alerts = [];
  products.filter(p => p.low).forEach(p => alerts.push({
    level: 'warning',
    message: `Estoque critico: ${p.name} - ${p.stockQuantity} un. (minimo ${p.minStock})`.trim(),
  }));
  events.forEach(e => {
    if (e.capacity > 0 && e.occupancy >= 95) {
      alerts.push({ level: 'info', message: `${e.name} atingiu ${Math.round(e.occupancy)}% da capacidade maxima.` });
    }
    if (e.goalAttendance > 0 && e.goalAttendancePct < 50 && e.status === 'active') {
      alerts.push({ level: 'warning', message: `${e.name} atingiu apenas ${Math.round(e.goalAttendancePct)}% da meta de publico.` });
    }
  });
  if (finance.balance < 0) {
    alerts.push({ level: 'danger', message: 'Saldo operacional deficitario: despesas excedem a receita confirmada.' });
  }
  return alerts;
}

async function goals(organizationId) {
  const events = await eventFinancials(organizationId);
  const totals = events.reduce((a, e) => ({
    goalAttendance: a.goalAttendance + e.goalAttendance,
    attendance: a.attendance + e.sold,
    goalRevenue: a.goalRevenue + e.goalRevenue,
    revenue: a.revenue + e.revenue,
    cost: a.cost + e.totalCost,
  }), { goalAttendance: 0, attendance: 0, goalRevenue: 0, revenue: 0, cost: 0 });

  return {
    summary: {
      ...totals,
      attendancePct: totals.goalAttendance > 0 ? (totals.attendance / totals.goalAttendance) * 100 : 0,
      revenuePct: totals.goalRevenue > 0 ? (totals.revenue / totals.goalRevenue) * 100 : 0,
      roi: totals.cost > 0 ? ((totals.revenue - totals.cost) / totals.cost) * 100 : 0,
      breakEven: totals.cost > 0 ? Math.min(100, (totals.revenue / totals.cost) * 100) : (totals.revenue > 0 ? 100 : 0),
    },
    events,
  };
}

async function comparison(organizationId) {
  const events = (await eventFinancials(organizationId)).sort((a, b) => b.revenue - a.revenue);
  const insights = [];
  if (events.length) {
    const byMargin = [...events].sort((a, b) => b.margin - a.margin)[0];
    const byAudience = [...events].sort((a, b) => b.sold - a.sold)[0];
    const byTicket = [...events].sort((a, b) => b.averageTicket - a.averageTicket)[0];
    const worst = [...events].sort((a, b) => a.occupancy - b.occupancy)[0];

    if (byMargin && byMargin.revenue > 0) {
      insights.push({ title: 'Melhor Margem', text: `"${byMargin.name}" opera com margem de ${byMargin.margin.toFixed(1)}%.` });
    }
    if (byAudience && byAudience.sold > 0) {
      insights.push({ title: 'Maior Publico', text: `"${byAudience.name}" vendeu ${byAudience.sold} ingresso(s).` });
    }
    if (byTicket && byTicket.averageTicket > 0) {
      insights.push({ title: 'Melhor Ticket Medio', text: `"${byTicket.name}" alcancou ticket medio de R$ ${byTicket.averageTicket.toFixed(2)}.` });
    }
    if (worst && worst.occupancy < 60 && worst.capacity > 0) {
      insights.push({ title: 'Atencao de Ocupacao', text: `"${worst.name}" esta com ${Math.round(worst.occupancy)}% de ocupacao.` });
    }
  }
  return { ranking: events, insights };
}

async function unitEconomics(organizationId, { cac, churn, take }) {
  const events = await eventFinancials(organizationId);
  const gmv = events.reduce((a, e) => a + e.revenue, 0);

  const buyers = await db.queryOne(
    `SELECT COUNT(DISTINCT t.holder_email) AS n
       FROM tickets t JOIN orders o ON o.id = t.order_id JOIN events e ON e.id = t.event_id
      WHERE e.organization_id = ? AND o.status = 'paid'`,
    [organizationId]
  );
  const customers = Number(buyers?.n || 0);
  const arpu = customers > 0 ? gmv / customers : 0;
  const churnFraction = Math.max(0.1, churn) / 100;
  const contributionMargin = 0.5;
  const ltv = arpu / churnFraction;

  return {
    assumptions: {
      cac: Number(cac) || 0,
      churnMonthlyPct: churn,
      takeRatePct: take,
      contributionMargin,
      note: 'Estimativas baseadas em premissas configuradas pelo gestor',
    },
    gmv,
    customers,
    arpu,
    takeRateRevenue: gmv * (take / 100),
    ltv,
    ltvCacRatio: (cac && Number(cac) > 0) ? ltv / Number(cac) : null,
    paybackMonths: (arpu * contributionMargin > 0 && cac > 0) ? cac / (arpu * contributionMargin) : 0,
  };
}

module.exports = { dashboard, goals, comparison, unitEconomics, eventFinancials };