'use strict';
const app = require('./app');
const env = require('./config/env');
const db = require('./config/db');
const logger = require('./utils/logger');
const { runMigrations } = require('./database/runMigrations');
const { startReservationCleanupJob, stopReservationCleanupJob } = require('./services/orderService');
const { startNotificationScheduler, stopNotificationScheduler } = require('./services/notificationScheduler');

let server = null;
let isShuttingDown = false;

const shutdown = (signal) => async () => {
  if (isShuttingDown) {
    logger.warn(`[Shutdown] Encerramento já em andamento. Sinal ${signal} ignorado.`);
    return;
  }
  isShuttingDown = true;
  logger.info(`[Shutdown] Sinal ${signal} recebido. Iniciando encerramento gracioso...`);

  const emergencyTimeout = setTimeout(() => {
    logger.error('[Shutdown] Tempo limite de encerramento excedido (10s). Forçando encerramento.');
    process.exit(1);
  }, 10000);
  if (emergencyTimeout.unref) emergencyTimeout.unref();

  try {
    // 1. Encerra jobs em background e schedulers
    stopReservationCleanupJob();
    await stopNotificationScheduler(3000);

    // 2. Encerra servidor HTTP de forma controlada
    if (server && server.listening) {
      await new Promise((resolve) => {
        server.close((err) => {
          if (err) {
            logger.error('[Shutdown] Erro ao fechar servidor HTTP:', err.message);
          } else {
            logger.info('[Shutdown] Servidor HTTP fechado com sucesso.');
          }
          resolve();
        });
      });
    }

    // 3. Fecha conexões do MySQL
    if (db && db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
      logger.info('[Shutdown] Pool de conexões MySQL encerrado.');
    }

    clearTimeout(emergencyTimeout);
    logger.info('[Shutdown] Processo encerrado com sucesso.');
    process.exit(0);
  } catch (err) {
    clearTimeout(emergencyTimeout);
    logger.error('[Shutdown] Falha durante o encerramento gracioso:', err.message);
    process.exit(1);
  }
};

async function start() {
  try {
    await db.healthCheck();
    logger.info(`Banco conectado: ${env.db.database}@${env.db.host}:${env.db.port}`);
    await runMigrations();

    // Inicia verificação periódica em background para liberar reservas expiradas (a cada 60s)
    startReservationCleanupJob(60000);

    // Inicia o Scheduler Inteligente de Notificações Empresariais (a cada 15s)
    startNotificationScheduler(15000);
  } catch (err) {
    logger.error('Não foi possível inicializar o backend. Verifique o banco de dados e .env:', err.message);
    process.exit(1);
  }

  server = app.listen(env.port, () => {
    logger.info(`API EvoTech Events em http://localhost:${env.port}/api (${env.nodeEnv})`);
    logger.info(`CORS liberado para: ${env.corsOrigins.join(', ') || '(todas as origens — apenas em dev)'}`);
  });

  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));
}

start();
