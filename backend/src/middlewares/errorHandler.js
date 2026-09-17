'use strict';
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const env = require('../config/env');
const { fail } = require('../utils/response');

// Traduz erros conhecidos do MySQL para mensagens seguras.
function translateDbError(err) {
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return AppError.conflict('Registro duplicado: já existe um item com esses dados.');
    case 'ER_ROW_IS_REFERENCED_2':
      return AppError.conflict('Não é possível excluir: existem registros vinculados.');
    case 'ER_NO_REFERENCED_ROW_2':
      return AppError.badRequest('Referência inválida: o registro relacionado não existe.');
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return AppError.badRequest('Operação viola uma regra do banco (quantidade inválida).');
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
      return new AppError('Banco de dados indisponível.', 503, 'DB_UNAVAILABLE');
    default:
      return null;
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof AppError)) {
    const translated = translateDbError(err);
    if (translated) error = translated;
  }

  if (err.message && err.message.startsWith('Origem não permitida pelo CORS')) {
    error = AppError.forbidden(err.message);
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) logger.error(error.message, err.stack);
    return fail(res, error.statusCode, error.code, error.message, error.details);
  }

  // Desconhecido: log completo no servidor, mensagem genérica para o cliente.
  logger.error('Erro não tratado:', err);
  return fail(
    res, 500, 'INTERNAL_ERROR',
    env.isProduction ? 'Erro interno no servidor.' : `Erro interno: ${err.message}`
  );
}

module.exports = errorHandler;
