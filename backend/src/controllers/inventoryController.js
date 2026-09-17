'use strict';
const inventoryService = require('../services/inventoryService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { recordAudit } = require('../middlewares/audit');

exports.list = asyncHandler(async (req, res) =>
  ok(res, await inventoryService.list(req.user.organizationId, req.query)));

exports.create = asyncHandler(async (req, res) => {
  const product = await inventoryService.create(req.user.organizationId, req.body, req.user.id);
  await recordAudit(req, `Adicionou o item "${product.name}" ao Open Bar`, 'product', product.id);
  return created(res, product);
});

exports.update = asyncHandler(async (req, res) => {
  const product = await inventoryService.update(req.params.id, req.user.organizationId, req.body, req.user.id);
  await recordAudit(req, `Editou o item "${product.name}"`, 'product', product.id);
  return ok(res, product);
});

exports.remove = asyncHandler(async (req, res) => {
  const product = await inventoryService.remove(req.params.id, req.user.organizationId);
  await recordAudit(req, `Arquivou o item "${product.name}"`, 'product', product.id);
  return ok(res, { id: product.id, message: 'Item arquivado.' });
});

exports.createMovement = asyncHandler(async (req, res) => {
  const movement = await inventoryService.move(req.params.id, req.user.organizationId, req.body, req.user.id);
  await recordAudit(req, `Movimentou estoque do item #${req.params.id}: ${movement.quantity > 0 ? '+' : ''}${movement.quantity} un.`, 'product', req.params.id);
  return created(res, movement);
});

exports.listMovements = asyncHandler(async (req, res) =>
  ok(res, await inventoryService.movements(req.user.organizationId, req.query)));

exports.alerts = asyncHandler(async (req, res) =>
  ok(res, await inventoryService.alerts(req.user.organizationId)));
