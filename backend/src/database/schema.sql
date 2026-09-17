-- ============================================================
--  EvoTech Events — Schema MySQL 8.0+
--  Execute:  mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS evotech_events
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE evotech_events;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs, refresh_tokens, stock_movements, products,
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
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE SET NULL,
  INDEX idx_order_event_status (event_id, status),
  INDEX idx_order_user (user_id),
  INDEX idx_order_email (buyer_email)
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
