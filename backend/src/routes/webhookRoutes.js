'use strict';
const { Router } = require('express');
const webhookController = require('../controllers/webhookController');

const router = Router();

// Webhook do Resend: endpoint público receptor de eventos de entrega
router.post('/resend', webhookController.handleResendWebhook);

module.exports = router;
