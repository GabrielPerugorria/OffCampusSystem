'use strict';
const { Router } = require('express');
const c = require('../controllers/analyticsController');
const { authenticate } = require('../middlewares/auth');
const { requireMember } = require('../middlewares/authorize');

const router = Router();
router.use(authenticate, requireMember);

router.get('/', c.dashboard);

module.exports = router;
