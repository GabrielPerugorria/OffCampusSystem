'use strict';
const { Router } = require('express');
const c = require('../controllers/orderController');
const validate = require('../middlewares/validate');
const { authenticate, optionalAuth } = require('../middlewares/auth');
const { requireFinance } = require('../middlewares/authorize');
const s = require('../validators/schemas');

const router = Router();

// Gestão de pedidos (produtor)
router.get('/', authenticate, requireFinance, validate(s.listQuery, 'query'), c.list);
router.get('/:id', authenticate, requireFinance, validate(s.idParam, 'params'), c.getOne);

// Compra: funciona logado ou não. O preço e a disponibilidade vêm do banco.
router.post('/', optionalAuth, validate(s.orderSchema), c.create);

// Confirmação manual de pedido (apenas produtor autorizado)
router.post('/:id/confirm', authenticate, requireFinance, validate(s.idParam, 'params'), c.confirm);

// Cancelamento de pedido (produtor autorizado ou o próprio comprador)
router.post('/:id/cancel', authenticate, validate(s.idParam, 'params'), c.cancel);

module.exports = router;
