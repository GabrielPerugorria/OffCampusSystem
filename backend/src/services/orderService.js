'use strict';
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { generateTicketCode } = require('../utils/ticketCode');
const { runMigrations } = require('../database/runMigrations');

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Emite ingressos para um pedido pago dentro da transação ativa.
 * Incrementa quantity_sold no lote e atualiza o status do evento quando esgotado.
 */
async function _emitTickets(conn, { orderId, batchId, eventId, eventName, batchName,
  quantity, unitPrice, holderName, holderEmail, holderCpf }) {
  const tickets = [];

  for (let i = 0; i < quantity; i += 1) {
    let inserted = false;
    let attempts = 0;
    while (!inserted && attempts < 5) {
      attempts += 1;
      const code = generateTicketCode(eventName, batchName);
      try {
        const [tr] = await conn.execute(
          `INSERT INTO tickets
             (order_id, batch_id, event_id, code, holder_name, holder_email, holder_cpf, price_paid)
           VALUES (?,?,?,?,?,?,?,?)`,
          [orderId, batchId, eventId, code, holderName, holderEmail, holderCpf, unitPrice]
        );
        tickets.push({ id: tr.insertId, code });
        inserted = true;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') throw err;
      }
    }
    if (!inserted) throw new AppError('Falha ao gerar código do ingresso.', 500, 'CODE_COLLISION');
  }

  // Incrementa quantity_sold
  await conn.execute(
    'UPDATE ticket_batches SET quantity_sold = quantity_sold + ? WHERE id = ?',
    [quantity, batchId]
  );

  // Marca o evento como esgotado quando todos os lotes ativos zeram a disponibilidade
  const [remain] = await conn.execute(
    `SELECT COALESCE(SUM(quantity_total - quantity_sold), 0) AS left_qty
       FROM ticket_batches WHERE event_id = ? AND status = 'active'`,
    [eventId]
  );
  if (Number(remain[0].left_qty) <= 0) {
    await conn.execute(
      `UPDATE events SET status = 'sold_out' WHERE id = ? AND status = 'active'`,
      [eventId]
    );
  }

  return tickets;
}

/**
 * Libera reservas pendentes expiradas de forma atômica.
 * Chamado automaticamente antes de verificar disponibilidade ou sob demanda.
 */
async function releaseExpiredReservations() {
  await runMigrations();
  return db.transaction(async (conn) => {
    const [expiredOrders] = await conn.execute(
      `SELECT id FROM orders
        WHERE status = 'pending'
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
        FOR UPDATE`
    );

    let releasedCount = 0;
    for (const order of expiredOrders) {
      const [items] = await conn.execute(
        `SELECT batch_id, quantity FROM order_items WHERE order_id = ?`,
        [order.id]
      );

      for (const item of items) {
        await conn.execute(
          `UPDATE ticket_batches
              SET quantity_reserved = GREATEST(0, CAST(quantity_reserved AS SIGNED) - ?)
            WHERE id = ?`,
          [item.quantity, item.batch_id]
        );
      }

      await conn.execute(
        `UPDATE orders
            SET status = 'cancelled',
                cancellation_reason = 'Tempo de reserva expirado',
                cancelled_at = NOW()
          WHERE id = ?`,
        [order.id]
      );
      releasedCount += 1;
    }

    return releasedCount;
  });
}

// ---------------------------------------------------------------------------
// createOrder — compra de ingresso com reserva atômica
// ---------------------------------------------------------------------------

async function createOrder(data, user) {
  await runMigrations();

  // Libera previamente qualquer reserva já expirada para devolver os ingressos ao estoque
  try {
    await releaseExpiredReservations();
  } catch {
    // Não interrompe o fluxo caso a limpeza falhe
  }

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

    // Verifica disponibilidade real no lote considerando vendas e reservas ativas
    const reserved = Number(batch.quantity_reserved || 0);
    const available = Number(batch.quantity_total) - Number(batch.quantity_sold) - reserved;
    if (available < data.quantity) {
      throw AppError.conflict(
        available <= 0
          ? 'Lote esgotado ou temporariamente reservado por outros compradores.'
          : `Restam apenas ${available} ingresso(s) disponíveis neste lote.`
      );
    }

    // Verifica capacidade total do evento (se definida) considerando vendidos e reservados
    if (Number(batch.capacity) > 0) {
      const [capRow] = await conn.execute(
        `SELECT COALESCE(SUM(quantity_sold + COALESCE(quantity_reserved, 0)), 0) AS committed_total
           FROM ticket_batches WHERE event_id = ?`,
        [batch.event_id]
      );
      const committedTotal = Number(capRow[0].committed_total);
      if (committedTotal + data.quantity > Number(batch.capacity)) {
        throw AppError.conflict(
          `Capacidade total do evento atingida. Restam apenas ${Math.max(0, Number(batch.capacity) - committedTotal)} vaga(s).`
        );
      }
    }

    const unitPrice = Number(batch.price);
    const total = unitPrice * data.quantity;
    const paid = env.autoConfirmOrders;

    // Pedidos pendentes recebem expiração de 15 minutos para pagamento
    const [orderResult] = await conn.execute(
      `INSERT INTO orders
         (event_id, user_id, buyer_name, buyer_email, buyer_cpf, total_amount,
          status, payment_method, paid_at, expires_at)
       VALUES (?,?,?,?,?,?,?,?,?, ${paid ? 'NULL' : 'DATE_ADD(NOW(), INTERVAL 15 MINUTE)'})`,
      [
        batch.event_id, user?.id || null, data.buyerName, data.buyerEmail, data.buyerCpf,
        total, paid ? 'paid' : 'pending', total > 0 ? 'pix' : 'free', paid ? new Date() : null,
      ]
    );
    const orderId = orderResult.insertId;

    // Registra o item do pedido
    await conn.execute(
      `INSERT INTO order_items (order_id, batch_id, event_id, quantity, unit_price)
       VALUES (?,?,?,?,?)`,
      [orderId, batch.id, batch.event_id, data.quantity, unitPrice]
    );

    let tickets = [];
    if (paid) {
      // Pedido pago em desenvolvimento: emite ingressos e soma quantity_sold
      tickets = await _emitTickets(conn, {
        orderId,
        batchId: batch.id,
        eventId: batch.event_id,
        eventName: batch.event_name,
        batchName: batch.name,
        quantity: data.quantity,
        unitPrice,
        holderName: data.buyerName,
        holderEmail: data.buyerEmail,
        holderCpf: data.buyerCpf,
      });
    } else {
      // Pedido pendente: reserva o estoque no lote para evitar overbooking
      await conn.execute(
        `UPDATE ticket_batches
            SET quantity_reserved = COALESCE(quantity_reserved, 0) + ?
          WHERE id = ?`,
        [data.quantity, batch.id]
      );
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

// ---------------------------------------------------------------------------
// confirmOrder — confirmação manual pelo produtor autorizado
// ---------------------------------------------------------------------------

async function confirmOrder(orderId, organizationId, confirmedByUserId) {
  await runMigrations();

  return db.transaction(async (conn) => {
    // Bloqueia o pedido para leitura consistente
    const [rows] = await conn.execute(
      `SELECT o.*, e.organization_id, e.name AS event_name, e.capacity
         FROM orders o JOIN events e ON e.id = o.event_id
        WHERE o.id = ? FOR UPDATE`,
      [orderId]
    );
    const order = rows[0];
    if (!order) throw AppError.notFound('Pedido não encontrado.');
    if (order.organization_id !== organizationId) throw AppError.forbidden('Pedido de outro produtor.');
    if (order.status === 'cancelled') throw AppError.conflict('Pedido já cancelado; não pode ser confirmado.');
    if (order.status === 'paid') throw AppError.conflict('Pedido já confirmado.');

    // Bloqueia categoricamente a confirmação de pedidos pendentes cuja reserva já expirou
    if (order.status === 'pending' && order.expires_at && new Date(order.expires_at) < new Date()) {
      // Libera eventuais reservas deste pedido expirado
      const [expiredItems] = await conn.execute(
        `SELECT batch_id, quantity FROM order_items WHERE order_id = ?`,
        [orderId]
      );
      for (const item of expiredItems) {
        await conn.execute(
          `UPDATE ticket_batches
              SET quantity_reserved = GREATEST(0, CAST(quantity_reserved AS SIGNED) - ?)
            WHERE id = ?`,
          [item.quantity, item.batch_id]
        );
      }
      await conn.execute(
        `UPDATE orders
            SET status = 'cancelled',
                cancellation_reason = 'Prazo de pagamento expirado',
                cancelled_at = NOW()
          WHERE id = ?`,
        [orderId]
      );
      throw AppError.conflict('O prazo de reserva deste pedido expirou. O pedido foi cancelado e não pode mais ser confirmado.');
    }

    // Busca os itens do pedido
    const [items] = await conn.execute(
      `SELECT oi.batch_id, oi.event_id, oi.quantity, oi.unit_price,
              b.name AS batch_name, b.quantity_total, b.quantity_sold, b.quantity_reserved,
              b.status AS batch_status,
              e.name AS event_name_b, e.capacity AS event_capacity
         FROM order_items oi
         JOIN ticket_batches b ON b.id = oi.batch_id
         JOIN events e          ON e.id = oi.event_id
        WHERE oi.order_id = ? FOR UPDATE`,
      [orderId]
    );

    let orderItems = items;
    if (orderItems.length === 0) {
      // Fallback para pedidos legados sem order_items
      const [legacyBatch] = await conn.execute(
        `SELECT b.id AS batch_id, b.event_id, b.name AS batch_name,
                b.quantity_total, b.quantity_sold, b.quantity_reserved, b.status AS batch_status,
                b.price AS unit_price,
                e.name AS event_name_b, e.capacity AS event_capacity
           FROM orders o
           JOIN ticket_batches b ON b.event_id = o.event_id
           JOIN events e         ON e.id = o.event_id
          WHERE o.id = ?
          LIMIT 1 FOR UPDATE`,
        [orderId]
      );
      if (legacyBatch[0]) {
        const qty = legacyBatch[0].unit_price > 0
          ? Math.round(Number(order.total_amount) / Number(legacyBatch[0].unit_price)) || 1
          : 1;
        orderItems = [{ ...legacyBatch[0], quantity: qty, event_id: legacyBatch[0].event_id }];
      }
    }

    if (orderItems.length === 0) {
      throw AppError.badRequest('Não foi possível determinar os itens do pedido para emissão dos ingressos.');
    }

    // Libera a reserva anterior dos lotes (se estava pendente) antes de converter em venda definitiva
    for (const item of orderItems) {
      if (item.batch_status === 'closed') {
        throw AppError.conflict(`O lote "${item.batch_name}" está fechado e não aceita mais ingressos.`);
      }
      // Se não havia reserva prévia (pedido legado), valida disponibilidade restante
      const reserved = Number(item.quantity_reserved || 0);
      const remainingWithoutReserved = Number(item.quantity_total) - Number(item.quantity_sold);
      if (remainingWithoutReserved < item.quantity) {
        throw AppError.conflict(`Não há vagas suficientes no lote "${item.batch_name}".`);
      }

      // Decrementa a reserva existente
      if (reserved > 0) {
        await conn.execute(
          `UPDATE ticket_batches
              SET quantity_reserved = GREATEST(0, CAST(quantity_reserved AS SIGNED) - ?)
            WHERE id = ?`,
          [item.quantity, item.batch_id]
        );
      }
    }

    // Atualiza o pedido para 'paid'
    await conn.execute(
      `UPDATE orders
          SET status = 'paid', paid_at = NOW(),
              confirmed_by = ?, confirmed_at = NOW(),
              expires_at = NULL
        WHERE id = ?`,
      [confirmedByUserId || null, orderId]
    );

    // Emite ingressos para cada item e soma em quantity_sold
    const allTickets = [];
    for (const item of orderItems) {
      const tks = await _emitTickets(conn, {
        orderId,
        batchId: item.batch_id,
        eventId: item.event_id,
        eventName: item.event_name_b || order.event_name,
        batchName: item.batch_name,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        holderName: order.buyer_name,
        holderEmail: order.buyer_email,
        holderCpf: order.buyer_cpf,
      });
      allTickets.push(...tks);
    }

    return { orderId, status: 'paid', tickets: allTickets };
  });
}

// ---------------------------------------------------------------------------
// cancelOrder — cancelamento de pedido com devolução correta de estoque/reserva
// ---------------------------------------------------------------------------

async function cancelOrder(orderId, { organizationId, userId, isAdmin, reason }) {
  await runMigrations();

  return db.transaction(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT o.*, e.organization_id
         FROM orders o JOIN events e ON e.id = o.event_id
        WHERE o.id = ? FOR UPDATE`,
      [orderId]
    );
    const order = rows[0];
    if (!order) throw AppError.notFound('Pedido não encontrado.');

    // Administrador deve pertencer à organização do evento
    if (isAdmin && order.organization_id !== organizationId) {
      throw AppError.forbidden('Pedido de outro produtor.');
    }

    // Usuário comum só pode cancelar o próprio pedido pendente
    if (!isAdmin) {
      if (order.user_id !== userId) throw AppError.forbidden('Você não tem permissão para cancelar este pedido.');
      if (order.status !== 'pending') {
        throw AppError.conflict(
          order.status === 'paid'
            ? 'Pedidos já pagos não podem ser cancelados diretamente pelo comprador. Contate o organizador.'
            : 'Pedido já cancelado.'
        );
      }
    }

    if (order.status === 'cancelled') throw AppError.conflict('Pedido já está cancelado.');

    // Se estava pendente, libera a reserva no lote
    if (order.status === 'pending') {
      const [items] = await conn.execute(
        `SELECT batch_id, quantity FROM order_items WHERE order_id = ?`,
        [orderId]
      );
      for (const item of items) {
        await conn.execute(
          `UPDATE ticket_batches
              SET quantity_reserved = GREATEST(0, CAST(quantity_reserved AS SIGNED) - ?)
            WHERE id = ?`,
          [item.quantity, item.batch_id]
        );
      }
    }

    // Se estava pago, cancela os ingressos e devolve quantity_sold
    if (order.status === 'paid') {
      const [ticketRows] = await conn.execute(
        `SELECT t.id, t.batch_id, t.status FROM tickets t WHERE t.order_id = ? AND t.status = 'valid'`,
        [orderId]
      );
      for (const ticket of ticketRows) {
        await conn.execute(`UPDATE tickets SET status = 'cancelled' WHERE id = ?`, [ticket.id]);
        await conn.execute(
          `UPDATE ticket_batches SET quantity_sold = GREATEST(0, quantity_sold - 1) WHERE id = ?`,
          [ticket.batch_id]
        );
      }
      // Reativa evento caso estivesse marcado como esgotado
      if (ticketRows.length > 0) {
        await conn.execute(
          `UPDATE events SET status = 'active' WHERE id = ? AND status = 'sold_out'`,
          [order.event_id]
        );
      }
    }

    const cancellationReason = reason || (isAdmin ? 'Cancelado pelo organizador' : 'Cancelado pelo comprador');

    await conn.execute(
      `UPDATE orders
          SET status = 'cancelled',
              cancelled_by = ?,
              cancelled_at = NOW(),
              cancellation_reason = ?
        WHERE id = ?`,
      [userId || null, cancellationReason, orderId]
    );

    return { orderId, status: 'cancelled' };
  });
}

// ---------------------------------------------------------------------------
// listTickets
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// listOrders — listagem administrativa de pedidos para a organização
// ---------------------------------------------------------------------------

async function listOrders(organizationId, { eventId, status, search, page = 1, limit = 50 } = {}) {
  await runMigrations();

  const params = [organizationId];
  let where = 'WHERE e.organization_id = ?';
  if (eventId) { where += ' AND o.event_id = ?'; params.push(eventId); }
  if (status)  { where += ' AND o.status = ?';   params.push(status); }
  if (search) {
    where += ' AND (o.buyer_name LIKE ? OR o.buyer_email LIKE ? OR o.buyer_cpf LIKE ? OR o.id = ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, Number(search) || 0);
  }
  const offset = (page - 1) * limit;

  const rows = await db.query(
    `SELECT o.id, o.event_id, o.user_id, o.buyer_name, o.buyer_email, o.buyer_cpf,
            o.total_amount, o.status, o.payment_method, o.paid_at, o.expires_at,
            o.confirmed_by, o.confirmed_at, o.cancelled_by, o.cancelled_at, o.cancellation_reason,
            o.created_at,
            e.name AS event_name,
            u_conf.name AS confirmed_by_name,
            u_canc.name AS cancelled_by_name,
            (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) AS tickets_count
       FROM orders o
       JOIN events e ON e.id = o.event_id
  LEFT JOIN users u_conf ON u_conf.id = o.confirmed_by
  LEFT JOIN users u_canc ON u_canc.id = o.cancelled_by
       ${where}
      ORDER BY o.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );

  const totalRow = await db.queryOne(
    `SELECT COUNT(*) AS total
       FROM orders o
       JOIN events e ON e.id = o.event_id
       ${where}`,
    params
  );

  return { rows, total: Number(totalRow.total), page, limit };
}

// ---------------------------------------------------------------------------
// getOrder — detalhe administrativo completo do pedido
// ---------------------------------------------------------------------------

async function getOrder(orderId, organizationId) {
  await runMigrations();

  const order = await db.queryOne(
    `SELECT o.*,
            e.name AS event_name, e.event_date, e.venue, e.organization_id,
            u_conf.name AS confirmed_by_name,
            u_canc.name AS cancelled_by_name
       FROM orders o
       JOIN events e ON e.id = o.event_id
  LEFT JOIN users u_conf ON u_conf.id = o.confirmed_by
  LEFT JOIN users u_canc ON u_canc.id = o.cancelled_by
      WHERE o.id = ? LIMIT 1`,
    [orderId]
  );

  if (!order) throw AppError.notFound('Pedido não encontrado.');
  if (order.organization_id !== organizationId) throw AppError.forbidden('Pedido de outro produtor.');

  const items = await db.query(
    `SELECT oi.id, oi.batch_id, oi.quantity, oi.unit_price,
            b.name AS batch_name
       FROM order_items oi
       JOIN ticket_batches b ON b.id = oi.batch_id
      WHERE oi.order_id = ?`,
    [orderId]
  );

  const tickets = await db.query(
    `SELECT t.id, t.code, t.holder_name, t.holder_email, t.holder_cpf,
            t.price_paid, t.status, t.issued_at,
            b.name AS batch_name,
            c.checked_in_at
       FROM tickets t
       JOIN ticket_batches b ON b.id = t.batch_id
  LEFT JOIN checkins c       ON c.ticket_id = t.id
      WHERE t.order_id = ?
      ORDER BY t.id ASC`,
    [orderId]
  );

  return {
    ...order,
    items,
    tickets,
  };
}

let _cleanupInterval = null;

function startReservationCleanupJob(intervalMs = 60000) {
  if (_cleanupInterval) return;
  _cleanupInterval = setInterval(async () => {
    try {
      const released = await releaseExpiredReservations();
      if (released > 0) {
        console.log(`[RESERVAS] ${released} reserva(s) expirada(s) liberada(s) com sucesso.`);
      }
    } catch {
      // Timer em background tolerante a falhas
    }
  }, intervalMs);
  if (_cleanupInterval && _cleanupInterval.unref) {
    _cleanupInterval.unref();
  }
}

module.exports = {
  createOrder,
  confirmOrder,
  cancelOrder,
  listOrders,
  getOrder,
  listTickets,
  releaseExpiredReservations,
  startReservationCleanupJob,
  runMigrations,
};
