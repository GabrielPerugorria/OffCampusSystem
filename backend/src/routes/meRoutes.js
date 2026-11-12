'use strict';
const { Router } = require('express');
const c = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const s = require('../validators/schemas');

const router = Router();
router.use(authenticate);

router.get('/tickets', c.myTickets);
router.get('/orders', c.myOrders);
router.get('/orders/:id', validate(s.idParam, 'params'), c.myOrderDetails);
router.get('/history', c.myHistory);

module.exports = router;
