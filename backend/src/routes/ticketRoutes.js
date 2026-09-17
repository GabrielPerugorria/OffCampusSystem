'use strict';
const { Router } = require('express');
const c = require('../controllers/orderController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { requireMember } = require('../middlewares/authorize');
const s = require('../validators/schemas');

const router = Router();
router.use(authenticate, requireMember);

router.get('/', validate(s.listQuery, 'query'), c.listTickets);

module.exports = router;
