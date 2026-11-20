-- ==============================================================================
-- MIGRAÇÃO 009: Adiciona line_total em order_items e garante integridade monetária
-- Data: 2026-11-20
-- Alinhamento canônico entre código, schema.sql e banco remoto Aiven/Deplexo
-- ==============================================================================

-- 1. Adiciona line_total com DEFAULT 0.00 para evitar quebra de constraints existentes
-- Nota: Caso a coluna já exista no banco remoto, a rotina incremental em runMigrations.js
-- valida e ajusta a coluna de forma idempotente sem falhar.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS line_total DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER unit_price;

-- 2. Backfill seguro: preenche line_total com o cálculo exato unit_price * quantity
UPDATE order_items
   SET line_total = ROUND(quantity * unit_price, 2)
 WHERE line_total = 0.00 OR line_total IS NULL;
