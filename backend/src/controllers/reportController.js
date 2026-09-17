'use strict';
const reportService = require('../services/reportService');
const asyncHandler = require('../utils/asyncHandler');
const { recordAudit } = require('../middlewares/audit');

function sendFile(res, filename, extension, mime, content) {
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', `${mime}; charset=utf-8`);
  res.setHeader('Content-Disposition', `attachment; filename="evotech-${filename}-${date}.${extension}"`);
  return res.status(200).send(content);
}

exports.exportCsv = asyncHandler(async (req, res) => {
  const { filename, csv } = await reportService.exportCsv(req.user.organizationId, req.params.type);
  await recordAudit(req, `Exportou o relatório "${filename}" em CSV`, 'report', null);
  return sendFile(res, filename, 'csv', 'text/csv', csv);
});

exports.executive = asyncHandler(async (req, res) => {
  const { filename, text } = await reportService.executive(
    req.user.organizationId, req.user.organizationName || 'EvoTech Events'
  );
  await recordAudit(req, 'Gerou o relatório executivo', 'report', null);
  return sendFile(res, filename, 'txt', 'text/plain', text);
});
