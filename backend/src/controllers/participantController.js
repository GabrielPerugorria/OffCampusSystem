'use strict';
const participantService = require('../services/participantService');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { recordAudit } = require('../middlewares/audit');

exports.list = asyncHandler(async (req, res) =>
  ok(res, await participantService.list(req.user.organizationId, req.query)));

exports.setStatus = asyncHandler(async (req, res) => {
  const result = await participantService.setStatus(
    req.params.id, req.user.organizationId, req.body.status
  );
  await recordAudit(req, `Alterou o status do participante #${result.id} para ${result.status}`, 'user', result.id);
  return ok(res, result);
});
