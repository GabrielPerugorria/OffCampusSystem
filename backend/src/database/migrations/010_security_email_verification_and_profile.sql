-- 010_security_email_verification_and_profile.sql
-- Suporte a verificação obrigatória de e-mail no cadastro, alteração segura de e-mail,
-- revogação imediata de sessões por timestamp e foto de perfil.

-- 1. Novas colunas na tabela users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at DATETIME NULL AFTER status,
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255) NULL AFTER birth_date,
  ADD COLUMN IF NOT EXISTS tokens_valid_after DATETIME NULL AFTER email_verified_at;

-- 2. Backfill compatível para contas já existentes (evita bloquear usuários antigos)
UPDATE users
   SET email_verified_at = created_at
 WHERE email_verified_at IS NULL;

-- 3. Tabela de códigos de verificação de e-mail (cadastro e alteração de e-mail)
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT UNSIGNED NOT NULL,
  purpose             ENUM('register', 'email_change') NOT NULL DEFAULT 'register',
  target_email        VARCHAR(160) NOT NULL,
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
  UNIQUE KEY uq_evc_challenge (challenge_token),
  INDEX idx_evc_user_purpose (user_id, purpose, expires_at),
  CONSTRAINT fk_evc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
