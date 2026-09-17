'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Variável de ambiente obrigatória ausente: ${key}. Veja o .env.example.`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3333),

  db: {
    host: required('DB_HOST', 'localhost'),
    port: Number(process.env.DB_PORT || 3306),
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME', 'evotech_events'),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: required('REFRESH_SECRET'),
    refreshExpiresDays: Number(process.env.REFRESH_EXPIRES_DAYS || 30),
  },

  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),

  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean),

  autoConfirmOrders: String(process.env.AUTO_CONFIRM_ORDERS || 'false') === 'true',
};

env.isProduction = env.nodeEnv === 'production';

if (env.isProduction && env.jwt.secret.startsWith('dev_only')) {
  throw new Error('JWT_SECRET de desenvolvimento detectado em produção. Gere um novo segredo.');
}

module.exports = env;
