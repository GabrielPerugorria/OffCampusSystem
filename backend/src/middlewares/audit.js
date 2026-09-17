'use strict';
const db = require('../config/db');
const logger = require('../utils/logger');

// Registro de auditoria (substitui STATE.auditLog do localStorage).
// Nunca deve derrubar a requisição principal.
async function recordAudit(req, action, entity = null, entityId = null) {
  try {
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
  } catch (err) {
    logger.warn('Falha ao gravar auditoria:', err.message);
  }
}

module.exports = { recordAudit };
