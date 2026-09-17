'use strict';
const contactService = require('../services/contactService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { recordAudit } = require('../middlewares/audit');

exports.list = asyncHandler(async (req, res) =>
  ok(res, await contactService.list(req.user.organizationId, req.query)));

exports.create = asyncHandler(async (req, res) => {
  const contact = await contactService.create(req.user.organizationId, req.body);
  await recordAudit(req, `Adicionou o contato "${contact.name}"`, 'contact', contact.id);
  return created(res, contact);
});

exports.update = asyncHandler(async (req, res) => {
  const contact = await contactService.update(req.params.id, req.user.organizationId, req.body);
  await recordAudit(req, `Editou o contato "${contact.name}"`, 'contact', contact.id);
  return ok(res, contact);
});

exports.remove = asyncHandler(async (req, res) => {
  const contact = await contactService.remove(req.params.id, req.user.organizationId);
  await recordAudit(req, `Removeu o contato "${contact.name}"`, 'contact', contact.id);
  return ok(res, { id: contact.id, message: 'Contato removido.' });
});
