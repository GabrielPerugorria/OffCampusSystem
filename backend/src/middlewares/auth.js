'use strict';
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const JWT_VERIFY_OPTIONS = {
  algorithms: ['HS256'],
  issuer: env.jwt.issuer,
  audience: env.jwt.audience,
};

// Extrai e valida o Bearer token. Popula req.user com dados vindos do TOKEN
// e da base — nunca do corpo da requisição.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw AppError.unauthorized('Token ausente.');

    let payload;
    try {
      payload = jwt.verify(token, env.jwt.secret, JWT_VERIFY_OPTIONS);
    } catch (err) {
      throw AppError.unauthorized(
        err.name === 'TokenExpiredError' ? 'Sessão expirada.' : 'Token inválido.'
      );
    }

    // Verificação de revogação (jti). Comportamento fail-closed:
    // se a consulta falhar por motivo diferente de "tabela inexistente",
    // recusa o token em vez de aceitá-lo silenciosamente.
    if (payload.jti) {
      try {
        const revoked = await db.queryOne(
          'SELECT 1 FROM revoked_tokens WHERE jti = ? LIMIT 1',
          [payload.jti]
        );
        if (revoked) throw AppError.unauthorized('Token revogado.');
      } catch (err) {
        // Tabela inexistente (ER_NO_SUCH_TABLE) é esperado antes da migration.
        // Qualquer outro erro de DB é tratado como falha de segurança.
        if (err instanceof AppError) throw err;
        if (err.code === 'ER_NO_SUCH_TABLE') {
          // Tabela ainda não criada — aceitar token (pré-migration).
          // Este comportamento deve ser removido após a migration de produção.
          logger.warn('[auth] Tabela revoked_tokens não existe. Verificação de revogação ignorada.');
        } else {
          logger.error('[auth] Falha ao verificar revogação do token:', err.message);
          throw new AppError(
            'Serviço de autenticação temporariamente indisponível.',
            503,
            'AUTH_SERVICE_UNAVAILABLE'
          );
        }
      }
    }

    let user;
    try {
      user = await db.queryOne(
        'SELECT id, name, email, role, status, email_verified_at, tokens_valid_after FROM users WHERE id = ? LIMIT 1',
        [payload.sub]
      );
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        user = await db.queryOne(
          'SELECT id, name, email, role, status FROM users WHERE id = ? LIMIT 1',
          [payload.sub]
        );
      } else {
        throw err;
      }
    }
    if (!user) throw AppError.unauthorized('Usuário não encontrado.');
    if (user.status === 'blocked') throw AppError.forbidden('Conta bloqueada.');

    if (user.tokens_valid_after && payload.iat) {
      const validAfterSec = Math.floor(new Date(user.tokens_valid_after).getTime() / 1000);
      if (payload.iat < validAfterSec) {
        throw AppError.unauthorized('Sessão revogada. Faça login novamente.');
      }
    }

    // Vínculo com a organização: SEMPRE relido do banco.
    const membership = await db.queryOne(
      `SELECT om.organization_id, om.role, om.status
         FROM organization_members om
        WHERE om.user_id = ? AND om.status = 'active'
        ORDER BY FIELD(om.role,'owner','admin','finance','bar','gate')
        LIMIT 1`,
      [user.id]
    );

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: membership ? membership.organization_id : null,
      orgRole: membership ? membership.role : null,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

// Rotas públicas que se comportam melhor com usuário logado (ex.: compra).
async function optionalAuth(req, res, next) {
  if (!req.headers.authorization) { req.user = null; return next(); }
  return authenticate(req, res, (err) => (err ? (req.user = null, next()) : next()));
}

module.exports = { authenticate, optionalAuth };
