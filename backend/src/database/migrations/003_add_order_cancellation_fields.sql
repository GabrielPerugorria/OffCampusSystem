-- Migração 003: adiciona campos de cancelamento e auditoria no pedido
-- Segura: usa IF NOT EXISTS, sem DROP, sem TRUNCATE.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by BIGINT UNSIGNED NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at DATETIME NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(255) NULL;

-- Vincula usuário que cancelou
ALTER TABLE orders ADD CONSTRAINT fk_order_cancelled_by
  FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL;
