'use strict';
const env = require('./env');

// Lista branca explícita. Em dev, se CORS_ORIGINS estiver vazio, libera tudo
// para facilitar o teste local — nunca em produção.
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);            // curl, Postman, same-origin
    if (!env.corsOrigins.length && !env.isProduction) return callback(null, true);
    if (env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,   // usamos Bearer token, não cookie
  maxAge: 86400,
};

module.exports = corsOptions;
