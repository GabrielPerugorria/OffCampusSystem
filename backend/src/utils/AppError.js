'use strict';

// Erro de aplicação: tudo que o cliente pode ver. Qualquer outro erro
// vira 500 genérico no errorHandler (não vazamos stack nem SQL).
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(msg, details)  { return new AppError(msg, 400, 'BAD_REQUEST', details); }
  static unauthorized(msg = 'Não autenticado.')  { return new AppError(msg, 401, 'UNAUTHORIZED'); }
  static forbidden(msg = 'Sem permissão para esta ação.') { return new AppError(msg, 403, 'FORBIDDEN'); }
  static notFound(msg = 'Recurso não encontrado.')        { return new AppError(msg, 404, 'NOT_FOUND'); }
  static conflict(msg, details)    { return new AppError(msg, 409, 'CONFLICT', details); }
  static unprocessable(msg, details) { return new AppError(msg, 422, 'VALIDATION_ERROR', details); }
}

module.exports = AppError;
