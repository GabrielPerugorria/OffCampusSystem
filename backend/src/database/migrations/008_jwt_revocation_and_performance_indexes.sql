-- 008_jwt_revocation_and_performance_indexes.sql
-- 1. Suporte formal à revogação de Access Tokens JWT por JTI
-- 2. Índice composto para aceleração de liberação de reservas expiradas em orders
-- 3. Índice em tickets para suporte às consultas de portaria e participantes

-- 1. Criação da tabela revoked_tokens
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti         VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id     BIGINT UNSIGNED NULL,
  reason      VARCHAR(100) NULL DEFAULT 'logout',
  expires_at  DATETIME NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_revoked_expires (expires_at),
  INDEX idx_revoked_user (user_id),
  CONSTRAINT fk_revoked_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Índice composto em orders para otimizar releaseExpiredReservations()
-- Acelera: WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < NOW()
ALTER TABLE orders
  ADD INDEX idx_order_status_expires (status, expires_at);

-- 3. Índice em tickets para otimizar busca por evento e comprador
ALTER TABLE tickets
  ADD INDEX idx_ticket_event_holder (event_id, holder_name);
