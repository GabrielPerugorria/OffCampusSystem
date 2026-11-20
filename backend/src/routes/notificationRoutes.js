'use strict';
const { Router } = require('express');
const { authenticate } = require('../middlewares/auth');
const { requireMember } = require('../middlewares/authorize');
const notificationController = require('../controllers/notificationController');

const router = Router();

// Todas as rotas de notificações exigem autenticação e associação a uma organização
router.use(authenticate, requireMember);

router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', notificationController.updatePreferences);
router.get('/history', notificationController.getHistory);
router.get('/metrics', notificationController.getMetrics);
router.post('/trigger-summary', notificationController.triggerSummary);

module.exports = router;
