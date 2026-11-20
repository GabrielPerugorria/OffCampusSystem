-- 007_admin_2fa_and_in_app_notifications.sql
-- Suporte a Verificação em 2 Etapas (2FA) para Contas Administrativas
-- e Central de Notificações Internas do Painel Administrativo em Tempo Real.

-- 1. Modifica organization_id em notification_outbox para aceitar NULL (e-mails transacionais do sistema)
ALTER TABLE notification_outbox MODIFY COLUMN organization_id BIGINT UNSIGNED NULL;

-- 2. admin_login_codes — códigos temporários de 6 dígitos para desafio 2FA de login administrativo
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. in_app_notifications — central de notificações internas do painel administrativo
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
