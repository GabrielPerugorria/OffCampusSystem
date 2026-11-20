'use strict';
const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * businessEventService — Emissão centralizada de eventos de negócio.
 *
 * Implementa o padrão Transactional Outbox: o evento é persistido na mesma
 * transação do banco que executa a operação de negócio. Isso garante que
 * uma venda confirmada SEMPRE gere um business_event correspondente — sem
 * risco de o e-mail ser "esquecido" caso o processo reinicie entre a operação
 * e o disparo da notificação.
 *
 * O processamento assíncrono (leitura da tabela business_events e enfileiramento
 * na notification_outbox) é feito pelo notificationScheduler, separadamente.
 *
 * Tipos suportados (ENUM na tabela business_events):
 *   order_paid, order_cancelled, checkin,
 *   expense_created, expense_paid,
 *   stock_movement, stock_critical,
 *   goal_reached, batch_sold_out
 */

/**
 * Emite um evento de negócio.
 *
 * @param {object} opts
 * @param {string}  opts.type           - Tipo do evento (ver ENUM acima)
 * @param {number}  opts.organizationId - ID da organização
 * @param {number|null} opts.eventId    - ID do evento relacionado (pode ser null)
 * @param {object}  opts.payload        - Dados do evento (qualquer objeto serializável)
 * @param {object|null} opts.conn       - Conexão de transação ativa (opcional).
 *                                        Se fornecida, o INSERT usa a mesma conexão
 *                                        (garantia de atomicidade com a operação de negócio).
 *                                        Se não fornecida, usa db.query diretamente.
 */
async function emit({ type, organizationId, eventId = null, payload, conn = null }) {
  if (!type || !organizationId) {
    logger.warn('[BusinessEvent] emit chamado sem type ou organizationId — ignorado.');
    return null;
  }

  try {
    const sql = `
      INSERT INTO business_events (organization_id, event_id, type, payload)
      VALUES (?, ?, ?, ?)
    `;
    const params = [
      organizationId,
      eventId || null,
      type,
      JSON.stringify(payload || {}),
    ];

    if (conn) {
      // Usa a conexão da transação ativa (transactional outbox pattern)
      const [result] = await conn.execute(sql, params);
      return result.insertId;
    } else {
      // Fallback: usa pool diretamente (sem garantia de atomicidade com transação externa)
      const result = await db.query(sql, params);
      return result.insertId;
    }
  } catch (err) {
    // Nunca deixar que a falha no registro do evento bloqueie a operação de negócio.
    // Apenas loga — o pior cenário é uma notificação não enviada, não uma venda perdida.
    logger.error(`[BusinessEvent] Falha ao registrar evento ${type} para org ${organizationId}:`, err.message);
    return null;
  }
}

/**
 * Busca eventos não processados em ordem cronológica.
 * Usado pelo notificationScheduler para processar a fila.
 *
 * @param {number} limit - Máximo de eventos a retornar por ciclo
 */
async function fetchUnprocessed(limit = 50) {
  return db.query(
    `SELECT id, organization_id, event_id, type, payload, created_at
       FROM business_events
      WHERE processed = 0
      ORDER BY created_at ASC
      LIMIT ?`,
    [limit]
  );
}

/**
 * Marca um evento como processado.
 * Chamado pelo notificationScheduler após enfileirar na notification_outbox.
 *
 * @param {number} id - ID do business_event
 */
async function markProcessed(id) {
  await db.query(
    'UPDATE business_events SET processed = 1, processed_at = NOW() WHERE id = ?',
    [id]
  );
}

/**
 * Marca múltiplos eventos como processados em lote.
 *
 * @param {number[]} ids - Array de IDs
 */
async function markProcessedBatch(ids) {
  if (!ids || ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.query(
    `UPDATE business_events SET processed = 1, processed_at = NOW() WHERE id IN (${placeholders})`,
    ids
  );
}

module.exports = { emit, fetchUnprocessed, markProcessed, markProcessedBatch };
