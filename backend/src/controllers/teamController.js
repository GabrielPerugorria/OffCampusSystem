'use strict';
const teamService = require('../services/teamService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { recordAudit } = require('../middlewares/audit');

exports.list = asyncHandler(async (req, res) =>
  ok(res, await teamService.list(req.user.organizationId, req.query)));

exports.create = asyncHandler(async (req, res) => {
  const member = await teamService.create(req.user.organizationId, req.body);
  await recordAudit(req, `Adicionou "${member.name}" à equipe (${member.role})`, 'member', member.id);
  return created(res, member);
});

exports.update = asyncHandler(async (req, res) => {
  const member = await teamService.update(req.params.id, req.user.organizationId, req.body);
  await recordAudit(req, `Atualizou o membro "${member.name}" (${member.role}/${member.status})`, 'member', member.id);
  return ok(res, member);
});

exports.remove = asyncHandler(async (req, res) => {
  const member = await teamService.remove(req.params.id, req.user.organizationId);
  await recordAudit(req, `Removeu "${member.name}" da equipe`, 'member', member.id);
  return ok(res, { id: member.id, message: 'Membro removido.' });
});
