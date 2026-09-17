'use strict';
const db = require('../config/db');
const AppError = require('../utils/AppError');

const shape = c => ({
  id: c.id, name: c.name, roleTitle: c.role_title, email: c.email, phone: c.phone,
  category: c.category, fee: Number(c.fee), notes: c.notes,
});

async function list(organizationId, { search } = {}) {
  const params = [organizationId];
  let where = 'WHERE organization_id = ?';
  if (search) {
    where += ' AND (name LIKE ? OR role_title LIKE ? OR category LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const rows = await db.query(`SELECT * FROM contacts ${where} ORDER BY category, name`, params);
  return rows.map(shape);
}

async function getOwned(id, organizationId) {
  const row = await db.queryOne(
    'SELECT * FROM contacts WHERE id = ? AND organization_id = ? LIMIT 1', [id, organizationId]
  );
  if (!row) throw AppError.notFound('Contato não encontrado.');
  return row;
}

async function create(organizationId, data) {
  const r = await db.query(
    `INSERT INTO contacts (organization_id, name, role_title, email, phone, category, fee, notes)
     VALUES (?,?,?,?,?,?,?,?)`,
    [organizationId, data.name, data.roleTitle || null, data.email || null,
     data.phone || null, data.category, data.fee, data.notes || null]
  );
  return shape(await getOwned(r.insertId, organizationId));
}

const FIELDS = {
  name: 'name', roleTitle: 'role_title', email: 'email', phone: 'phone',
  category: 'category', fee: 'fee', notes: 'notes',
};

async function update(id, organizationId, data) {
  await getOwned(id, organizationId);
  const sets = []; const params = [];
  for (const [k, col] of Object.entries(FIELDS)) {
    if (data[k] !== undefined) { sets.push(`${col} = ?`); params.push(data[k]); }
  }
  if (sets.length) { params.push(id); await db.query(`UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`, params); }
  return shape(await getOwned(id, organizationId));
}

async function remove(id, organizationId) {
  const c = await getOwned(id, organizationId);
  await db.query('DELETE FROM contacts WHERE id = ?', [id]);
  return shape(c);
}

module.exports = { list, create, update, remove };
