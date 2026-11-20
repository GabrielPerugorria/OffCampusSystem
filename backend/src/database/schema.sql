-- ============================================================
--  EvoTech Events — Schema MySQL 8.0+
--  Execute:  mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS evotech_events
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE evotech_events;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notification_rate_limits, notification_preferences, notification_outbox, business_events,
  audit_logs, password_reset_tokens, refresh_tokens, stock_movements, products,
  expenses, expense_categories, contacts, checkins, tickets, orders,
  ticket_batches, events, organization_members, organizations, users;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- USUÁRIOS
-- ------------------------------------------------------------
CREATE TABLE users (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(120)  NOT NULL,
  email          VARCHAR(160)  NOT NULL,
  password_hash  VARCHAR(255)  NOT NULL,
  cpf            VARCHAR(14)   NULL,
  phone          VARCHAR(20)   NULL,
  birth_date     DATE          NULL,
  role           ENUM('platform_admin','user') NOT NULL DEFAULT 'user',
  status         ENUM('active','blocked')      NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT uq_users_cpf   UNIQUE (cpf),
  INDEX idx_users_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- PRODUTORES (multi-tenant)
-- ------------------------------------------------------------
CREATE TABLE organizations (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(140) NOT NULL,
  slug           VARCHAR(140) NOT NULL,
  document       VARCHAR(20)  NULL,          -- CNPJ/CPF do produtor
  owner_user_id  BIGINT UNSIGNED NOT NULL,
  status         ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_org_slug UNIQUE (slug),
  CONSTRAINT fk_org_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Equipe & permissões (substitui STATE.equipe)
CREATE TABLE organization_members (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  role            ENUM('owner','admin','finance','gate','bar') NOT NULL DEFAULT 'gate',
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_member UNIQUE (organization_id, user_id),
  CONSTRAINT fk_member_org  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_member_user FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE,
  INDEX idx_member_user (user_id, status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- EVENTOS
-- ------------------------------------------------------------
CREATE TABLE events (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(160) NOT NULL,
  slug            VARCHAR(180) NOT NULL,
  type            VARCHAR(80)  NULL,          -- "Festival Eletrônico", "Ambiente VIP"...
  description     TEXT         NULL,
  rules           TEXT         NULL,
  venue           VARCHAR(160) NULL,          -- "Curitiba, PR"
  event_date      DATETIME     NULL,          -- NULL = "EM BREVE"
  capacity        INT UNSIGNED NOT NULL DEFAULT 0,
  banner_url      VARCHAR(255) NULL,
  goal_attendance INT UNSIGNED NOT NULL DEFAULT 0,
  goal_revenue    DECIMAL(12,2) NOT NULL DEFAULT 0,
  status          ENUM('draft','upcoming','active','sold_out','closed') NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_event_slug UNIQUE (slug),
  CONSTRAINT fk_event_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  INDEX idx_event_org_status (organization_id, status),
  INDEX idx_event_date (event_date)
) ENGINE=InnoDB;

-- Lotes
CREATE TABLE ticket_batches (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id       BIGINT UNSIGNED NOT NULL,
  name           VARCHAR(120) NOT NULL,
  price          DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity_total INT UNSIGNED NOT NULL DEFAULT 0,
  quantity_sold  INT UNSIGNED NOT NULL DEFAULT 0,   -- disponível = total - sold
  sales_start    DATETIME NULL,
  sales_end      DATETIME NULL,
  sort_order     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status         ENUM('active','paused','closed') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_batch_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT ck_batch_qty CHECK (quantity_sold <= quantity_total),
  INDEX idx_batch_event (event_id, status, sort_order)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- PEDIDOS E INGRESSOS
-- ------------------------------------------------------------
CREATE TABLE orders (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id        BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NULL,       -- NULL = compra sem login
  buyer_name      VARCHAR(120) NOT NULL,
  buyer_email     VARCHAR(160) NOT NULL,
  buyer_cpf       VARCHAR(14)  NOT NULL,
  total_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
  status          ENUM('pending','paid','cancelled','refunded') NOT NULL DEFAULT 'pending',
  payment_method  ENUM('pix','credit_card','free','manual') NOT NULL DEFAULT 'manual',
  external_payment_id VARCHAR(120) NULL,      -- id do gateway (fase futura)
  paid_at         DATETIME NULL,
  confirmed_by    BIGINT UNSIGNED NULL,       -- operador/admin que confirmou manualmente
  confirmed_at    DATETIME NULL,
  cancelled_by    BIGINT UNSIGNED NULL,       -- usuário/admin que cancelou
  cancelled_at    DATETIME NULL,
  cancellation_reason VARCHAR(255) NULL,
  confirmation_email_sent_at DATETIME NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE SET NULL,
  CONSTRAINT fk_order_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_order_event_status (event_id, status),
  INDEX idx_order_user (user_id),
  INDEX idx_order_email (buyer_email)
) ENGINE=InnoDB;

CREATE TABLE order_items (
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
) ENGINE=InnoDB;

CREATE TABLE tickets (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id     BIGINT UNSIGNED NOT NULL,
  batch_id     BIGINT UNSIGNED NOT NULL,
  event_id     BIGINT UNSIGNED NOT NULL,      -- denormalizado: consultas de portaria
  code         VARCHAR(40)  NOT NULL,
  holder_name  VARCHAR(120) NOT NULL,
  holder_email VARCHAR(160) NULL,
  holder_cpf   VARCHAR(14)  NULL,
  price_paid   DECIMAL(10,2) NOT NULL DEFAULT 0,
  status       ENUM('valid','used','cancelled') NOT NULL DEFAULT 'valid',
  issued_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_ticket_code UNIQUE (code),
  CONSTRAINT fk_ticket_order FOREIGN KEY (order_id) REFERENCES orders(id)         ON DELETE CASCADE,
  CONSTRAINT fk_ticket_batch FOREIGN KEY (batch_id) REFERENCES ticket_batches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ticket_event FOREIGN KEY (event_id) REFERENCES events(id)         ON DELETE RESTRICT,
  INDEX idx_ticket_event_status (event_id, status),
  INDEX idx_ticket_email (holder_email)
) ENGINE=InnoDB;

-- Check-in / portaria
CREATE TABLE checkins (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id           BIGINT UNSIGNED NOT NULL,
  ticket_id          BIGINT UNSIGNED NULL,    -- NULL = entrada manual (convidado/cortesia)
  guest_name         VARCHAR(120) NOT NULL,
  method             ENUM('code','manual') NOT NULL DEFAULT 'code',
  checked_by_user_id BIGINT UNSIGNED NULL,
  checked_in_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_checkin_ticket UNIQUE (ticket_id),   -- impede reentrada
  CONSTRAINT fk_checkin_event  FOREIGN KEY (event_id)  REFERENCES events(id)  ON DELETE CASCADE,
  CONSTRAINT fk_checkin_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_checkin_user   FOREIGN KEY (checked_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_checkin_event_time (event_id, checked_in_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- FINANCEIRO
-- ------------------------------------------------------------
CREATE TABLE expense_categories (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(80) NOT NULL,
  icon            VARCHAR(8)  NULL,
  CONSTRAINT uq_expcat UNIQUE (organization_id, name),
  CONSTRAINT fk_expcat_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE expenses (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  event_id        BIGINT UNSIGNED NULL,       -- NULL = custo geral (rateado)
  category_id     BIGINT UNSIGNED NOT NULL,
  description     VARCHAR(255) NULL,
  amount          DECIMAL(12,2) NOT NULL,
  expense_date    DATE NOT NULL,
  status          ENUM('pending','paid') NOT NULL DEFAULT 'paid',
  created_by      BIGINT UNSIGNED NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_exp_org   FOREIGN KEY (organization_id) REFERENCES organizations(id)     ON DELETE CASCADE,
  CONSTRAINT fk_exp_event FOREIGN KEY (event_id)        REFERENCES events(id)            ON DELETE SET NULL,
  CONSTRAINT fk_exp_cat   FOREIGN KEY (category_id)     REFERENCES expense_categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_exp_user  FOREIGN KEY (created_by)      REFERENCES users(id)             ON DELETE SET NULL,
  INDEX idx_exp_org_date (organization_id, expense_date),
  INDEX idx_exp_event (event_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- OPEN BAR / ESTOQUE
-- ------------------------------------------------------------
CREATE TABLE products (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(120) NOT NULL,
  emoji           VARCHAR(8)   NULL,
  category        VARCHAR(60)  NOT NULL DEFAULT 'Outros',
  unit_cost       DECIMAL(10,2) NOT NULL DEFAULT 0,
  sale_price      DECIMAL(10,2) NULL,         -- usado quando houver PDV
  stock_quantity  INT NOT NULL DEFAULT 0,     -- cache de SUM(stock_movements)
  min_stock       INT NOT NULL DEFAULT 0,
  status          ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_product UNIQUE (organization_id, name),
  CONSTRAINT fk_product_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_product_org_status (organization_id, status)
) ENGINE=InnoDB;

CREATE TABLE stock_movements (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  BIGINT UNSIGNED NOT NULL,
  event_id    BIGINT UNSIGNED NULL,
  type        ENUM('in','out','sale','loss','adjust') NOT NULL,
  quantity    INT NOT NULL,                   -- positivo para 'in'/'adjust+', negativo para saídas
  unit_value  DECIMAL(10,2) NOT NULL DEFAULT 0,
  reason      VARCHAR(255) NULL,
  user_id     BIGINT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mov_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_mov_event   FOREIGN KEY (event_id)   REFERENCES events(id)   ON DELETE SET NULL,
  CONSTRAINT fk_mov_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_mov_product_time (product_id, created_at),
  INDEX idx_mov_event (event_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CONTATOS (fornecedores, artistas, equipe externa)
-- ------------------------------------------------------------
CREATE TABLE contacts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(120) NOT NULL,
  role_title      VARCHAR(120) NULL,
  email           VARCHAR(160) NULL,
  phone           VARCHAR(20)  NULL,
  category        VARCHAR(60)  NOT NULL DEFAULT 'Outros',
  fee             DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes           TEXT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contact_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_contact_org (organization_id, category)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- AUDITORIA E SESSÕES
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NULL,
  user_id         BIGINT UNSIGNED NULL,
  user_name       VARCHAR(120) NULL,          -- snapshot: log sobrevive à exclusão do usuário
  action          VARCHAR(255) NOT NULL,
  entity          VARCHAR(60)  NULL,
  entity_id       BIGINT UNSIGNED NULL,
  ip_address      VARCHAR(45)  NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_org  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE SET NULL,
  INDEX idx_audit_org_time (organization_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE refresh_tokens (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,               -- SHA-256 do token (nunca o token puro)
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_refresh_hash UNIQUE (token_hash),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id, expires_at)
) ENGINE=InnoDB;

CREATE TABLE password_reset_tokens (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,               -- SHA-256 do token (nunca o token puro)
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_reset_hash UNIQUE (token_hash),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reset_user (user_id, expires_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SISTEMA INTELIGENTE DE NOTIFICAÇÕES & EVENTOS DE NEGÓCIO
-- ------------------------------------------------------------
CREATE TABLE business_events (
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
) ENGINE=InnoDB;

CREATE TABLE notification_outbox (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id       BIGINT UNSIGNED NULL,
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
) ENGINE=InnoDB;

CREATE TABLE notification_preferences (
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
) ENGINE=InnoDB;

CREATE TABLE notification_rate_limits (
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
) ENGINE=InnoDB;

CREATE TABLE admin_login_codes (
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
) ENGINE=InnoDB;

CREATE TABLE in_app_notifications (
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
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- REVOGAÇÃO DE TOKENS JWT
-- ------------------------------------------------------------
CREATE TABLE revoked_tokens (
  jti         VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id     BIGINT UNSIGNED NULL,
  reason      VARCHAR(100) NULL DEFAULT 'logout',
  expires_at  DATETIME NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_revoked_expires (expires_at),
  INDEX idx_revoked_user (user_id),
  CONSTRAINT fk_revoked_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
