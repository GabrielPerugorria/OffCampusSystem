'use strict';
const orderService = require('../services/orderService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { recordAudit } = require('../middlewares/audit');

exports.create = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body, req.user);
  return created(res, order);
});

exports.confirm = asyncHandler(async (req, res) => {
  const result = await orderService.confirmOrder(req.params.id, req.user.organizationId);
  await recordAudit(req, `Confirmou o pagamento do pedido #${req.params.id}`, 'order', req.params.id);
  return ok(res, result);
});

exports.listTickets = asyncHandler(async (req, res) => {
  const { rows, total, page, limit } = await orderService.listTickets(req.user.organizationId, req.query);
  return ok(res, rows, { total, page, limit });
});
