'use strict';
const { Router } = require('express');
const c = require('../controllers/analyticsController');
const { authenticate } = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/authorize');

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', c.auditLogs);

module.exports = router;
