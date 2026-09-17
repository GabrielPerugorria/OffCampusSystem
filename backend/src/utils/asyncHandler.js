'use strict';

// Encapsula controllers async para que rejeições cheguem ao errorHandler
// sem try/catch repetido em cada função.
module.exports = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
