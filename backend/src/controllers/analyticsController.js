'use strict';
const analytics = require('../services/analyticsService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

exports.dashboard = asyncHandler(async (req, res) =>
  ok(res, await analytics.dashboard(req.user.organizationId)));

exports.goals = asyncHandler(async (req, res) =>
  ok(res, await analytics.goals(req.user.organizationId)));

exports.comparison = asyncHandler(async (req, res) =>
  ok(res, await analytics.comparison(req.user.organizationId)));

exports.unitEconomics = asyncHandler(async (req, res) =>
  ok(res, await analytics.unitEconomics(req.user.organizationId, req.query)));

exports.auditLogs = asyncHandler(async (req, res) =>
  ok(res, await auditService.list(req.user.organizationId, req.query)));
