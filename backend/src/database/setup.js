'use strict';
// Cria o banco e as tabelas a partir do schema.sql.
// Uso: npm run db:setup
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../config/env');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const connOptions = {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  };

  if (env.db.ssl) {
    if (!fs.existsSync(env.db.sslCaPath)) {
      throw new Error(
        `Conexão SSL ao MySQL habilitada (DB_SSL=true), porém o certificado CA não foi encontrado em: "${env.db.sslCaPath}".`
      );
    }
    connOptions.ssl = {
      ca: fs.readFileSync(env.db.sslCaPath, 'utf8'),
      rejectUnauthorized: env.db.sslRejectUnauthorized,
    };
  }

  const conn = await mysql.createConnection(connOptions);
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
