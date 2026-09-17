'use strict';
const checkinService = require('../services/checkinService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { recordAudit } = require('../middlewares/audit');

exports.create = asyncHandler(async (req, res) => {
  const result = await checkinService.checkIn(req.body, req.user);
  await recordAudit(
    req,
    result.method === 'code'
      ? `Check-in do código ${result.code} — ${result.eventName}`
      : `Check-in manual de "${result.guestName}" — ${result.eventName}`,
    'checkin', result.id
  );
  return created(res, result);
});

exports.validate = asyncHandler(async (req, res) =>
  ok(res, await checkinService.validateCode(String(req.params.code).toUpperCase(), req.user.organizationId)));

exports.list = asyncHandler(async (req, res) =>
  ok(res, await checkinService.list(req.user.organizationId, req.query)));

exports.heatmap = asyncHandler(async (req, res) =>
  ok(res, await checkinService.heatmap(req.user.organizationId, req.query.eventId)));
