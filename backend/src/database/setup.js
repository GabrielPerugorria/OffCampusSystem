'use strict';
// Cria o banco e as tabelas a partir do schema.sql.
// Uso: npm run db:setup
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../config/env');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  });
  try {
    await conn.query(sql);
    console.log(`Schema aplicado em "${env.db.database}".`);
  } finally {
    await conn.end();
  }
})().catch(err => {
  console.error('Falha ao aplicar o schema:', err.message);
  process.exit(1);
});
