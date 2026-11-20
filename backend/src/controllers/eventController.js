'use strict';
const eventService = require('../services/eventService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { recordAudit } = require('../middlewares/audit');
const storageService = require('../services/storageService');
const { verifyFileSignature } = require('../middlewares/upload');

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

exports.uploadImage = asyncHandler(async (req, res) => {
  // 1. Validar presença do arquivo
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({
      success: false,
      error: { message: 'Nenhum arquivo enviado.', code: 'FILE_REQUIRED' }
    });
  }

  // 2. Verificar assinatura real do arquivo (magic numbers)
  const isValid = await verifyFileSignature(req.file.buffer);
  if (!isValid) {
    return res.status(400).json({
      success: false,
      error: { message: 'Assinatura de arquivo inválida. Apenas imagens válidas (JPEG, PNG, WebP) são permitidas.', code: 'INVALID_SIGNATURE' }
    });
  }

  // 3. Verificar se o evento existe e pertence à organização do usuário (RBAC + Isolamento)
  const currentEvent = await eventService.getOwned(req.params.id, req.user.organizationId);
  const oldImagePath = currentEvent.imagePath || currentEvent.image_url;

  // 4. Armazenar a nova imagem
  const storedPath = await storageService.uploadImage(req.file.buffer, req.file.mimetype);

  // 5. Atualizar o banco de dados com tratamento de falhas (rollback)
  try {
    const updatedEvent = await eventService.update(req.params.id, req.user.organizationId, { imagePath: storedPath });
    await recordAudit(req, `Atualizou imagem do evento "${updatedEvent.name}"`, 'event', updatedEvent.id);

    // 6. Remover a imagem anterior apenas após confirmação e se for diferente
    if (oldImagePath && oldImagePath !== storedPath) {
      await storageService.deleteImage(oldImagePath).catch(() => {});
    }

    const imageUrl = storedPath.startsWith('http') ? storedPath : `/${storedPath}`;
    return ok(res, {
      message: 'Imagem enviada com sucesso.',
      imageUrl,
      imagePath: storedPath,
      eventId: updatedEvent.id
    });
  } catch (err) {
    // Rollback do arquivo gravado caso a persistência no banco falhe
    await storageService.deleteImage(storedPath).catch(() => {});
    throw err;
  }
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
