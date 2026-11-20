'use strict';
const db = require('../config/db');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * notificationRateLimitService — Controle de frequência e deduplicação inteligente de alertas.
 *
 * Utiliza a tabela notification_rate_limits para:
 * 1. Prevenir disparos excessivos para o mesmo evento/categoria dentro de uma janela temporal.
 * 2. Deduplicar alertas de estado (ex: estoque crítico) comparando o hash de estado atual com o anterior.
 *    Se o estado for o mesmo (ex: estoque continua em 5), não dispara novo alerta a cada movimentação.
 */

/**
 * Gera hash SHA-256 do estado de um alerta para detecção de mudanças reais.
 */
function computeStateHash(stateObj) {
  const json = JSON.stringify(stateObj || {});
  return crypto.createHash('sha256').update(json).digest('hex').substring(0, 32);
}

/**
 * Verifica se um alerta deve ser emitido ou suprimido por deduplicação / rate limit.
 *
 * @param {object} opts
 * @param {number} opts.organizationId
 * @param {number|null} opts.eventId
 * @param {string} opts.category
 * @param {string} opts.alertKey - Chave única do alerta (ex: 'stock_critical_prod_12', 'goal_reached_event_5')
 * @param {object} opts.currentState - Snapshot do estado atual para cálculo do hash
 * @param {number} opts.minIntervalMinutes - Intervalo mínimo entre disparos desta chave (padrão 15 min)
 * @param {number} opts.maxPerHour - Máximo de disparos por hora desta chave
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
async function checkAndRecordRateLimit({
  organizationId,
  eventId = null,
  category,
  alertKey,
  currentState = {},
  minIntervalMinutes = 15,
  maxPerHour = 4,
}) {
  const currentHash = computeStateHash(currentState);

  const existing = await db.queryOne(
    `SELECT id, last_sent_at, sent_count_last_hour, state_hash,
            TIMESTAMPDIFF(MINUTE, last_sent_at, NOW()) AS minutes_since_last
       FROM notification_rate_limits
      WHERE organization_id = ?
        AND (event_id = ? OR (event_id IS NULL AND ? IS NULL))
        AND alert_key = ?
      LIMIT 1`,
    [organizationId, eventId, eventId, alertKey]
  );

  if (existing) {
    // 1. Deduplicação por estado: se o estado é idêntico e já enviamos alerta recentemente, suprime
    if (existing.state_hash === currentHash && existing.minutes_since_last < 60) {
      return {
        allowed: false,
        reason: `Deduplicação ativada: estado do alerta [${alertKey}] não foi alterado desde o último envio há ${existing.minutes_since_last}m.`,
      };
    }

    // 2. Intervalo mínimo por categoria/chave
    if (existing.minutes_since_last < minIntervalMinutes) {
      return {
        allowed: false,
        reason: `Intervalo mínimo de ${minIntervalMinutes}m não decorrido (${existing.minutes_since_last}m decorridos).`,
      };
    }

    // 3. Limite de disparos por hora
    if (existing.minutes_since_last < 60 && existing.sent_count_last_hour >= maxPerHour) {
      return {
        allowed: false,
        reason: `Limite de ${maxPerHour} envios por hora atingido para [${alertKey}].`,
      };
    }

    // Atualiza registro existente
    const newCount = existing.minutes_since_last >= 60 ? 1 : existing.sent_count_last_hour + 1;
    await db.query(
      `UPDATE notification_rate_limits
          SET last_sent_at = NOW(),
              sent_count_last_hour = ?,
              state_hash = ?
        WHERE id = ?`,
      [newCount, currentHash, existing.id]
    );

    return { allowed: true };
  } else {
    // Primeiro envio para esta chave
    await db.query(
      `INSERT INTO notification_rate_limits (
        organization_id, event_id, category, alert_key, sent_count_last_hour, state_hash
      ) VALUES (?, ?, ?, ?, 1, ?)`,
      [organizationId, eventId || null, category, alertKey, currentHash]
    );

    return { allowed: true };
  }
}

/**
 * Reseta o rate limit de uma chave quando o problema for resolvido (ex: estoque normalizado).
 */
async function resetRateLimit({ organizationId, eventId = null, alertKey }) {
  await db.query(
    `DELETE FROM notification_rate_limits
      WHERE organization_id = ?
        AND (event_id = ? OR (event_id IS NULL AND ? IS NULL))
        AND alert_key = ?`,
    [organizationId, eventId, eventId, alertKey]
  );
}

module.exports = {
  checkAndRecordRateLimit,
  resetRateLimit,
  computeStateHash,
};
