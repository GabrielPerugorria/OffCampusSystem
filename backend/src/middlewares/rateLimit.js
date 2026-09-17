'use strict';
const rateLimit = require('express-rate-limit');

const json = (message) => ({
  success: false,
  error: { code: 'RATE_LIMITED', message },
});

// Geral: protege a API de abuso.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: json('Muitas requisições. Tente novamente em alguns minutos.'),
});

// Login/cadastro: freia força bruta de senha.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: json('Muitas tentativas de autenticação. Aguarde 15 minutos.'),
});

module.exports = { apiLimiter, authLimiter };
