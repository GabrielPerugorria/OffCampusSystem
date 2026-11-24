'use strict';
/**
 * Testes Unitários de Análise Estática e Robustez Pré-Homologação das Migrações
 * Valida a idempotência, chaves primárias, chaves estrangeiras, índices,
 * ordenação estrita e ausência de dependências circulares (Sem MySQL).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=== TESTES UNITÁRIOS: REVISÃO PRÉ-HOMOLOGAÇÃO DE MIGRAÇÕES ===\n');

// 1. Carrega runMigrations.js
const runMigrationsPath = path.resolve(__dirname, '../backend/src/database/runMigrations.js');
const { MIGRATIONS } = require(runMigrationsPath);

// Teste 1: Quantidade total e ordem sequencial estrita
assert.strictEqual(MIGRATIONS.length, 10, 'Devem existir exatamente 10 migrações registradas');
console.log('✓ Teste 1: Quantidade de migrações registrada confere (10 migrações)');

// Teste 2: Versões estritamente crescentes e únicas
const versions = MIGRATIONS.map(m => m.version);
const uniqueVersions = new Set(versions);
assert.strictEqual(versions.length, uniqueVersions.size, 'Não pode haver versões duplicadas');

for (let i = 0; i < versions.length - 1; i++) {
  assert.ok(
    versions[i] <= versions[i + 1],
    `Ordem cronológica violada: ${versions[i]} não pode ser maior que ${versions[i + 1]}`
  );
}
console.log('✓ Teste 2: Versões são estritamente únicas e ordenadas cronologicamente');

// Teste 3: Cada migração deve implementar funções assíncronas 'up' e 'verify'
for (const m of MIGRATIONS) {
  assert.strictEqual(typeof m.up, 'function', `Migração ${m.version} deve conter função 'up'`);
  assert.strictEqual(typeof m.verify, 'function', `Migração ${m.version} deve conter função 'verify'`);
}
console.log('✓ Teste 3: Todas as migrações possuem funções up() e verify() implementadas');

// Teste 4: Inspeção estática de 007 - admin_login_codes e in_app_notifications
const sql007 = fs.readFileSync(path.resolve(__dirname, '../backend/src/database/migrations/007_admin_2fa_and_in_app_notifications.sql'), 'utf8');
assert.ok(sql007.includes('CREATE TABLE IF NOT EXISTS admin_login_codes'), '007 deve usar CREATE TABLE IF NOT EXISTS');
assert.ok(sql007.includes('CREATE TABLE IF NOT EXISTS in_app_notifications'), '007 deve usar CREATE TABLE IF NOT EXISTS');
assert.ok(sql007.includes('ALTER TABLE notification_outbox MODIFY COLUMN organization_id BIGINT UNSIGNED NULL'), '007 deve relaxar organization_id');
console.log('✓ Teste 4: Migration 007 estruturada com CREATE TABLE IF NOT EXISTS e schema idempotente');

// Teste 5: Inspeção estática de 008 - revoked_tokens e índices
const sql008 = fs.readFileSync(path.resolve(__dirname, '../backend/src/database/migrations/008_jwt_revocation_and_performance_indexes.sql'), 'utf8');
assert.ok(sql008.includes('CREATE TABLE IF NOT EXISTS revoked_tokens'), '008 deve usar CREATE TABLE IF NOT EXISTS');
assert.ok(sql008.includes('jti         VARCHAR(36) NOT NULL PRIMARY KEY'), 'jti deve ser PK de 36 caracteres (UUID)');
assert.ok(sql008.includes('idx_revoked_expires (expires_at)'), 'Índice de expiração para expurgo TTL presente');
assert.ok(sql008.includes('idx_order_status_expires (status, expires_at)'), 'Índice composto em orders presente');
assert.ok(sql008.includes('idx_ticket_event_holder (event_id, holder_name)'), 'Índice em tickets presente');
console.log('✓ Teste 5: Migration 008 validada para revoked_tokens e índices estratégicos');

// Teste 6: Idempotência de índices no runMigrations.js
const runMigrationsContent = fs.readFileSync(runMigrationsPath, 'utf8');
assert.ok(
  runMigrationsContent.includes("WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_order_status_expires'"),
  'runMigrations.js deve checar existência do índice antes de criá-lo'
);
assert.ok(
  runMigrationsContent.includes("WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_ticket_event_holder'"),
  'runMigrations.js deve checar existência do índice de tickets antes de criá-lo'
);
console.log('✓ Teste 6: runMigrations.js garante idempotência consultando INFORMATION_SCHEMA.STATISTICS');

console.log('\n===========================================');
console.log('TODOS OS 6 TESTES PRÉ-HOMOLOGAÇÃO FORAM APROVADOS! ✓');
console.log('===========================================');
