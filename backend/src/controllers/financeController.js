'use strict';
const financeService = require('../services/financeService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { recordAudit } = require('../middlewares/audit');

const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

exports.summary = asyncHandler(async (req, res) =>
  ok(res, await financeService.summary(req.user.organizationId)));

exports.listCategories = asyncHandler(async (req, res) =>
  ok(res, await financeService.listCategories(req.user.organizationId)));

exports.listExpenses = asyncHandler(async (req, res) =>
  ok(res, await financeService.listExpenses(req.user.organizationId, req.query)));

exports.createExpense = asyncHandler(async (req, res) => {
  const expense = await financeService.createExpense(req.user.organizationId, req.user.id, req.body);
  await recordAudit(req, `Registrou despesa "${expense.category_name}" — ${brl(expense.amount)}`, 'expense', expense.id);
  return created(res, expense);
});

exports.updateExpense = asyncHandler(async (req, res) => {
  const expense = await financeService.updateExpense(req.params.id, req.user.organizationId, req.body);
  await recordAudit(req, `Editou despesa #${expense.id} — ${brl(expense.amount)}`, 'expense', expense.id);
  return ok(res, expense);
});

exports.removeExpense = asyncHandler(async (req, res) => {
  const expense = await financeService.removeExpense(req.params.id, req.user.organizationId);
  await recordAudit(req, `Removeu despesa "${expense.category_name}"`, 'expense', expense.id);
  return ok(res, { id: expense.id, message: 'Despesa removida.' });
});
