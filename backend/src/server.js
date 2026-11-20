'use strict';
const app = require('./app');
const env = require('./config/env');
const db = require('./config/db');
const logger = require('./utils/logger');

async function start() {
  try {
    await db.healthCheck();
    logger.info(`Banco conectado: ${env.db.database}@${env.db.host}:${env.db.port}`);
    const { runMigrations } = require('./database/runMigrations');
    await runMigrations();

    // Inicia verificação periódica em background para liberar reservas expiradas
    const { startReservationCleanupJob } = require('./services/orderService');
    startReservationCleanupJob(60000);

    // Inicia o Scheduler Inteligente de Notificações Empresariais (Transactional Outbox)
    const { startNotificationScheduler, stopNotificationScheduler } = require('./services/notificationScheduler');
    startNotificationScheduler(15000); // ciclo a cada 15s
  } catch (err) {
    logger.error('Não foi possível conectar ao MySQL. Verifique o .env.', err.message);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    logger.info(`API EvoTech Events em http://localhost:${env.port}/api (${env.nodeEnv})`);
    logger.info(`CORS liberado para: ${env.corsOrigins.join(', ') || '(todas as origens — apenas em dev)'}`);
  });

  const shutdown = (signal) => async () => {
    logger.info(`${signal} recebido. Encerrando...`);
    stopNotificationScheduler();
    server.close(async () => {
      await db.pool.end();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));
}

start();
