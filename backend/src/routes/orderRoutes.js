'use strict';
const { Router } = require('express');
const c = require('../controllers/orderController');
const validate = require('../middlewares/validate');
const { authenticate, optionalAuth } = require('../middlewares/auth');
const { requireFinance } = require('../middlewares/authorize');
const s = require('../validators/schemas');

const router = Router();

// Compra: funciona logado ou não. O preço e a disponibilidade vêm do banco.
router.post('/', optionalAuth, validate(s.orderSchema), c.create);
router.post('/:id/confirm', authenticate, requireFinance, validate(s.idParam, 'params'), c.confirm);

module.exports = router;
