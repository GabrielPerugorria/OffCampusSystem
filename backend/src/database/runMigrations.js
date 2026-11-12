'use strict';
const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * Sistema robusto e auditável de migrações com:
 * 1. Tabela de controle de versão (schema_migrations)
 * 2. Prevenção de execução duplicada
 * 3. Validação estrutural pós-migração
 * 4. Registro explícito de falhas sem esconder erros (sem catch silencioso)
 * 5. Interrupção fatal se uma migração falhar
 */

// Definição das migrações incrementais
const MIGRATIONS = [
  {
    version: '20261112_001',
    name: '001_add_order_confirmation_fields',
    up: async (conn) => {
      // Adiciona confirmed_by e confirmed_at em orders se não existirem
      const [cols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME IN ('confirmed_by', 'confirmed_at')`
      );
      const existing = cols.map((c) => c.COLUMN_NAME);

      if (!existing.includes('confirmed_by')) {
        await conn.execute('ALTER TABLE orders ADD COLUMN confirmed_by BIGINT UNSIGNED NULL');
      }
      if (!existing.includes('confirmed_at')) {
        await conn.execute('ALTER TABLE orders ADD COLUMN confirmed_at DATETIME NULL');
      }
    },
    verify: async (conn) => {
      const [cols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME IN ('confirmed_by', 'confirmed_at')`
      );
      if (cols.length < 2) {
        throw new Error('Falha na validação pós-migração: colunas confirmed_by/confirmed_at ausentes na tabela orders.');
      }
    },
  },
  {
    version: '20261112_002',
    name: '002_add_order_items',
    up: async (conn) => {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS order_items (
          id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          order_id    BIGINT UNSIGNED NOT NULL,
          batch_id    BIGINT UNSIGNED NOT NULL,
          event_id    BIGINT UNSIGNED NOT NULL,
          quantity    INT UNSIGNED    NOT NULL DEFAULT 1,
          unit_price  DECIMAL(10,2)   NOT NULL,
          CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id)         ON DELETE CASCADE,
          CONSTRAINT fk_oi_batch FOREIGN KEY (batch_id) REFERENCES ticket_batches(id) ON DELETE RESTRICT,
          CONSTRAINT fk_oi_event FOREIGN KEY (event_id) REFERENCES events(id)         ON DELETE RESTRICT,
          INDEX idx_oi_order (order_id),
          INDEX idx_oi_batch (batch_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    },
    verify: async (conn) => {
      const [tables] = await conn.execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items'`
      );
      if (tables.length === 0) {
        throw new Error('Falha na validação pós-migração: tabela order_items não foi encontrada.');
      }
    },
  },
  {
    version: '20261112_003',
    name: '003_add_order_cancellation_fields',
    up: async (conn) => {
      const [cols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME IN ('cancelled_by', 'cancelled_at', 'cancellation_reason')`
      );
      const existing = cols.map((c) => c.COLUMN_NAME);

      if (!existing.includes('cancelled_by')) {
        await conn.execute('ALTER TABLE orders ADD COLUMN cancelled_by BIGINT UNSIGNED NULL');
      }
      if (!existing.includes('cancelled_at')) {
        await conn.execute('ALTER TABLE orders ADD COLUMN cancelled_at DATETIME NULL');
      }
      if (!existing.includes('cancellation_reason')) {
        await conn.execute('ALTER TABLE orders ADD COLUMN cancellation_reason VARCHAR(255) NULL');
      }
    },
    verify: async (conn) => {
      const [cols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME IN ('cancelled_by', 'cancelled_at', 'cancellation_reason')`
      );
      if (cols.length < 3) {
        throw new Error('Falha na validação pós-migração: colunas de cancelamento ausentes na tabela orders.');
      }
    },
  },
  {
    version: '20261112_004',
    name: '004_consolidated_aiven_sync',
    up: async (conn) => {
      // 1. quantity_reserved em ticket_batches
      const [batchCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_batches' AND COLUMN_NAME = 'quantity_reserved'`
      );
      if (batchCols.length === 0) {
        await conn.execute('ALTER TABLE ticket_batches ADD COLUMN quantity_reserved INT UNSIGNED NOT NULL DEFAULT 0');
      }

      // 2. expires_at e is_legacy em orders
      const [orderCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME IN ('expires_at', 'is_legacy')`
      );
      const existingOrder = orderCols.map((c) => c.COLUMN_NAME);
      if (!existingOrder.includes('expires_at')) {
        await conn.execute('ALTER TABLE orders ADD COLUMN expires_at DATETIME NULL');
      }
      if (!existingOrder.includes('is_legacy')) {
        await conn.execute('ALTER TABLE orders ADD COLUMN is_legacy TINYINT(1) NOT NULL DEFAULT 0');
      }

      // 3. details em audit_logs
      const [auditCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'details'`
      );
      if (auditCols.length === 0) {
        await conn.execute('ALTER TABLE audit_logs ADD COLUMN details JSON NULL');
      }
    },
    verify: async (conn) => {
      const [batchCheck] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_batches' AND COLUMN_NAME = 'quantity_reserved'`
      );
      if (batchCheck.length === 0) {
        throw new Error('Falha na validação pós-migração: quantity_reserved ausente em ticket_batches.');
      }

      const [orderCheck] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME IN ('expires_at', 'is_legacy')`
      );
      if (orderCheck.length < 2) {
        throw new Error('Falha na validação pós-migração: expires_at ou is_legacy ausentes em orders.');
      }
    },
  },
];

let _migrated = false;

async function runMigrations() {
  if (_migrated) return;

  const conn = await db.pool.getConnection();
  try {
    // 1. Garante que a tabela schema_migrations exista
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    VARCHAR(100) NOT NULL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 2. Busca migrações já aplicadas
    const [appliedRows] = await conn.execute('SELECT version FROM schema_migrations');
    const appliedVersions = new Set(appliedRows.map((r) => r.version));

    // 3. Executa cada migração pendente sequencialmente com validação
    for (const mig of MIGRATIONS) {
      if (appliedVersions.has(mig.version)) {
        continue; // Já aplicada e registrada
      }

      logger.info(`[MIGRAÇÃO] Aplicando migração: ${mig.version} - ${mig.name}...`);
      try {
        // Executa a migração
        await mig.up(conn);

        // Validação rigorosa da estrutura
        await mig.verify(conn);

        // Registra como concluída
        await conn.execute(
          'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
          [mig.version, mig.name]
        );
        logger.info(`[MIGRAÇÃO] Sucesso: ${mig.version} - ${mig.name} aplicada e verificada.`);
      } catch (migErr) {
        logger.error(`[MIGRAÇÃO CRÍTICA] Erro fatal na migração ${mig.version} - ${mig.name}:`, {
          message: migErr.message,
          code: migErr.code,
          sql: migErr.sql,
          stack: migErr.stack,
        });
        // Não esconde erro! Lança para interromper o boot do sistema.
        throw new Error(`Migração obrigatória ${mig.version} (${mig.name}) falhou: ${migErr.message}`);
      }
    }

    _migrated = true;
    logger.info('[MIGRAÇÃO] Todas as migrações incrementais estão atualizadas e validadas.');
  } finally {
    conn.release();
  }
}

module.exports = { runMigrations, MIGRATIONS };
