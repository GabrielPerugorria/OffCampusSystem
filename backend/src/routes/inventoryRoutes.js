'use strict';
const { Router } = require('express');
const c = require('../controllers/inventoryController');
const { authenticate } = require('../middlewares/auth');
const { requireMember } = require('../middlewares/authorize');

const router = Router();
router.use(authenticate, requireMember);

router.get('/alerts',    c.alerts);
router.get('/movements', c.listMovements);

module.exports = router;
