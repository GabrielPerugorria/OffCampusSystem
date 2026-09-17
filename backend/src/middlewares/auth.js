'use strict';
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/AppError');

// Extrai e valida o Bearer token. Popula req.user com dados vindos do TOKEN
// e da base — nunca do corpo da requisição.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw AppError.unauthorized('Token ausente.');

    let payload;
    try {
      payload = jwt.verify(token, env.jwt.secret);
    } catch (err) {
      throw AppError.unauthorized(
        err.name === 'TokenExpiredError' ? 'Sessão expirada.' : 'Token inválido.'
      );
    }

    const user = await db.queryOne(
      'SELECT id, name, email, role, status FROM users WHERE id = ? LIMIT 1',
      [payload.sub]
    );
    if (!user) throw AppError.unauthorized('Usuário não encontrado.');
    if (user.status === 'blocked') throw AppError.forbidden('Conta bloqueada.');

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
