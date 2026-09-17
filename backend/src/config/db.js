'use strict';
const mysql = require('mysql2/promise');
const env = require('./env');

// Pool único da aplicação. Todas as queries usam prepared statements
// (execute + placeholders "?") — é isso que impede SQL injection.
const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  timezone: 'Z',
  decimalNumbers: true,
  charset: 'utf8mb4_unicode_ci',
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Executa o callback dentro de uma transação, com rollback automático em erro.
async function transaction(callback) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function healthCheck() {
  const rows = await query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

module.exports = { pool, query, queryOne, transaction, healthCheck };
