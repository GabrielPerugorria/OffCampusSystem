'use strict';
const AppError = require('../utils/AppError');

// Hierarquia de papéis dentro da organização.
const HIERARCHY = { owner: 4, admin: 3, finance: 2, bar: 2, gate: 1 };

// Exige vínculo ativo com uma organização e, opcionalmente, um dos papéis.
function requireOrgRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (req.user.role === 'platform_admin') return next();   // suporte da plataforma
    if (!req.user.organizationId) {
      return next(AppError.forbidden('Sua conta não está vinculada a nenhum produtor.'));
    }
    if (allowed.length && !allowed.includes(req.user.orgRole)) {
      return next(AppError.forbidden('Seu perfil não permite esta ação.'));
    }
    return next();
  };
}

// Qualquer membro ativo (inclusive portaria) — usado em leituras.
const requireMember = requireOrgRole();

// Atalhos por módulo, espelhando os perfis do painel.
const requireAdmin   = requireOrgRole('owner', 'admin');
const requireOwner   = requireOrgRole('owner');
const requireFinance = requireOrgRole('owner', 'admin', 'finance');
const requireGate    = requireOrgRole('owner', 'admin', 'gate');
const requireBar     = requireOrgRole('owner', 'admin', 'bar');

function atLeast(role) {
  return (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (req.user.role === 'platform_admin') return next();
    if ((HIERARCHY[req.user.orgRole] || 0) >= (HIERARCHY[role] || 0)) return next();
    return next(AppError.forbidden('Seu perfil não permite esta ação.'));
  };
}

module.exports = {
  requireOrgRole, requireMember, requireAdmin, requireOwner,
  requireFinance, requireGate, requireBar, atLeast,
};
