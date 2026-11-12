-- Migração 002: tabela order_items para registrar lotes/quantidades de cada pedido
-- Segura: usa IF NOT EXISTS, sem DROP, sem TRUNCATE.

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
