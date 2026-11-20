'use strict';
/**
 * Testes Unitários de Integridade das Migrações e Schemas SQL (Sem MySQL)
 * Valida o registro de 007 e 008 em runMigrations.js, a sintaxe das migrações
 * e a consistência entre schema.sql e as migrações incrementais.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=== TESTES UNITÁRIOS: INTEGRIDADE DO SISTEMA DE MIGRAÇÕES ===\n');

// 1. Carrega runMigrations.js
const runMigrationsPath = path.resolve(__dirname, '../backend/src/database/runMigrations.js');
const runMigrationsContent = fs.readFileSync(runMigrationsPath, 'utf8');

// Teste 1: Registro da migração 007
assert.ok(
  runMigrationsContent.includes("version: '20261120_007'") &&
  runMigrationsContent.includes("name: '007_admin_2fa_and_in_app_notifications'"),
  'runMigrations.js deve conter a migração 007 registrada'
);
console.log('✓ Teste 1: Migração 007 registrada no array MIGRATIONS de runMigrations.js');

// Teste 2: Registro da migração 008
assert.ok(
  runMigrationsContent.includes("version: '20261120_008'") &&
  runMigrationsContent.includes("name: '008_jwt_revocation_and_performance_indexes'"),
  'runMigrations.js deve conter a migração 008 registrada'
);
console.log('✓ Teste 2: Migração 008 registrada no array MIGRATIONS de runMigrations.js');

// Teste 3: Migração 008 inclui criação de revoked_tokens e índices
assert.ok(
  runMigrationsContent.includes('CREATE TABLE IF NOT EXISTS revoked_tokens') &&
  runMigrationsContent.includes('idx_order_status_expires') &&
  runMigrationsContent.includes('idx_ticket_event_holder'),
  'Migração 008 deve criar revoked_tokens e índices recomendados'
);
console.log('✓ Teste 3: Conteúdo de migração 008 contém revoked_tokens e índices compostos de performance');

// 2. Validação dos arquivos físicos em migrations/
const migrationsDir = path.resolve(__dirname, '../backend/src/database/migrations');
const files = fs.readdirSync(migrationsDir);

const expectedFiles = [
  '001_add_order_confirmation_fields.sql',
  '002_add_order_items.sql',
  '003_add_order_cancellation_fields.sql',
  '004_consolidated_aiven_sync.sql',
  '005_add_password_resets_and_email_tracking.sql',
  '006_notification_system.sql',
  '007_admin_2fa_and_in_app_notifications.sql',
  '008_jwt_revocation_and_performance_indexes.sql',
  '009_order_items_line_total_and_resilience.sql'
];

for (const expected of expectedFiles) {
  assert.ok(files.includes(expected), `Arquivo físico de migração ausente: ${expected}`);
}
console.log('✓ Teste 4: Todos os 9 arquivos físicos de migração existem na pasta migrations/');

// 3. Validação do arquivo 008_jwt_revocation_and_performance_indexes.sql
const sql008Path = path.join(migrationsDir, '008_jwt_revocation_and_performance_indexes.sql');
const sql008Content = fs.readFileSync(sql008Path, 'utf8');

assert.ok(sql008Content.includes('jti         VARCHAR(36) NOT NULL PRIMARY KEY'), 'Deve definir jti como PK');
assert.ok(sql008Content.includes('expires_at  DATETIME NOT NULL'), 'Deve conter data de expiração para política de limpeza');
assert.ok(sql008Content.includes('idx_revoked_expires (expires_at)'), 'Deve conter índice em expires_at para expurgo eficiente');
assert.ok(sql008Content.includes('idx_order_status_expires (status, expires_at)'), 'Deve conter índice composto para liberação de reservas');
assert.ok(sql008Content.includes('idx_ticket_event_holder (event_id, holder_name)'), 'Deve conter índice composto em tickets');
console.log('✓ Teste 5: Estrutura da migração 008 validada com jti, TTL (expires_at) e índices estratégicos');

// 4. Validação do schema.sql consolidado
const schemaSqlPath = path.resolve(__dirname, '../backend/src/database/schema.sql');
const schemaSqlContent = fs.readFileSync(schemaSqlPath, 'utf8');

assert.ok(schemaSqlContent.includes('CREATE TABLE revoked_tokens'), 'schema.sql deve conter a tabela revoked_tokens');
console.log('✓ Teste 6: schema.sql consolidado atualizado e alinhado com a migração 008');

console.log('\n===========================================');
console.log('TODOS OS 6 TESTES DE INTEGRIDADE DAS MIGRAÇÕES PASSARAM! ✓');
console.log('===========================================');
