'use strict';
const db = require('../config/db');
const AppError = require('../utils/AppError');

async function listCategories(organizationId) {
  return db.query(
    'SELECT id, name, icon FROM expense_categories WHERE organization_id = ? ORDER BY name',
    [organizationId]
  );
}

async function ensureCategory(organizationId, { categoryId, categoryName, categoryIcon }) {
  if (categoryId) {
    const cat = await db.queryOne(
      'SELECT id FROM expense_categories WHERE id = ? AND organization_id = ?',
      [categoryId, organizationId]
    );
    if (!cat) throw AppError.badRequest('Categoria inválida.');
    return categoryId;
  }
  const existing = await db.queryOne(
    'SELECT id FROM expense_categories WHERE organization_id = ? AND name = ?',
    [organizationId, categoryName]
  );
  if (existing) return existing.id;
  const result = await db.query(
    'INSERT INTO expense_categories (organization_id, name, icon) VALUES (?,?,?)',
    [organizationId, categoryName, categoryIcon || null]
  );
  return result.insertId;
}

async function assertEventOwned(eventId, organizationId) {
  if (!eventId) return null;
  const ev = await db.queryOne(
    'SELECT id FROM events WHERE id = ? AND organization_id = ?', [eventId, organizationId]
  );
  if (!ev) throw AppError.badRequest('Evento inválido para esta organização.');
  return eventId;
}

async function listExpenses(organizationId, { eventId } = {}) {
  const params = [organizationId];
  let where = 'WHERE x.organization_id = ?';
  if (eventId) { where += ' AND x.event_id = ?'; params.push(eventId); }
  return db.query(
    `SELECT x.id, x.description, x.amount, x.expense_date, x.status,
            x.event_id, e.name AS event_name,
            c.id AS category_id, c.name AS category_name, c.icon AS category_icon
       FROM expenses x
       JOIN expense_categories c ON c.id = x.category_id
  LEFT JOIN events e             ON e.id = x.event_id
       ${where}
      ORDER BY x.expense_date DESC, x.id DESC`,
    params
  );
}

async function createExpense(organizationId, userId, data) {
  const categoryId = await ensureCategory(organizationId, data);
  const eventId = await assertEventOwned(data.eventId, organizationId);
  const result = await db.query(
    `INSERT INTO expenses
       (organization_id, event_id, category_id, description, amount, expense_date, status, created_by)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      organizationId, eventId || null, categoryId, data.description || null, data.amount,
      data.expenseDate || new Date().toISOString().slice(0, 10), data.status || 'paid', userId,
    ]
  );
  return getExpense(result.insertId, organizationId);
}

async function getExpense(id, organizationId) {
  const row = await db.queryOne(
    `SELECT x.id, x.description, x.amount, x.expense_date, x.status, x.event_id,
            c.id AS category_id, c.name AS category_name, c.icon AS category_icon
       FROM expenses x JOIN expense_categories c ON c.id = x.category_id
      WHERE x.id = ? AND x.organization_id = ? LIMIT 1`,
    [id, organizationId]
  );
  if (!row) throw AppError.notFound('Despesa não encontrada.');
  return row;
}

async function updateExpense(id, organizationId, data) {
  await getExpense(id, organizationId);
  const sets = [];
  const params = [];
  if (data.categoryId || data.categoryName) {
    sets.push('category_id = ?');
    params.push(await ensureCategory(organizationId, data));
  }
  if (data.eventId !== undefined) {
    sets.push('event_id = ?');
    params.push(await assertEventOwned(data.eventId, organizationId));
  }
  if (data.description !== undefined) { sets.push('description = ?');  params.push(data.description); }
  if (data.amount !== undefined)      { sets.push('amount = ?');       params.push(data.amount); }
  if (data.expenseDate !== undefined) { sets.push('expense_date = ?'); params.push(data.expenseDate); }
  if (data.status !== undefined)      { sets.push('status = ?');       params.push(data.status); }
  if (sets.length) {
    params.push(id, organizationId);
    await db.query(
      `UPDATE expenses SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`, params
    );
  }
  return getExpense(id, organizationId);
}

async function removeExpense(id, organizationId) {
  const expense = await getExpense(id, organizationId);
  await db.query('DELETE FROM expenses WHERE id = ? AND organization_id = ?', [id, organizationId]);
  return expense;
}

// Receita reconhecida = ingressos de pedidos PAGOS. Difere do cálculo antigo
// (total - disponível do lote), que confundia estoque com venda.
async function revenueTotals(organizationId, eventId = null) {
  const params = [organizationId];
  let where = "WHERE e.organization_id = ? AND o.status = 'paid'";
  if (eventId) { where += ' AND t.event_id = ?'; params.push(eventId); }
  const row = await db.queryOne(
    `SELECT COALESCE(SUM(t.price_paid),0) AS revenue, COUNT(t.id) AS sold
       FROM tickets t JOIN orders o ON o.id = t.order_id
       JOIN events e ON e.id = t.event_id ${where}`,
    params
  );
  return { revenue: Number(row.revenue), sold: Number(row.sold) };
}

async function expenseTotals(organizationId, eventId = null) {
  // Separa despesas por escopo (direta vs geral) e por status (paid vs pending).
  // Isolamento: todas as queries filtram organization_id=? — sem vazamento entre orgs.
  const directPaid = await db.queryOne(
    `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
      WHERE organization_id = ? AND status = 'paid'
        ${eventId ? 'AND event_id = ?' : 'AND event_id IS NOT NULL'}`,
    eventId ? [organizationId, eventId] : [organizationId]
  );
  const directPending = await db.queryOne(
    `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
      WHERE organization_id = ? AND status = 'pending'
        ${eventId ? 'AND event_id = ?' : 'AND event_id IS NOT NULL'}`,
    eventId ? [organizationId, eventId] : [organizationId]
  );
  const generalPaid = await db.queryOne(
    `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
      WHERE organization_id = ? AND event_id IS NULL AND status = 'paid'`,
    [organizationId]
  );
  const generalPending = await db.queryOne(
    `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
      WHERE organization_id = ? AND event_id IS NULL AND status = 'pending'`,
    [organizationId]
  );
  return {
    directPaid: Number(directPaid.total),
    directPending: Number(directPending.total),
    generalPaid: Number(generalPaid.total),
    generalPending: Number(generalPending.total),
    // Atalhos para compatibilidade retroativa
    direct: Number(directPaid.total) + Number(directPending.total),
    general: Number(generalPaid.total) + Number(generalPending.total),
  };
}

async function summary(organizationId) {
  const { revenue, sold } = await revenueTotals(organizationId);
  const totals = await expenseTotals(organizationId);

  // Despesas totais (diretas de eventos + custos gerais corporativos)
  const expensesTotal = totals.direct + totals.general;
  const expensesPaid = totals.directPaid + totals.generalPaid;
  const expensesPending = totals.directPending + totals.generalPending;

  // Saldo operacional considerando todas as despesas comprometidas
  const balance = revenue - expensesTotal;
  // Saldo de caixa realizado (receita confirmada menos despesas efetivamente pagas)
  const cashBalance = revenue - expensesPaid;

  const margin = revenue > 0 ? (balance / revenue) * 100 : 0;
  const roi = expensesTotal > 0 ? (balance / expensesTotal) * 100 : 0;
  const averageTicket = sold > 0 ? revenue / sold : 0;

  const byCategory = await db.query(
    `SELECT c.name AS category, c.icon, COALESCE(SUM(x.amount),0) AS total
       FROM expenses x JOIN expense_categories c ON c.id = x.category_id
      WHERE x.organization_id = ?
      GROUP BY c.id, c.name, c.icon
      ORDER BY total DESC`,
    [organizationId]
  );

  return {
    revenue,
    ticketsSold: sold,
    expenses: expensesTotal,         // total geral (diretas + gerais)
    expensesPaid,                   // despesas liquidadas
    expensesPending,                // despesas a pagar
    expensesDirect: totals.direct,
    expensesGeneral: totals.general,
    balance,                        // resultado econômico
    cashBalance,                    // resultado de caixa
    margin,
    roi,
    averageTicket,
    byCategory,
  };
}

module.exports = {
  listCategories, listExpenses, createExpense, updateExpense, removeExpense,
  summary, revenueTotals, expenseTotals,
};
