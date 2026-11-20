'use strict';
const logger = require('../utils/logger');
const notificationOutboxService = require('./notificationOutboxService');
const notificationProcessor = require('./notificationProcessor');

/**
 * notificationScheduler — Orquestrador cíclico da fila e eventos.
 *
 * Utiliza setInterval mas SEM depender de estado em memória para consistência:
 * - Toda exclusividade e controle de concorrência é garantida no MySQL via FOR UPDATE.
 * - Na inicialização, executa recoverStaleProcessingJobs() para reverter tarefas presas
 *   após eventuais reinicializações abruptas ou crashes do servidor.
 */

let _schedulerInterval = null;
let _isTicking = false;

async function tick() {
  if (_isTicking) {
    // Evita sobreposição do mesmo timer local se a volta demorar
    return;
  }
  _isTicking = true;

  try {
    // 1. Recupera tarefas presas em processing por mais de 5 minutos
    await notificationOutboxService.recoverStaleProcessingJobs(5);

    // 2. Processa novos eventos de negócio brutos e popula outbox
    await notificationProcessor.processBusinessEvents(50);

    // 3. Despacha notificações prontas para envio via Resend
    await notificationProcessor.dispatchClaimedNotifications(15);
  } catch (err) {
    logger.error('[Scheduler] Erro no ciclo de notificações:', err.message);
  } finally {
    _isTicking = false;
  }
}

/**
 * Inicia o scheduler com intervalo configurável (padrão 15 segundos)
 */
function startNotificationScheduler(intervalMs = 15000) {
  if (_schedulerInterval) {
    logger.warn('[Scheduler] Scheduler já está em execução.');
    return;
  }

  logger.info(`[Scheduler] Iniciando Notification Scheduler (ciclo: ${intervalMs}ms)...`);

  // Executa imediatamente uma recuperação inicial e primeira passada
  tick().catch(err => logger.error('[Scheduler] Erro no tick inicial:', err.message));

  _schedulerInterval = setInterval(tick, intervalMs);
  if (_schedulerInterval.unref) {
    _schedulerInterval.unref(); // não bloqueia saída do processo em shutdown
  }
}

/**
 * Para o scheduler com segurança
 */
function stopNotificationScheduler() {
  if (_schedulerInterval) {
    clearInterval(_schedulerInterval);
    _schedulerInterval = null;
    logger.info('[Scheduler] Notification Scheduler encerrado.');
  }
}

module.exports = {
  startNotificationScheduler,
  stopNotificationScheduler,
  tick,
};
