-- 006_notification_system.sql
-- Sistema Inteligente de Notificações Empresariais
-- Arquitetura de Eventos de Negócio, Fila Persistente (Outbox) e Preferências

-- 1. business_events — outbox transacional de eventos de negócio
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. notification_outbox — fila persistente de e-mails com separação estrita de estados
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. notification_preferences — preferências por organização e destinatário
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. notification_rate_limits — controle de frequência e deduplicação de alertas
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
