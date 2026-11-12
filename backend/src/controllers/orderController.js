'use strict';
const orderService = require('../services/orderService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { recordAudit } = require('../middlewares/audit');

exports.create = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body, req.user);
  return created(res, order);
});

exports.list = asyncHandler(async (req, res) => {
  const { rows, total, page, limit } = await orderService.listOrders(req.user.organizationId, req.query);
  return ok(res, rows, { total, page, limit });
});

exports.getOne = asyncHandler(async (req, res) => {
  const order = await orderService.getOrder(req.params.id, req.user.organizationId);
  return ok(res, order);
});

exports.confirm = asyncHandler(async (req, res) => {
  const result = await orderService.confirmOrder(req.params.id, req.user.organizationId, req.user.id);
  await recordAudit(req, `Confirmou o pagamento do pedido #${req.params.id}`, 'order', req.params.id);
  return ok(res, result);
});

exports.cancel = asyncHandler(async (req, res) => {
  const isAdmin = ['owner', 'admin', 'finance'].includes(req.user?.orgRole) || req.user?.role === 'platform_admin';
  const result = await orderService.cancelOrder(req.params.id, {
    organizationId: req.user?.organizationId,
    userId: req.user?.id,
    isAdmin,
  });
  await recordAudit(req, `Cancelou o pedido #${req.params.id}`, 'order', req.params.id);
  return ok(res, result);
});

exports.listTickets = asyncHandler(async (req, res) => {
  const { rows, total, page, limit } = await orderService.listTickets(req.user.organizationId, req.query);
  return ok(res, rows, { total, page, limit });
});
