'use strict';
const { Router } = require('express');
const c = require('../controllers/analyticsController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { requireMember, requireOwner } = require('../middlewares/authorize');
const s = require('../validators/schemas');

const router = Router();
router.use(authenticate);

router.get('/goals',          requireMember, c.goals);
router.get('/comparison',     requireMember, c.comparison);
router.get('/unit-economics', requireOwner, validate(s.unitEconQuery, 'query'), c.unitEconomics);

module.exports = router;
