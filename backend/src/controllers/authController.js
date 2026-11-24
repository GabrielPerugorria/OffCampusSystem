'use strict';
const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { recordAudit } = require('../middlewares/audit');

exports.register = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;
  const result = await authService.register(req.body, { ipAddress, userAgent });
  return created(res, result);
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const result = await authService.verifyEmail({
    challengeToken: req.body.challengeToken,
    code: req.body.code,
    ipAddress,
  });
  return ok(res, result);
});

exports.resendVerificationCode = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const result = await authService.resendVerificationCode({
    challengeToken: req.body.challengeToken,
    ipAddress,
  });
  return ok(res, result);
});

exports.login = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;
  const result = await authService.login(req.body.email, req.body.password, { ipAddress, userAgent });
  return ok(res, result);
});

exports.verifyLoginCode = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;
  const result = await authService.verifyLoginCode({
    challengeToken: req.body.challengeToken,
    code: req.body.code,
    ipAddress,
    userAgent,
  });
  return ok(res, result);
});

exports.resendLoginCode = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;
  const result = await authService.resendLoginCode({
    challengeToken: req.body.challengeToken,
    ipAddress,
    userAgent,
  });
  return ok(res, result);
});

exports.verifyAdminCode = exports.verifyLoginCode;
exports.resendAdminCode = exports.resendLoginCode;

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
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const user = await authService.updateMe(req.user.id, req.body, { ipAddress });
  await recordAudit(req, 'Atualizou o próprio perfil', 'user', req.user.id);
  return ok(res, user);
});

exports.changePassword = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const result = await authService.changePassword(req.user.id, req.body, { ipAddress });
  await recordAudit(req, 'Alterou a própria senha', 'user', req.user.id);
  return ok(res, result);
});

exports.requestEmailChange = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;
  const result = await authService.requestEmailChange(req.user.id, req.body, { ipAddress, userAgent });
  await recordAudit(req, 'Solicitou alteração de e-mail', 'user', req.user.id);
  return ok(res, result);
});

exports.confirmEmailChange = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const result = await authService.confirmEmailChange(req.user.id, req.body, { ipAddress });
  await recordAudit(req, 'Confirmou alteração de e-mail', 'user', req.user.id);
  return ok(res, result);
});

exports.revokeAllSessions = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || null;
  const result = await authService.revokeAllSessions(req.user.id, req.body.currentPassword, { ipAddress });
  await recordAudit(req, 'Revogou todas as sessões ativas', 'user', req.user.id);
  return ok(res, result);
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
