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
  {
    version: '20261119_005',
    name: '005_add_password_resets_and_email_tracking',
    up: async (conn) => {
      // 1. Tabela password_reset_tokens
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id    BIGINT UNSIGNED NOT NULL,
          token_hash CHAR(64) NOT NULL,
          expires_at DATETIME NOT NULL,
          used_at    DATETIME NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_reset_hash UNIQUE (token_hash),
          CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_reset_user (user_id, expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // 2. Coluna confirmation_email_sent_at em orders
      const [orderCols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'confirmation_email_sent_at'`
      );
      if (orderCols.length === 0) {
        await conn.execute('ALTER TABLE orders ADD COLUMN confirmation_email_sent_at DATETIME NULL');
      }
    },
    verify: async (conn) => {
      const [tables] = await conn.execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_reset_tokens'`
      );
      if (tables.length === 0) {
        throw new Error('Falha na validação pós-migração: tabela password_reset_tokens não foi encontrada.');
      }

      const [cols] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'confirmation_email_sent_at'`
      );
      if (cols.length === 0) {
        throw new Error('Falha na validação pós-migração: coluna confirmation_email_sent_at ausente na tabela orders.');
      }
    },
  },
  {
    version: '20261119_006',
    name: '006_notification_system',
    up: async (conn) => {
      // 1. business_events — outbox transacional de eventos de negócio
      // Permite emitir eventos dentro da mesma transação do negócio (transactional outbox pattern)
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS business_events (
          id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          organization_id BIGINT UNSIGNED NOT NULL,
          event_id        BIGINT UNSIGNED NULL,
          type            ENUM(
                            'order_paid','order_cancelled',
                            'checkin',
                            'expense_created','expense_paid',
                            'stock_movement','stock_critical',
                            'goal_reached','batch_sold_out'
                          ) NOT NULL,
          payload         JSON NOT NULL,
          processed       TINYINT(1) NOT NULL DEFAULT 0,
          created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          processed_at    TIMESTAMP NULL,
          INDEX idx_be_unprocessed (processed, created_at),
          INDEX idx_be_org_event (organization_id, event_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // 2. notification_outbox — fila persistente de e-mails
      // Status diferencia aceitação pelo Resend de entrega efetiva
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS notification_outbox (
          id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          organization_id       BIGINT UNSIGNED NOT NULL,
          event_id              BIGINT UNSIGNED NULL,
          category              ENUM(
                                  'transactional',
                                  'sales_update','finance_update',
                                  'stock_alert','goal_reached','summary'
                                ) NOT NULL,
          priority              ENUM('immediate','grouped','summary') NOT NULL DEFAULT 'grouped',
          recipient_user_id     BIGINT UNSIGNED NULL,
          recipient_email       VARCHAR(160) NOT NULL,
          recipient_name        VARCHAR(120) NULL,
          subject               VARCHAR(255) NOT NULL,
          html_body             LONGTEXT NOT NULL,
          text_body             TEXT NULL,
          status                ENUM(
                                  'pending',
                                  'processing',
                                  'resend_accepted',
                                  'resend_failed',
                                  'delivered',
                                  'bounced',
                                  'cancelled'
                                ) NOT NULL DEFAULT 'pending',
          resend_message_id     VARCHAR(100) NULL,
          idempotency_key       VARCHAR(255) NULL,
          payload               JSON NULL,
          created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          scheduled_for         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          processing_started_at TIMESTAMP NULL,
          resend_accepted_at    TIMESTAMP NULL,
          delivered_at          TIMESTAMP NULL,
          sent_at               TIMESTAMP NULL,
          attempts              TINYINT UNSIGNED NOT NULL DEFAULT 0,
          max_attempts          TINYINT UNSIGNED NOT NULL DEFAULT 3,
          next_retry_at         TIMESTAMP NULL,
          last_error            TEXT NULL,
          UNIQUE KEY uq_idempotency (idempotency_key),
          INDEX idx_outbox_pending (status, scheduled_for),
          INDEX idx_outbox_org (organization_id, event_id, category),
          INDEX idx_outbox_processing (status, processing_started_at),
          INDEX idx_outbox_resend (resend_message_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // 3. notification_preferences — preferências por organização e destinatário
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          id                            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          organization_id               BIGINT UNSIGNED NOT NULL,
          recipient_user_id             BIGINT UNSIGNED NULL,
          event_id                      BIGINT UNSIGNED NULL,
          enabled                       TINYINT(1) NOT NULL DEFAULT 1,
          sales_updates                 TINYINT(1) NOT NULL DEFAULT 1,
          finance_updates               TINYINT(1) NOT NULL DEFAULT 1,
          stock_alerts                  TINYINT(1) NOT NULL DEFAULT 1,
          goals_reached                 TINYINT(1) NOT NULL DEFAULT 1,
          summaries_enabled             TINYINT(1) NOT NULL DEFAULT 1,
          grouping_window_minutes       SMALLINT UNSIGNED NOT NULL DEFAULT 5,
          max_emails_per_event_per_hour SMALLINT UNSIGNED NOT NULL DEFAULT 10,
          min_interval_minutes          SMALLINT UNSIGNED NOT NULL DEFAULT 2,
          created_at                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_pref_org_user_event (organization_id, recipient_user_id, event_id),
          INDEX idx_pref_org (organization_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // 4. notification_rate_limits — controle de frequência e deduplicação de alertas
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS notification_rate_limits (
          id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          organization_id       BIGINT UNSIGNED NOT NULL,
          event_id              BIGINT UNSIGNED NULL,
          category              VARCHAR(60) NOT NULL,
          alert_key             VARCHAR(255) NOT NULL,
          last_sent_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          sent_count_last_hour  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
          state_hash            VARCHAR(64) NULL,
          UNIQUE KEY uq_rate_limit (organization_id, event_id, alert_key),
          INDEX idx_rl_org_event (organization_id, event_id, category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    },
    verify: async (conn) => {
      const requiredTables = [
        'business_events',
        'notification_outbox',
        'notification_preferences',
        'notification_rate_limits',
      ];
      for (const tableName of requiredTables) {
        const [rows] = await conn.execute(
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
          [tableName]
        );
        if (rows.length === 0) {
          throw new Error(`Falha na validação pós-migração: tabela ${tableName} não foi criada.`);
        }
      }
    },
  },
  {
    version: '20261120_007',
    name: '007_admin_2fa_and_in_app_notifications',
    up: async (conn) => {
      // 1. Modifica organization_id em notification_outbox para aceitar NULL
      await conn.execute('ALTER TABLE notification_outbox MODIFY COLUMN organization_id BIGINT UNSIGNED NULL');

      // 2. admin_login_codes
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS admin_login_codes (
          id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id             BIGINT UNSIGNED NOT NULL,
          challenge_token     VARCHAR(64) NOT NULL,
          code_hash           CHAR(64) NOT NULL,
          attempts            TINYINT UNSIGNED NOT NULL DEFAULT 0,
          max_attempts        TINYINT UNSIGNED NOT NULL DEFAULT 5,
          expires_at          DATETIME NOT NULL,
          resend_available_at DATETIME NOT NULL,
          used_at             DATETIME NULL,
          ip_address          VARCHAR(45) NULL,
          user_agent          VARCHAR(255) NULL,
          created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_admin_challenge (challenge_token),
          INDEX idx_alc_user (user_id, expires_at),
          CONSTRAINT fk_alc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // 3. in_app_notifications
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS in_app_notifications (
          id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          organization_id BIGINT UNSIGNED NULL,
          event_id        BIGINT UNSIGNED NULL,
          category        ENUM('sales', 'account', 'financial', 'stock', 'operation') NOT NULL,
          severity        ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'info',
          title           VARCHAR(160) NOT NULL,
          message         TEXT NOT NULL,
          metadata        JSON NULL,
          read_at         DATETIME NULL,
          created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_ian_org_unread (organization_id, read_at, created_at),
          INDEX idx_ian_category (organization_id, category, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    },
    verify: async (conn) => {
      const requiredTables = ['admin_login_codes', 'in_app_notifications'];
      for (const tableName of requiredTables) {
        const [rows] = await conn.execute(
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
          [tableName]
        );
        if (rows.length === 0) {
          throw new Error(`Falha na validação pós-migração: tabela ${tableName} não foi criada.`);
        }
      }
    },
  },
  {
    version: '20261120_008',
    name: '008_jwt_revocation_and_performance_indexes',
    up: async (conn) => {
      // 1. Tabela revoked_tokens
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS revoked_tokens (
          jti         VARCHAR(36) NOT NULL PRIMARY KEY,
          user_id     BIGINT UNSIGNED NULL,
          reason      VARCHAR(100) NULL DEFAULT 'logout',
          expires_at  DATETIME NOT NULL,
          created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_revoked_expires (expires_at),
          INDEX idx_revoked_user (user_id),
          CONSTRAINT fk_revoked_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // 2. Índice idx_order_status_expires em orders se não existir
      const [orderIdx] = await conn.execute(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_order_status_expires'`
      );
      if (orderIdx.length === 0) {
        await conn.execute('ALTER TABLE orders ADD INDEX idx_order_status_expires (status, expires_at)');
      }

      // 3. Índice idx_ticket_event_holder em tickets se não existir
      const [ticketIdx] = await conn.execute(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_event_holder'`
      );
      if (ticketIdx.length === 0) {
        await conn.execute('ALTER TABLE tickets ADD INDEX idx_ticket_event_holder (event_id, holder_name)');
      }
    },
    verify: async (conn) => {
      const [revTables] = await conn.execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'revoked_tokens'`
      );
      if (revTables.length === 0) {
        throw new Error('Falha na validação pós-migração: tabela revoked_tokens não foi criada.');
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
