'use strict';
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { generateTicketCode } = require('../utils/ticketCode');

// Compra de ingresso.
// Toda a operação roda em UMA transação com SELECT ... FOR UPDATE no lote:
// duas compras simultâneas do último ingresso não conseguem passar as duas.
async function createOrder(data, user) {
  return db.transaction(async (conn) => {
    const [batchRows] = await conn.execute(
      `SELECT b.*, e.id AS event_id, e.name AS event_name, e.status AS event_status,
              e.capacity, e.organization_id
         FROM ticket_batches b
         JOIN events e ON e.id = b.event_id
        WHERE b.id = ? FOR UPDATE`,
      [data.batchId]
    );
    const batch = batchRows[0];
    if (!batch) throw AppError.notFound('Lote não encontrado.');
    if (batch.status !== 'active') throw AppError.badRequest('Este lote não está disponível para venda.');
    // 'sold_out' passa por aqui de propósito: a checagem de disponibilidade
    // abaixo devolve a mensagem correta ("Lote esgotado").
    if (['draft', 'closed'].includes(batch.event_status)) {
      throw AppError.badRequest('As vendas deste evento não estão abertas.');
    }

    const now = new Date();
    if (batch.sales_start && new Date(batch.sales_start) > now) {
      throw AppError.badRequest('As vendas deste lote ainda não começaram.');
    }
    if (batch.sales_end && new Date(batch.sales_end) < now) {
      throw AppError.badRequest('As vendas deste lote já encerraram.');
    }

    const available = Number(batch.quantity_total) - Number(batch.quantity_sold);
    if (available < data.quantity) {
      throw AppError.conflict(
        available <= 0
          ? 'Lote esgotado.'
          : `Restam apenas ${available} ingresso(s) neste lote.`
      );
    }

    const unitPrice = Number(batch.price);
    const total = unitPrice * data.quantity;
    // Preço vem SEMPRE do banco. O valor enviado pelo frontend é ignorado.
    const paid = env.autoConfirmOrders;

    const [orderResult] = await conn.execute(
      `INSERT INTO orders
         (event_id, user_id, buyer_name, buyer_email, buyer_cpf, total_amount,
          status, payment_method, paid_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        batch.event_id, user?.id || null, data.buyerName, data.buyerEmail, data.buyerCpf,
        total, paid ? 'paid' : 'pending', total > 0 ? 'pix' : 'free', paid ? new Date() : null,
      ]
    );
    const orderId = orderResult.insertId;

    const tickets = [];
    if (paid) {
      for (let i = 0; i < data.quantity; i += 1) {
        // Colisão de código é praticamente impossível, mas a UNIQUE key
        // do banco é a garantia final — tentamos de novo se ocorrer.
        /* eslint-disable no-await-in-loop */
        let inserted = false;
        let attempts = 0;
        while (!inserted && attempts < 5) {
          attempts += 1;
          const code = generateTicketCode(batch.event_name, batch.name);
          try {
            const [tr] = await conn.execute(
              `INSERT INTO tickets
                 (order_id, batch_id, event_id, code, holder_name, holder_email, holder_cpf, price_paid)
               VALUES (?,?,?,?,?,?,?,?)`,
              [orderId, batch.id, batch.event_id, code, data.buyerName,
               data.buyerEmail, data.buyerCpf, unitPrice]
            );
            tickets.push({ id: tr.insertId, code });
            inserted = true;
          } catch (err) {
            if (err.code !== 'ER_DUP_ENTRY') throw err;
          }
        }
        if (!inserted) throw new AppError('Falha ao gerar código do ingresso.', 500, 'CODE_COLLISION');
      }

      await conn.execute(
        'UPDATE ticket_batches SET quantity_sold = quantity_sold + ? WHERE id = ?',
        [data.quantity, batch.id]
      );

      // Marca o evento como esgotado quando todos os lotes zeram.
      const [remain] = await conn.execute(
        `SELECT COALESCE(SUM(quantity_total - quantity_sold),0) AS left_qty
           FROM ticket_batches WHERE event_id = ? AND status = 'active'`,
        [batch.event_id]
      );
      if (Number(remain[0].left_qty) <= 0) {
        await conn.execute(
          `UPDATE events SET status = 'sold_out' WHERE id = ? AND status = 'active'`,
          [batch.event_id]
        );
      }
    }

    return {
      orderId,
      status: paid ? 'paid' : 'pending',
      eventId: batch.event_id,
      eventName: batch.event_name,
      batchName: batch.name,
      unitPrice,
      quantity: data.quantity,
      total,
      buyerName: data.buyerName,
      tickets,
    };
  });
}

// Confirmação manual/externa (gateway). Emite os ingressos de um pedido pending.
async function confirmOrder(orderId, organizationId) {
  return db.transaction(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT o.*, e.organization_id, e.name AS event_name
         FROM orders o JOIN events e ON e.id = o.event_id
        WHERE o.id = ? FOR UPDATE`, [orderId]
    );
    const order = rows[0];
    if (!order) throw AppError.notFound('Pedido não encontrado.');
    if (order.organization_id !== organizationId) throw AppError.forbidden('Pedido de outro produtor.');
    if (order.status === 'paid') throw AppError.conflict('Pedido já confirmado.');

    await conn.execute(
      `UPDATE orders SET status = 'paid', paid_at = NOW() WHERE id = ?`, [orderId]
    );
    return { orderId, status: 'paid' };
  });
}

async function listTickets(organizationId, { eventId, search, status, page = 1, limit = 50 }) {
  const params = [organizationId];
  let where = 'WHERE e.organization_id = ?';
  if (eventId) { where += ' AND t.event_id = ?'; params.push(eventId); }
  if (status)  { where += ' AND t.status = ?';   params.push(status); }
  if (search) {
    where += ' AND (t.holder_name LIKE ? OR t.code LIKE ? OR t.holder_email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const offset = (page - 1) * limit;

  const rows = await db.query(
    `SELECT t.id, t.code, t.holder_name, t.holder_email, t.status, t.price_paid, t.issued_at,
            b.name AS batch_name, e.name AS event_name, e.id AS event_id,
            c.checked_in_at
       FROM tickets t
       JOIN ticket_batches b ON b.id = t.batch_id
       JOIN events e         ON e.id = t.event_id
       JOIN orders o         ON o.id = t.order_id
  LEFT JOIN checkins c       ON c.ticket_id = t.id
       ${where}
      ORDER BY t.issued_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );
  const totalRow = await db.queryOne(
    `SELECT COUNT(*) AS total FROM tickets t JOIN events e ON e.id = t.event_id ${where}`,
    params
  );
  return { rows, total: Number(totalRow.total), page, limit };
}

module.exports = { createOrder, confirmOrder, listTickets };
