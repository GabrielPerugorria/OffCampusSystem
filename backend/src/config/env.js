'use strict';
const fs = require('fs');
const path = require('path');

// Diretório base do backend ('.../backend')
const backendDir = path.resolve(__dirname, '../../');

// Garante carregamento absoluto do backend/.env independente do diretório de execução
const envFile = path.resolve(backendDir, '.env');
if (fs.existsSync(envFile)) {
  require('dotenv').config({ path: envFile });
} else {
  const cwdEnv = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(cwdEnv)) {
    require('dotenv').config({ path: cwdEnv });
  }
}

function parseDbUrl(urlStr) {
  if (!urlStr) return {};
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname ? decodeURIComponent(parsed.pathname.replace(/^\//, '')) : undefined,
    };
  } catch (err) {
    throw new Error(`URL de conexão MySQL inválida: ${err.message}`);
  }
}

function required(key, fallback) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Variável de ambiente obrigatória ausente: ${key}. Verifique o arquivo .env.`);
  }
  return value;
}

function resolveSslCaPath() {
  const customPath = process.env.DB_SSL_CA;
  const defaultPath = path.resolve(backendDir, 'src/certs/ca.pem');

  if (!customPath) {
    return defaultPath;
  }

  if (path.isAbsolute(customPath)) {
    return customPath;
  }

  // Remove o prefixo 'backend/' se houver para evitar duplicação no caminho
  const cleanPath = customPath.replace(/^backend[\/\\]/, '');
  return path.resolve(backendDir, cleanPath);
}

const dbUrl = parseDbUrl(process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_PRIVATE_URL);
const dbPortValue = process.env.DB_PORT || process.env.MYSQLPORT || dbUrl.port || 3306;
const dbPort = Number(dbPortValue);

if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
  throw new Error(`Porta do banco inválida: "${dbPortValue}". Informe um número inteiro entre 1 e 65535.`);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3333),

  db: {
    host: required('DB_HOST', process.env.MYSQLHOST || dbUrl.host),
    port: dbPort,
    user: required('DB_USER', process.env.MYSQLUSER || dbUrl.user),
    password: required('DB_PASSWORD', process.env.MYSQLPASSWORD ?? dbUrl.password),
    database: required('DB_NAME', process.env.MYSQLDATABASE || dbUrl.database),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    ssl: ['true', '1'].includes(String(process.env.DB_SSL || '').toLowerCase()),
    sslCaPath: resolveSslCaPath(),
    sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    issuer: process.env.JWT_ISSUER || 'offcampussystem',
    audience: process.env.JWT_AUDIENCE || 'offcampus-client',
    refreshSecret: required('REFRESH_SECRET'),
    refreshExpiresDays: Number(process.env.REFRESH_EXPIRES_DAYS || 30),
  },

  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),

  corsOrigins: (process.env.CORS_ORIGINS || process.env.ORIGENS_CORS || '')
    .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean),

  autoConfirmOrders: String(process.env.AUTO_CONFIRM_ORDERS || 'false') === 'true',

  bootstrap: {
    adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL || '',
    adminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD || '',
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET || '',
    from: process.env.EMAIL_FROM || process.env['E-MAIL_DE'] || process.env.EMAIL_DE || 'EvoTech Events <onboarding@resend.dev>',
  },
  frontendUrl: (process.env.FRONTEND_URL || process.env.URL_FRONTEND || 'https://gabrielperugorria.github.io/OffCampusSystem').replace(/\/+$/, ''),
};

if (!process.env.CORS_ORIGINS && process.env.ORIGENS_CORS) {
  console.warn('[ENV] Aviso: usando alias legado ORIGENS_CORS. Migre para CORS_ORIGINS.');
}
if (!process.env.EMAIL_FROM && (process.env['E-MAIL_DE'] || process.env.EMAIL_DE)) {
  console.warn('[ENV] Aviso: usando alias legado E-MAIL_DE/EMAIL_DE. Migre para EMAIL_FROM.');
}
if (!process.env.FRONTEND_URL && process.env.URL_FRONTEND) {
  console.warn('[ENV] Aviso: usando alias legado URL_FRONTEND. Migre para FRONTEND_URL.');
}

env.isProduction = env.nodeEnv === 'production';

if (env.isProduction && env.jwt.secret.startsWith('dev_only')) {
  throw new Error('JWT_SECRET de desenvolvimento detectado em produção. Gere um novo segredo.');
}

// JWT_SECRET deve ter no mínimo 32 bytes de entropia (64 hex chars).
// Em desenvolvimento, aceita chaves mais curtas para conveniência.
if (env.isProduction && env.jwt.secret.length < 64) {
  throw new Error(
    'JWT_SECRET muito curto para produção. ' +
    'Use pelo menos 64 caracteres hexadecimais (32 bytes). ' +
    'Gere com: openssl rand -hex 32'
  );
}

if (env.isProduction && !env.corsOrigins.length) {
  throw new Error(
    'CORS_ORIGINS não configurado para produção. ' +
    'Defina os domínios permitidos separados por vírgula.'
  );
}

if (env.isProduction && env.autoConfirmOrders) {
  throw new Error('AUTO_CONFIRM_ORDERS=true é proibido em produção. Remova ou defina false.');
}

module.exports = env;
