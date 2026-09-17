'use strict';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const shape = m => ({
  id: m.id, userId: m.user_id, name: m.name, email: m.email,
  role: m.role, status: m.status, createdAt: m.created_at,
});

async function list(organizationId, { search } = {}) {
  const params = [organizationId];
  let where = 'WHERE om.organization_id = ?';
  if (search) { where += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  const rows = await db.query(
    `SELECT om.id, om.user_id, om.role, om.status, om.created_at, u.name, u.email
       FROM organization_members om JOIN users u ON u.id = om.user_id
       ${where}
      ORDER BY FIELD(om.role,'owner','admin','finance','bar','gate'), u.name`,
    params
  );
  return rows.map(shape);
}

// Adiciona membro: cria o usuário se ainda não existir.
// Sem senha informada, gera uma temporária que precisa ser trocada.
async function create(organizationId, data) {
  let user = await db.queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [data.email]);
  let temporaryPassword = null;

  if (!user) {
    temporaryPassword = data.password || crypto.randomBytes(6).toString('base64url');
    const hash = await bcrypt.hash(temporaryPassword, env.bcryptRounds);
    const r = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?,?,?)',
      [data.name, data.email, hash]
    );
    user = { id: r.insertId };
  }

  const existing = await db.queryOne(
    'SELECT id FROM organization_members WHERE organization_id = ? AND user_id = ?',
    [organizationId, user.id]
  );
  if (existing) throw AppError.conflict('Esta pessoa já faz parte da equipe.');

  const r = await db.query(
    'INSERT INTO organization_members (organization_id, user_id, role, status) VALUES (?,?,?,?)',
    [organizationId, user.id, data.role, data.status]
  );
  const member = (await list(organizationId)).find(m => m.id === r.insertId);
  // A senha temporária é devolvida UMA vez, para o gestor repassar.
  return { ...member, temporaryPassword };
}

async function getOwned(memberId, organizationId) {
  const row = await db.queryOne(
    `SELECT om.*, u.name FROM organization_members om JOIN users u ON u.id = om.user_id
      WHERE om.id = ? AND om.organization_id = ? LIMIT 1`,
    [memberId, organizationId]
  );
  if (!row) throw AppError.notFound('Membro não encontrado.');
  return row;
}

async function update(memberId, organizationId, data) {
  const member = await getOwned(memberId, organizationId);
  // A organização não pode ficar sem dono.
  if (member.role === 'owner' && (data.role && data.role !== 'owner' || data.status === 'inactive')) {
    const owners = await db.queryOne(
      `SELECT COUNT(*) AS n FROM organization_members
        WHERE organization_id = ? AND role = 'owner' AND status = 'active'`,
      [organizationId]
    );
    if (Number(owners.n) <= 1) throw AppError.conflict('A organização precisa de ao menos um owner ativo.');
  }
  const sets = []; const params = [];
  if (data.role)   { sets.push('role = ?');   params.push(data.role); }
  if (data.status) { sets.push('status = ?'); params.push(data.status); }
  if (sets.length) {
    params.push(memberId);
    await db.query(`UPDATE organization_members SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return shape(await getOwned(memberId, organizationId));
}

async function remove(memberId, organizationId) {
  const member = await getOwned(memberId, organizationId);
  if (member.role === 'owner') throw AppError.conflict('O owner não pode ser removido da equipe.');
  // Remove só o vínculo; a conta do usuário continua existindo.
  await db.query('DELETE FROM organization_members WHERE id = ?', [memberId]);
  return { id: memberId, name: member.name };
}

module.exports = { list, create, update, remove };
