'use strict';
const { Router } = require('express');
const c = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');

const router = Router();
router.use(authenticate);

router.get('/tickets', c.myTickets);
router.get('/history', c.myHistory);

module.exports = router;
