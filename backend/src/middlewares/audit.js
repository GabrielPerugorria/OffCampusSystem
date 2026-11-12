'use strict';
const db = require('../config/db');
const logger = require('../utils/logger');

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'authorization',
  'credit_card',
  'card_number',
  'cvv',
]);

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/Bearer\s+[A-Za-z0-9\-_.]{10,}/gi, 'Bearer [REDACTED]')
    .replace(/(password|senha|secret|token|refreshToken|accessToken)\s*[:=]\s*["']?[^"'\s,}]+["']?/gi, '$1=[REDACTED]');
}

/**
 * Sanitiza recursivamente objetos e strings para evitar vazamento de credenciais em logs de auditoria.
 */
function sanitizeAuditData(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return sanitizeString(data);
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeAuditData);

  const clean = {};
  for (const [key, val] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeAuditData(val);
    } else if (typeof val === 'string') {
      clean[key] = sanitizeString(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

// Registro de auditoria seguro.
// Sanitiza dados confidenciais e nunca deve derrubar a requisição principal.
async function recordAudit(req, action, entity = null, entityId = null, details = null) {
  try {
    const sanitizedDetails = details ? JSON.stringify(sanitizeAuditData(details)) : null;

    // Tenta gravar com a coluna details se disponível, fallback para schema padrão
    try {
      await db.query(
        `INSERT INTO audit_logs
           (organization_id, user_id, user_name, action, entity, entity_id, ip_address, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user?.organizationId ?? null,
          req.user?.id ?? null,
          req.user?.name ?? null,
          action,
          entity,
          entityId,
          (req.ip || '').slice(0, 45),
          sanitizedDetails,
        ]
      );
    } catch (insertErr) {
      // Se a coluna details não existir na tabela atual do banco, grava sem ela
      if (insertErr.code === 'ER_BAD_FIELD_ERROR') {
        await db.query(
          `INSERT INTO audit_logs
             (organization_id, user_id, user_name, action, entity, entity_id, ip_address)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user?.organizationId ?? null,
            req.user?.id ?? null,
            req.user?.name ?? null,
            action,
            entity,
            entityId,
            (req.ip || '').slice(0, 45),
          ]
        );
      } else {
        throw insertErr;
      }
    }
  } catch (err) {
    logger.warn('Falha ao gravar auditoria:', err.message);
  }
}

module.exports = { recordAudit, sanitizeAuditData };
