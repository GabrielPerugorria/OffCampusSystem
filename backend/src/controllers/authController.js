'use strict';
const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { recordAudit } = require('../middlewares/audit');

exports.register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return created(res, result);
});

exports.login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password);
  return ok(res, result);
});

exports.refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  return ok(res, result);
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body?.refreshToken);
  return ok(res, { message: 'Sessão encerrada.' });
});

exports.me = asyncHandler(async (req, res) => {
  return ok(res, await authService.buildSession(req.user.id));
});

exports.updateMe = asyncHandler(async (req, res) => {
  const user = await authService.updateMe(req.user.id, req.body);
  await recordAudit(req, 'Atualizou o próprio perfil', 'user', req.user.id);
  return ok(res, user);
});

// Solicitação de recuperação de senha com link seguro (sem enumeração de e-mail)
exports.forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  return ok(res, result);
});

// Redefinição de senha com validação de token criptográfico
exports.resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body.token, req.body.password);
  return ok(res, result);
});

exports.myTickets = asyncHandler(async (req, res) =>
  ok(res, await authService.myTickets(req.user.id, req.user.email)));

exports.myOrders = asyncHandler(async (req, res) =>
  ok(res, await authService.myOrders(req.user.id, req.user.email)));

exports.myOrderDetails = asyncHandler(async (req, res) =>
  ok(res, await authService.myOrderDetails(req.params.id, req.user.id, req.user.email)));

exports.myHistory = asyncHandler(async (req, res) =>
  ok(res, await authService.myHistory(req.user.id, req.user.email)));
