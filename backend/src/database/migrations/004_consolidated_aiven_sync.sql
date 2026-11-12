-- ============================================================================
-- EVOTECH EVENTS / OFFCAMPUS SYSTEM
-- MIGRAÇÃO INCREMENTAL 004: CONSOLIDAÇÃO E SINCRONIZAÇÃO AIVEN
-- ============================================================================
-- ATENÇÃO: NÃO EXECUTE ESTE ARQUIVO SE ELE JÁ TIVER SIDO APLICADO NO BANCO AIVEN.
-- ESTE SCRIPT FOI PROJETADO PARA SER NÃO-DESTRUTIVO:
-- NÃO CONTÉM DROP TABLE, NÃO CONTÉM TRUNCATE E PRESERVA TODOS OS DADOS EXISTENTES.
-- ============================================================================

-- 1. Tabela order_items: Detalhamento por lote de cada pedido
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabela ticket_batches: Controle de reservas temporárias
-- Evita overbooking entre a criação do pedido pendente e o pagamento efetivo
ALTER TABLE ticket_batches
  ADD COLUMN IF NOT EXISTS quantity_reserved INT UNSIGNED NOT NULL DEFAULT 0;

-- 3. Tabela orders: Auditoria de confirmação, cancelamento e janela de expiração
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS confirmed_by BIGINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by BIGINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS is_legacy TINYINT(1) NOT NULL DEFAULT 0;

-- 4. Foreign keys seguras para auditoria de pedidos
-- (Verificar se a constraint já existe antes no MySQL caso execute manualmente)
-- ALTER TABLE orders ADD CONSTRAINT fk_order_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL;
-- ALTER TABLE orders ADD CONSTRAINT fk_order_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL;

-- 5. Tabela audit_logs: Metadados detalhados de auditoria em JSON
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS details JSON NULL;

-- ============================================================================
-- FIM DA MIGRAÇÃO 004
-- ============================================================================
