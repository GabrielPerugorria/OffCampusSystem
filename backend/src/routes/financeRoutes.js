'use strict';
const { Router } = require('express');
const c = require('../controllers/financeController');
const { authenticate } = require('../middlewares/auth');
const { requireFinance } = require('../middlewares/authorize');

const router = Router();
router.use(authenticate, requireFinance);

router.get('/summary',    c.summary);
router.get('/categories', c.listCategories);

module.exports = router;
