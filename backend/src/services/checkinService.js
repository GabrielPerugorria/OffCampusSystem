'use strict';
const db = require('../config/db');
const AppError = require('../utils/AppError');

// Consulta de código antes de liberar a entrada (tela da portaria).
async function validateCode(code, organizationId) {
  const ticket = await db.queryOne(
    `SELECT t.id, t.code, t.holder_name, t.status, t.event_id,
            b.name AS batch_name, e.name AS event_name, e.organization_id, e.status AS event_status,
            c.checked_in_at
       FROM tickets t
       JOIN ticket_batches b ON b.id = t.batch_id
       JOIN events e         ON e.id = t.event_id
       JOIN orders o         ON o.id = t.order_id
  LEFT JOIN checkins c       ON c.ticket_id = t.id
      WHERE t.code = ? AND o.status = 'paid'
      LIMIT 1`,
    [code]
  );
  if (!ticket) throw AppError.notFound('Ingresso não encontrado ou pagamento não confirmado.');
  if (ticket.organization_id !== organizationId) throw AppError.forbidden('Ingresso de outro produtor.');
  return ticket;
}

// Check-in real: valida o ingresso, impede reentrada e respeita a capacidade.
async function checkIn(data, user) {
  const organizationId = user.organizationId;

  // --- Entrada manual (convidado, cortesia, lista) ---
  if (!data.code) {
    const event = await db.queryOne(
      'SELECT id, name, capacity, organization_id FROM events WHERE id = ? LIMIT 1', [data.eventId]
    );
    if (!event) throw AppError.notFound('Evento não encontrado.');
    if (event.organization_id !== organizationId) throw AppError.forbidden('Evento de outro produtor.');

    const result = await db.query(
      `INSERT INTO checkins (event_id, ticket_id, guest_name, method, checked_by_user_id)
       VALUES (?, NULL, ?, 'manual', ?)`,
      [event.id, data.guestName, user.id]
    );
    return {
      id: result.insertId, method: 'manual', guestName: data.guestName,
      eventId: event.id, eventName: event.name, checkedInAt: new Date(),
    };
  }

  // --- Entrada por código ---
  return db.transaction(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT t.id, t.code, t.holder_name, t.status, t.event_id,
              e.name AS event_name, e.capacity, e.organization_id
         FROM tickets t
         JOIN events e ON e.id = t.event_id
         JOIN orders o ON o.id = t.order_id
        WHERE t.code = ? AND o.status = 'paid'
        FOR UPDATE`,
      [data.code]
    );
    const ticket = rows[0];
    if (!ticket) throw AppError.notFound(`Código "${data.code}" não corresponde a nenhum ingresso pago.`);
    if (ticket.organization_id !== organizationId) throw AppError.forbidden('Ingresso de outro produtor.');
    if (ticket.status === 'cancelled') throw AppError.conflict('Ingresso cancelado.');

    const [existing] = await conn.execute(
      'SELECT checked_in_at FROM checkins WHERE ticket_id = ? LIMIT 1', [ticket.id]
    );
    if (existing[0]) {
      const when = new Date(existing[0].checked_in_at).toLocaleString('pt-BR');
      throw AppError.conflict(`Ingresso já utilizado em ${when}.`);
    }

    if (ticket.capacity > 0) {
      const [count] = await conn.execute(
        'SELECT COUNT(*) AS n FROM checkins WHERE event_id = ?', [ticket.event_id]
      );
      if (Number(count[0].n) >= Number(ticket.capacity)) {
        throw AppError.conflict('Capacidade máxima do evento atingida.');
      }
    }

    const [result] = await conn.execute(
      `INSERT INTO checkins (event_id, ticket_id, guest_name, method, checked_by_user_id)
       VALUES (?, ?, ?, 'code', ?)`,
      [ticket.event_id, ticket.id, ticket.holder_name, user.id]
    );
    await conn.execute(`UPDATE tickets SET status = 'used' WHERE id = ?`, [ticket.id]);

    return {
      id: result.insertId, method: 'code', ticketId: ticket.id, code: ticket.code,
      guestName: ticket.holder_name, eventId: ticket.event_id,
      eventName: ticket.event_name, checkedInAt: new Date(),
    };
  });
}

async function list(organizationId, { eventId, limit = 200 } = {}) {
  const params = [organizationId];
  let where = 'WHERE e.organization_id = ?';
  if (eventId) { where += ' AND c.event_id = ?'; params.push(eventId); }

  const rows = await db.query(
    `SELECT c.id, c.guest_name, c.method, c.checked_in_at,
            t.code, e.id AS event_id, e.name AS event_name, u.name AS operator
       FROM checkins c
       JOIN events e  ON e.id = c.event_id
  LEFT JOIN tickets t ON t.id = c.ticket_id
  LEFT JOIN users u   ON u.id = c.checked_by_user_id
       ${where}
      ORDER BY c.checked_in_at DESC
      LIMIT ${Number(limit)}`,
    params
  );

  const perEvent = await db.query(
    `SELECT e.id AS event_id, e.name AS event_name, COUNT(c.id) AS total
       FROM events e LEFT JOIN checkins c ON c.event_id = e.id
      WHERE e.organization_id = ?
      GROUP BY e.id, e.name
      HAVING total > 0
      ORDER BY total DESC`,
    [organizationId]
  );

  return { rows, perEvent, total: rows.length };
}

// Heatmap de entradas por hora (painel Comparativo).
async function heatmap(organizationId, eventId) {
  const params = [organizationId];
  let where = 'WHERE e.organization_id = ?';
  if (eventId) { where += ' AND c.event_id = ?'; params.push(eventId); }

  const rows = await db.query(
    `SELECT HOUR(c.checked_in_at) AS hour, COUNT(*) AS total
       FROM checkins c JOIN events e ON e.id = c.event_id
       ${where}
      GROUP BY HOUR(c.checked_in_at)`,
    params
  );
  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0 }));
  rows.forEach(r => { buckets[Number(r.hour)].total = Number(r.total); });
  return buckets;
}

module.exports = { checkIn, validateCode, list, heatmap };
