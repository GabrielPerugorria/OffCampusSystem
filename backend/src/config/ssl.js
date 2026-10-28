'use strict';
const fs = require('fs');
const env = require('./env');

function getSslOption() {
  if (!env.db.ssl) {
    return undefined;
  }

  const caPath = env.db.sslCaPath;

  if (!fs.existsSync(caPath)) {
    throw new Error(
      `Conexão SSL ao MySQL habilitada (DB_SSL=true), porém o certificado CA não foi encontrado em: "${caPath}".\n` +
      `Faça o download do arquivo ca.pem no painel da Aiven e salve em "backend/src/certs/ca.pem" (ou ajuste DB_SSL_CA no .env).`
    );
  }

  try {
    const ca = fs.readFileSync(caPath, 'utf8');
    return {
      ca,
      rejectUnauthorized: env.db.sslRejectUnauthorized,
    };
  } catch (err) {
    throw new Error(`Erro ao ler o certificado CA em "${caPath}": ${err.message}`);
  }
}

module.exports = { getSslOption };
