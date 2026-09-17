'use strict';
const AppError = require('../utils/AppError');

// Valida body/params/query com um schema zod e SUBSTITUI o valor original
// pelo resultado tipado. Campos não declarados no schema são descartados,
// então o cliente não consegue injetar colunas extras.
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map(i => ({
        field: i.path.join('.') || source,
        message: i.message,
      }));
      return next(AppError.unprocessable('Dados inválidos.', details));
    }
    req[source] = result.data;
    return next();
  };
}

module.exports = validate;
