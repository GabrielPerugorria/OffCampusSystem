'use strict';
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { uniqueSlug } = require('../utils/slug');

// Converte "2026-12-31" ou "" vindos do formulário em DATETIME ou NULL.
function parseEventDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw || /^em breve$/i.test(raw)) return null;
  const withTime = raw.length === 10 ? `${raw} 12:00:00` : raw.replace('T', ' ');
  const d = new Date(withTime.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) throw AppError.badRequest('Data do evento inválida.');
  return withTime.slice(0, 19);
}

// Um evento com seus lotes + números derivados (vendidos/receita/ocupação).
// NUNCA guardamos "vendidos" ou "receita" como coluna: sempre calculado.
const EVENT_SELECT = `
  SELECT e.*,
         (SELECT COALESCE(SUM(b.quantity_sold),0)
            FROM ticket_batches b WHERE b.event_id = e.id) AS sold,
         (SELECT COALESCE(SUM(b.quantity_sold * b.price),0)
            FROM ticket_batches b WHERE b.event_id = e.id) AS revenue,
         (SELECT COUNT(*) FROM checkins c WHERE c.event_id = e.id) AS checkins
    FROM events e`;

function shape(row, batches = []) {
  const sold = Number(row.sold || 0);
  const revenue = Number(row.revenue || 0);
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    description: row.description,
    rules: row.rules,
    venue: row.venue,
    eventDate: row.event_date,
    capacity: Number(row.capacity || 0),
    bannerUrl: row.banner_url,
    status: row.status,
    goalAttendance: Number(row.goal_attendance || 0),
    goalRevenue: Number(row.goal_revenue || 0),
    sold,
    revenue,
    checkins: Number(row.checkins || 0),
    occupancy: row.capacity > 0 ? (sold / row.capacity) * 100 : 0,
    averageTicket: sold > 0 ? revenue / sold : 0,
    batches: batches.map(shapeBatch),
    createdAt: row.created_at,
  };
}

function shapeBatch(b) {
  const total = Number(b.quantity_total || 0);
  const sold = Number(b.quantity_sold || 0);
  return {
    id: b.id,
    eventId: b.event_id,
    name: b.name,
    price: Number(b.price),
    quantityTotal: total,
    quantitySold: sold,
    available: Math.max(0, total - sold),
    salesStart: b.sales_start,
    salesEnd: b.sales_end,
    sortOrder: b.sort_order,
    status: b.status,
  };
}

async function listBatchesFor(eventIds) {
  if (!eventIds.length) return {};
  const placeholders = eventIds.map(() => '?').join(',');
  const rows = await db.query(
    `SELECT * FROM ticket_batches WHERE event_id IN (${placeholders})
      ORDER BY sort_order ASC, id ASC`, eventIds
  );
  return rows.reduce((acc, b) => {
    (acc[b.event_id] = acc[b.event_id] || []).push(b);
    return acc;
  }, {});
}

/* ---------- LEITURA ---------- */
async function listByOrganization(organizationId, { search = '' } = {}) {
  const params = [organizationId];
  let where = ' WHERE e.organization_id = ?';
  if (search) {
    where += ' AND (e.name LIKE ? OR e.venue LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  const rows = await db.query(`${EVENT_SELECT}${where} ORDER BY e.event_date IS NULL, e.event_date ASC`, params);
  const batches = await listBatchesFor(rows.map(r => r.id));
  return rows.map(r => shape(r, batches[r.id] || []));
}

// Vitrine pública: só eventos vendáveis, sem dados internos (metas, custos).
async function listPublic() {
  const rows = await db.query(
    `${EVENT_SELECT} WHERE e.status IN ('upcoming','active','sold_out')
      ORDER BY e.event_date IS NULL, e.event_date ASC`
  );
  const batches = await listBatchesFor(rows.map(r => r.id));
  return rows.map(r => {
    const ev = shape(r, (batches[r.id] || []).filter(b => b.status === 'active'));
    delete ev.goalAttendance;
    delete ev.goalRevenue;
    delete ev.revenue;
    delete ev.checkins;
    return ev;
  });
}

async function getPublicBySlug(slug) {
  const row = await db.queryOne(
    `${EVENT_SELECT} WHERE e.slug = ? AND e.status IN ('upcoming','active','sold_out') LIMIT 1`, [slug]
  );
  if (!row) throw AppError.notFound('Evento não encontrado.');
  const batches = await db.query(
    `SELECT * FROM ticket_batches WHERE event_id = ? AND status = 'active'
      ORDER BY sort_order, id`, [row.id]
  );
  const ev = shape(row, batches);
  delete ev.goalAttendance; delete ev.goalRevenue; delete ev.revenue; delete ev.checkins;
  return ev;
}

// Busca garantindo que o evento pertence à organização do token.
async function getOwned(id, organizationId) {
  const row = await db.queryOne(`${EVENT_SELECT} WHERE e.id = ? LIMIT 1`, [id]);
  if (!row) throw AppError.notFound('Evento não encontrado.');
  if (row.organization_id !== organizationId) {
    throw AppError.forbidden('Este evento pertence a outro produtor.');
  }
  const batches = await db.query(
    'SELECT * FROM ticket_batches WHERE event_id = ? ORDER BY sort_order, id', [id]
  );
  return shape(row, batches);
}

/* ---------- ESCRITA ---------- */
async function create(organizationId, data) {
  const slug = await uniqueSlug(db, 'events', data.name);
  const result = await db.query(
    `INSERT INTO events
       (organization_id, name, slug, type, description, rules, venue, event_date,
        capacity, banner_url, status, goal_attendance, goal_revenue)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      organizationId, data.name, slug, data.type || null, data.description || null,
      data.rules || null, data.venue || null, parseEventDate(data.eventDate),
      data.capacity || 0, data.bannerUrl || null, data.status || 'draft',
      data.goalAttendance ?? Math.round((data.capacity || 0) * 0.85),
      data.goalRevenue ?? 0,
    ]
  );
  return getOwned(result.insertId, organizationId);
}

const FIELD_MAP = {
  name: 'name', type: 'type', description: 'description', rules: 'rules',
  venue: 'venue', capacity: 'capacity', bannerUrl: 'banner_url', status: 'status',
  goalAttendance: 'goal_attendance', goalRevenue: 'goal_revenue',
};

async function update(id, organizationId, data) {
  await getOwned(id, organizationId);                 // valida posse
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (data[key] !== undefined) { sets.push(`${column} = ?`); params.push(data[key]); }
  }
  if (data.eventDate !== undefined) { sets.push('event_date = ?'); params.push(parseEventDate(data.eventDate)); }
  if (data.name !== undefined) {
    sets.push('slug = ?');
    params.push(await uniqueSlug(db, 'events', data.name, id));
  }
  if (!sets.length) return getOwned(id, organizationId);
  params.push(id);
  await db.query(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, params);
  return getOwned(id, organizationId);
}

async function remove(id, organizationId) {
  const event = await getOwned(id, organizationId);
  const sold = await db.queryOne(
    'SELECT COUNT(*) AS n FROM tickets WHERE event_id = ?', [id]
  );
  // Evento com ingressos emitidos não é apagado: histórico financeiro sumiria.
  if (Number(sold.n) > 0) {
    throw AppError.conflict(
      `"${event.name}" possui ${sold.n} ingresso(s) emitido(s). Use o status "Encerrado" em vez de excluir.`
    );
  }
  await db.query('DELETE FROM events WHERE id = ?', [id]);
  return event;
}

/* ---------- LOTES ---------- */
async function createBatch(eventId, organizationId, data) {
  await getOwned(eventId, organizationId);
  const result = await db.query(
    `INSERT INTO ticket_batches
       (event_id, name, price, quantity_total, quantity_sold, sales_start, sales_end, sort_order, status)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      eventId, data.name, data.price, data.quantityTotal, data.quantitySold || 0,
      data.salesStart || null, data.salesEnd || null, data.sortOrder || 0, data.status || 'active',
    ]
  );
  const row = await db.queryOne('SELECT * FROM ticket_batches WHERE id = ?', [result.insertId]);
  return shapeBatch(row);
}

async function getOwnedBatch(batchId, organizationId) {
  const row = await db.queryOne(
    `SELECT b.*, e.organization_id, e.name AS event_name
       FROM ticket_batches b JOIN events e ON e.id = b.event_id
      WHERE b.id = ? LIMIT 1`, [batchId]
  );
  if (!row) throw AppError.notFound('Lote não encontrado.');
  if (row.organization_id !== organizationId) throw AppError.forbidden('Lote de outro produtor.');
  return row;
}

const BATCH_FIELDS = {
  name: 'name', price: 'price', quantityTotal: 'quantity_total',
  salesStart: 'sales_start', salesEnd: 'sales_end', sortOrder: 'sort_order', status: 'status',
};

async function updateBatch(batchId, organizationId, data) {
  const current = await getOwnedBatch(batchId, organizationId);
  if (data.quantityTotal !== undefined && data.quantityTotal < current.quantity_sold) {
    throw AppError.badRequest(
      `O total não pode ser menor que ${current.quantity_sold} ingresso(s) já vendido(s).`
    );
  }
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(BATCH_FIELDS)) {
    if (data[key] !== undefined) { sets.push(`${column} = ?`); params.push(data[key]); }
  }
  if (!sets.length) return shapeBatch(current);
  params.push(batchId);
  await db.query(`UPDATE ticket_batches SET ${sets.join(', ')} WHERE id = ?`, params);
  return shapeBatch(await db.queryOne('SELECT * FROM ticket_batches WHERE id = ?', [batchId]));
}

// Botões ± do painel de lotes. Ajusta total/vendidos com trava de consistência.
async function adjustBatchStock(batchId, organizationId, { totalDelta = 0, soldDelta = 0 }) {
  const current = await getOwnedBatch(batchId, organizationId);
  const newTotal = Math.max(0, Number(current.quantity_total) + Number(totalDelta || 0));
  const newSold = Math.max(0, Number(current.quantity_sold) + Number(soldDelta || 0));
  if (newSold > newTotal) {
    throw AppError.badRequest('Quantidade vendida não pode ultrapassar o total do lote.');
  }
  await db.query(
    'UPDATE ticket_batches SET quantity_total = ?, quantity_sold = ? WHERE id = ?',
    [newTotal, newSold, batchId]
  );
  return shapeBatch(await db.queryOne('SELECT * FROM ticket_batches WHERE id = ?', [batchId]));
}

async function removeBatch(batchId, organizationId) {
  const batch = await getOwnedBatch(batchId, organizationId);
  const issued = await db.queryOne('SELECT COUNT(*) AS n FROM tickets WHERE batch_id = ?', [batchId]);
  if (Number(issued.n) > 0) {
    throw AppError.conflict(
      `O lote "${batch.name}" já tem ${issued.n} ingresso(s) emitido(s). Use o status "Encerrado".`
    );
  }
  await db.query('DELETE FROM ticket_batches WHERE id = ?', [batchId]);
  return shapeBatch(batch);
}

module.exports = {
  listByOrganization, listPublic, getPublicBySlug, getOwned,
  create, update, remove,
  createBatch, updateBatch, adjustBatchStock, removeBatch, getOwnedBatch,
  shape, shapeBatch, parseEventDate,
};
