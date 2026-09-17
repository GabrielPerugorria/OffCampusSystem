'use strict';
const db = require('../config/db');
const AppError = require('../utils/AppError');

function shape(p) {
  return {
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    category: p.category,
    unitCost: Number(p.unit_cost),
    salePrice: p.sale_price === null ? null : Number(p.sale_price),
    stockQuantity: Number(p.stock_quantity),
    minStock: Number(p.min_stock),
    status: p.status,
    low: Number(p.stock_quantity) < Number(p.min_stock),
  };
}

async function list(organizationId, { search } = {}) {
  const params = [organizationId];
  let where = "WHERE organization_id = ? AND status = 'active'";
  if (search) { where += ' AND (name LIKE ? OR category LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  const rows = await db.query(
    `SELECT * FROM products ${where} ORDER BY category, name`, params
  );
  return rows.map(shape);
}

async function getOwned(id, organizationId) {
  const row = await db.queryOne(
    'SELECT * FROM products WHERE id = ? AND organization_id = ? LIMIT 1', [id, organizationId]
  );
  if (!row) throw AppError.notFound('Item não encontrado.');
  return row;
}

async function create(organizationId, data, userId) {
  const result = await db.query(
    `INSERT INTO products
       (organization_id, name, emoji, category, unit_cost, sale_price, stock_quantity, min_stock, status)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      organizationId, data.name, data.emoji || null, data.category, data.unitCost,
      data.salePrice ?? null, data.stockQuantity, data.minStock, data.status || 'active',
    ]
  );
  // Estoque inicial vira um movimento, para o histórico fechar com o saldo.
  if (data.stockQuantity) {
    await db.query(
      `INSERT INTO stock_movements (product_id, type, quantity, unit_value, reason, user_id)
       VALUES (?, 'in', ?, ?, 'Estoque inicial', ?)`,
      [result.insertId, data.stockQuantity, data.unitCost, userId]
    );
  }
  return shape(await getOwned(result.insertId, organizationId));
}

const FIELDS = {
  name: 'name', emoji: 'emoji', category: 'category', unitCost: 'unit_cost',
  salePrice: 'sale_price', minStock: 'min_stock', status: 'status',
};

async function update(id, organizationId, data, userId) {
  const current = await getOwned(id, organizationId);
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(FIELDS)) {
    if (data[key] !== undefined) { sets.push(`${column} = ?`); params.push(data[key]); }
  }
  if (sets.length) {
    params.push(id);
    await db.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  // Edição direta do estoque é registrada como ajuste, não sobrescrita silenciosa.
  if (data.stockQuantity !== undefined && Number(data.stockQuantity) !== Number(current.stock_quantity)) {
    await move(id, organizationId, {
      type: 'adjust',
      quantity: Number(data.stockQuantity) - Number(current.stock_quantity),
      reason: 'Ajuste manual pela tela de edição',
    }, userId);
  }
  return shape(await getOwned(id, organizationId));
}

async function remove(id, organizationId) {
  const product = await getOwned(id, organizationId);
  // Arquiva em vez de apagar: as movimentações são histórico de custo.
  await db.query(`UPDATE products SET status = 'archived' WHERE id = ?`, [id]);
  return shape(product);
}

// Movimentação de estoque. O saldo em products.stock_quantity é um cache
// atualizado na mesma transação do movimento.
async function move(productId, organizationId, data, userId) {
  return db.transaction(async (conn) => {
    const [rows] = await conn.execute(
      'SELECT * FROM products WHERE id = ? AND organization_id = ? FOR UPDATE',
      [productId, organizationId]
    );
    const product = rows[0];
    if (!product) throw AppError.notFound('Item não encontrado.');

    // Entradas somam; saídas/vendas/perdas subtraem; ajuste usa o sinal enviado.
    const signed = ['out', 'sale', 'loss'].includes(data.type)
      ? -Math.abs(data.quantity)
      : (data.type === 'in' ? Math.abs(data.quantity) : data.quantity);

    const newBalance = Number(product.stock_quantity) + signed;
    if (newBalance < 0) {
      throw AppError.badRequest(
        `Estoque insuficiente: há ${product.stock_quantity} un. de "${product.name}".`
      );
    }

    await conn.execute(
      `INSERT INTO stock_movements
         (product_id, event_id, type, quantity, unit_value, reason, user_id)
       VALUES (?,?,?,?,?,?,?)`,
      [
        productId, data.eventId || null, data.type, signed,
        data.unitValue ?? product.unit_cost, data.reason || null, userId,
      ]
    );
    await conn.execute('UPDATE products SET stock_quantity = ? WHERE id = ?', [newBalance, productId]);

    return { productId, type: data.type, quantity: signed, balance: newBalance };
  });
}

async function movements(organizationId, { productId, eventId, limit = 100 } = {}) {
  const params = [organizationId];
  let where = 'WHERE p.organization_id = ?';
  if (productId) { where += ' AND m.product_id = ?'; params.push(productId); }
  if (eventId)   { where += ' AND m.event_id = ?';   params.push(eventId); }
  return db.query(
    `SELECT m.id, m.type, m.quantity, m.unit_value, m.reason, m.created_at,
            p.name AS product_name, p.emoji, e.name AS event_name, u.name AS user_name
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
  LEFT JOIN events e   ON e.id = m.event_id
  LEFT JOIN users u    ON u.id = m.user_id
       ${where}
      ORDER BY m.created_at DESC
      LIMIT ${Number(limit)}`,
    params
  );
}

async function alerts(organizationId) {
  const rows = await db.query(
    `SELECT * FROM products
      WHERE organization_id = ? AND status = 'active' AND stock_quantity < min_stock
      ORDER BY (min_stock - stock_quantity) DESC`,
    [organizationId]
  );
  return rows.map(shape);
}

module.exports = { list, create, update, remove, move, movements, alerts, getOwned, shape };
