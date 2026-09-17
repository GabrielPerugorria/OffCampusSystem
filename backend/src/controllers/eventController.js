'use strict';
const eventService = require('../services/eventService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { recordAudit } = require('../middlewares/audit');

/* ---------- PÚBLICO ---------- */
exports.listPublic = asyncHandler(async (req, res) => ok(res, await eventService.listPublic()));
exports.getPublic  = asyncHandler(async (req, res) =>
  ok(res, await eventService.getPublicBySlug(req.params.slug)));

/* ---------- ADMIN ---------- */
exports.list = asyncHandler(async (req, res) =>
  ok(res, await eventService.listByOrganization(req.user.organizationId, req.query)));

exports.get = asyncHandler(async (req, res) =>
  ok(res, await eventService.getOwned(req.params.id, req.user.organizationId)));

exports.create = asyncHandler(async (req, res) => {
  const event = await eventService.create(req.user.organizationId, req.body);
  await recordAudit(req, `Criou o evento "${event.name}"`, 'event', event.id);
  return created(res, event);
});

exports.update = asyncHandler(async (req, res) => {
  const event = await eventService.update(req.params.id, req.user.organizationId, req.body);
  await recordAudit(req, `Editou o evento "${event.name}"`, 'event', event.id);
  return ok(res, event);
});

exports.updateGoals = asyncHandler(async (req, res) => {
  const event = await eventService.update(req.params.id, req.user.organizationId, req.body);
  await recordAudit(req, `Ajustou metas de "${event.name}"`, 'event', event.id);
  return ok(res, event);
});

exports.remove = asyncHandler(async (req, res) => {
  const event = await eventService.remove(req.params.id, req.user.organizationId);
  await recordAudit(req, `Excluiu o evento "${event.name}"`, 'event', event.id);
  return ok(res, { id: event.id, message: 'Evento excluído.' });
});

/* ---------- LOTES ---------- */
exports.listBatches = asyncHandler(async (req, res) => {
  const event = await eventService.getOwned(req.params.id, req.user.organizationId);
  return ok(res, event.batches);
});

exports.createBatch = asyncHandler(async (req, res) => {
  const batch = await eventService.createBatch(req.params.id, req.user.organizationId, req.body);
  await recordAudit(req, `Criou o lote "${batch.name}"`, 'batch', batch.id);
  return created(res, batch);
});

exports.updateBatch = asyncHandler(async (req, res) => {
  const batch = await eventService.updateBatch(req.params.id, req.user.organizationId, req.body);
  await recordAudit(req, `Editou o lote "${batch.name}"`, 'batch', batch.id);
  return ok(res, batch);
});

exports.adjustBatch = asyncHandler(async (req, res) => {
  const batch = await eventService.adjustBatchStock(req.params.id, req.user.organizationId, req.body);
  await recordAudit(req, `Ajustou quantidades do lote "${batch.name}"`, 'batch', batch.id);
  return ok(res, batch);
});

exports.removeBatch = asyncHandler(async (req, res) => {
  const batch = await eventService.removeBatch(req.params.id, req.user.organizationId);
  await recordAudit(req, `Excluiu o lote "${batch.name}"`, 'batch', batch.id);
  return ok(res, { id: batch.id, message: 'Lote excluído.' });
});
