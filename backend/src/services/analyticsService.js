'use strict';
const db = require('../config/db');
const eventService = require('./eventService');
const financeService = require('./financeService');
const inventoryService = require('./inventoryService');

// Rateio de custos gerais (expenses sem event_id) proporcional à RECEITA do
// evento. O painel antigo dividia tudo por igual entre eventos; aqui a regra
// é explícita e os custos diretos entram inteiros no evento a que pertencem.
function allocateGeneralCosts(events, generalTotal) {
  const totalRevenue = events.reduce((a, e) => a + e.revenue, 0);
  return events.map(e => {
    const share = totalRevenue > 0
      ? (e.revenue / totalRevenue) * generalTotal
      : (events.length ? generalTotal / events.length : 0);
    return { ...e, allocatedCost: share };
  });
}

// Base comum para dashboard, metas e comparativo: 1 consulta por bloco.
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
    // Receita reconhecida (pedidos pagos). Se ainda não houver vendas reais,
    // cai para o valor derivado dos lotes — usado nos dados de demonstração.
    const revenue = rev ? Number(rev.revenue) : ev.revenue;
    const sold = rev ? Number(rev.sold) : ev.sold;
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

// Payload único do dashboard: substitui 6 renders que liam localStorage.
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
      balance: revenue - expenses,
      averageTicket: sold > 0 ? revenue / sold : 0,
      roi: expenses > 0 ? ((revenue - expenses) / expenses) * 100 : 0,
      checkinsToday: Number(todayRow.n),
      totalCheckins: events.reduce((a, e) => a + e.checkins, 0),
    },
    nextEvent: upcoming,
    events: events.map(e => ({
      id: e.id, name: e.name, sold: e.sold, capacity: e.capacity,
      occupancy: e.occupancy, revenue: e.revenue, checkins: e.checkins, status: e.status,
    })),
    stock: products.map(p => ({
      id: p.id, name: p.name, emoji: p.emoji,
      stockQuantity: p.stockQuantity, minStock: p.minStock, low: p.low,
    })),
    expensesByCategory: finance.byCategory.map(c => ({
      category: `${c.icon || ''} ${c.category}`.trim(), total: Number(c.total),
    })),
    recentEntries: entriesRows.map(r => ({
      name: r.guest_name, event: r.event_name, at: r.checked_in_at,
    })),
    alerts: buildAlerts(events, products, finance),
  };
}

// Alertas: regras explícitas sobre dados reais, sem texto inventado.
function buildAlerts(events, products, finance) {
  const alerts = [];
  products.filter(p => p.low).forEach(p => alerts.push({
    level: 'warning',
    message: `Estoque baixo: ${p.emoji || ''} ${p.name} — ${p.stockQuantity} un. (mínimo ${p.minStock})`.trim(),
  }));
  events.forEach(e => {
    if (e.capacity > 0 && e.occupancy >= 95) {
      alerts.push({ level: 'info', message: `${e.name} está com ${Math.round(e.occupancy)}% da capacidade vendida.` });
    }
    if (e.goalAttendance > 0 && e.goalAttendancePct < 50 && e.status === 'active') {
      alerts.push({ level: 'warning', message: `${e.name} atingiu apenas ${Math.round(e.goalAttendancePct)}% da meta de público.` });
    }
  });
  if (finance.balance < 0) {
    alerts.push({ level: 'danger', message: 'Saldo operacional negativo: despesas superam a receita reconhecida.' });
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
      breakEven: totals.cost > 0 ? Math.min(100, (totals.revenue / totals.cost) * 100) : 0,
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

    if (byMargin.revenue > 0) insights.push({ icon: '🧠', title: 'Melhor margem', text: `"${byMargin.name}" opera com margem de ${byMargin.margin.toFixed(1)}%.` });
    if (byAudience.sold > 0)  insights.push({ icon: '👥', title: 'Maior público', text: `"${byAudience.name}" vendeu ${byAudience.sold} ingresso(s).` });
    if (byTicket.averageTicket > 0) insights.push({ icon: '🎟️', title: 'Melhor ticket médio', text: `"${byTicket.name}" com ticket médio de R$ ${byTicket.averageTicket.toFixed(2)}.` });
    if (worst.occupancy < 60 && worst.capacity > 0) insights.push({ icon: '⚠️', title: 'Atenção', text: `"${worst.name}" está com ${Math.round(worst.occupancy)}% de ocupação.` });
  }
  return { ranking: events, insights };
}

// Unit economics. CAC, churn e take rate são PREMISSAS do usuário, não dados
// medidos — vêm por query string e são devolvidas junto para ficar explícito.
async function unitEconomics(organizationId, { cac, churn, take }) {
  const events = await eventFinancials(organizationId);
  const gmv = events.reduce((a, e) => a + e.revenue, 0);

  const buyers = await db.queryOne(
    `SELECT COUNT(DISTINCT t.holder_email) AS n
       FROM tickets t JOIN orders o ON o.id = t.order_id JOIN events e ON e.id = t.event_id
      WHERE e.organization_id = ? AND o.status = 'paid'`,
    [organizationId]
  );
  const customers = Math.max(1, Number(buyers.n));
  const arpu = gmv / customers;
  const churnFraction = Math.max(0.1, churn) / 100;
  const contributionMargin = 0.5;         // premissa do plano de negócios
  const ltv = arpu / churnFraction;

  return {
    assumptions: { cac, churnMonthlyPct: churn, takeRatePct: take, contributionMargin },
    gmv,
    customers,
    arpu,
    takeRateRevenue: gmv * (take / 100),
    ltv,
    ltvCacRatio: ltv / Math.max(1, cac),
    paybackMonths: arpu * contributionMargin > 0 ? cac / (arpu * contributionMargin) : 0,
  };
}

module.exports = { dashboard, goals, comparison, unitEconomics, eventFinancials };
