'use strict';
const AppError = require('../utils/AppError');

module.exports = (req, res, next) =>
  next(AppError.notFound(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
