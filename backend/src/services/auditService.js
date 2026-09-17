'use strict';
const db = require('../config/db');

async function list(organizationId, { limit = 200 } = {}) {
  const rows = await db.query(
    `SELECT id, user_name, action, entity, entity_id, created_at
       FROM audit_logs WHERE organization_id = ?
      ORDER BY created_at DESC, id DESC LIMIT ${Number(limit)}`,
    [organizationId]
  );
  return rows.map(r => ({
    id: r.id,
    usuario: r.user_name || 'Sistema',
    acao: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    hora: r.created_at,
  }));
}

module.exports = { list };
