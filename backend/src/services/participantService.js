'use strict';
const db = require('../config/db');
const AppError = require('../utils/AppError');

// Participantes = quem comprou ingresso dos eventos DESTA organização.
// Antes eram duas listas desconectadas (evo_users x STATE.participantes).
async function list(organizationId, { search, eventId, page = 1, limit = 50 } = {}) {
  const params = [organizationId];
  let where = "WHERE e.organization_id = ? AND o.status = 'paid'";
  if (eventId) { where += ' AND t.event_id = ?'; params.push(eventId); }
  if (search) {
    where += ' AND (t.holder_name LIKE ? OR t.holder_email LIKE ? OR t.holder_cpf LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const offset = (page - 1) * limit;

  const rows = await db.query(
    `SELECT MIN(t.id) AS ref_id,
            t.holder_email AS email,
            MAX(t.holder_name) AS name,
            MAX(t.holder_cpf)  AS cpf,
            MAX(u.id)      AS user_id,
            MAX(u.phone)   AS phone,
            MAX(u.status)  AS user_status,
            COUNT(t.id)    AS tickets,
            COALESCE(SUM(t.price_paid),0) AS total_spent,
            COUNT(c.id)    AS checkins
       FROM tickets t
       JOIN orders o  ON o.id = t.order_id
       JOIN events e  ON e.id = t.event_id
  LEFT JOIN users u   ON u.email = t.holder_email
  LEFT JOIN checkins c ON c.ticket_id = t.id
       ${where}
      GROUP BY t.holder_email
      ORDER BY tickets DESC, name ASC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );

  return rows.map(r => ({
    id: r.user_id,                       // null = comprou sem cadastro
    refId: r.ref_id,
    name: r.name,
    email: r.email,
    cpf: r.cpf,
    phone: r.phone,
    tickets: Number(r.tickets),
    totalSpent: Number(r.total_spent),
    checkins: Number(r.checkins),
    status: r.user_status || 'guest',
  }));
}

// Bloqueio impede login; não apaga ingressos já comprados.
async function setStatus(userId, organizationId, status) {
  const bought = await db.queryOne(
    `SELECT COUNT(*) AS n
       FROM tickets t JOIN events e ON e.id = t.event_id
       JOIN users u ON u.email = t.holder_email
      WHERE u.id = ? AND e.organization_id = ?`,
    [userId, organizationId]
  );
  // Só é possível bloquear quem comprou em eventos da sua organização.
  if (Number(bought.n) === 0) {
    throw AppError.forbidden('Este participante não pertence aos seus eventos.');
  }
  const user = await db.queryOne('SELECT id, role FROM users WHERE id = ?', [userId]);
  if (!user) throw AppError.notFound('Usuário não encontrado.');
  if (user.role === 'platform_admin') throw AppError.forbidden('Não é possível bloquear este usuário.');

  await db.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
  if (status === 'blocked') {
    await db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [userId]
    );
  }
  return { id: userId, status };
}

module.exports = { list, setStatus };
