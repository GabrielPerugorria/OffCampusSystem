-- 005_add_password_resets_and_email_tracking.sql
-- Adiciona suporte a tokens de recuperação de senha e rastreamento de disparo de e-mails de pedidos.

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Adiciona confirmation_email_sent_at na tabela orders para prevenir disparos duplicados
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_sent_at DATETIME NULL;
