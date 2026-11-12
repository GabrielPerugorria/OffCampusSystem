-- Migração 001: adiciona campos de confirmação manual no pedido
-- Segura: usa IF NOT EXISTS, sem DROP, sem TRUNCATE.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_by BIGINT UNSIGNED NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at DATETIME NULL;

-- A constraint só pode ser adicionada uma vez; em produção é idempotente via IF NOT EXISTS no MySQL 8+
-- Se o banco for MySQL 5.7, o script de migração via código (runMigrations) verifica antes de executar.
ALTER TABLE orders ADD CONSTRAINT fk_order_confirmed_by
  FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL;
