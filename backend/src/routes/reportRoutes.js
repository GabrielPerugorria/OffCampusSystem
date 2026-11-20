'use strict';
const { Router } = require('express');
const c = require('../controllers/reportController');
const { authenticate } = require('../middlewares/auth');
const { requireMember, requireFinance, requireAdmin } = require('../middlewares/authorize');
const AppError = require('../utils/AppError');

const router = Router();
router.use(authenticate, requireMember);

// Relatório executivo consolidado com balanço, ROI e faturamento: restrito à gestão financeira e diretoria
router.get('/executive', requireFinance, c.executive);

// Exportações segmentadas por perfil
function checkExportAuthorization(req, res, next) {
  const type = String(req.params.type || '').toLowerCase();
  if (type === 'financeiro') {
    return requireFinance(req, res, next);
  }
  if (type === 'auditoria') {
    return requireAdmin(req, res, next);
  }
  return next();
}

router.get('/export/:type', checkExportAuthorization, c.exportCsv);

module.exports = router;
