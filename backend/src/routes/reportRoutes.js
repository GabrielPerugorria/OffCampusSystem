'use strict';
const { Router } = require('express');
const c = require('../controllers/reportController');
const { authenticate } = require('../middlewares/auth');
const { requireMember } = require('../middlewares/authorize');

const router = Router();
router.use(authenticate, requireMember);

router.get('/executive',   c.executive);
router.get('/export/:type', c.exportCsv);

module.exports = router;
