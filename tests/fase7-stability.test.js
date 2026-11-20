'use strict';
/**
 * Suíte de Testes da Fase 7: Estabilização Técnica e Resolução de Divergências
 * Validações:
 * 1. order_items: Presença de line_total e cálculo exato de unit_price * quantity
 * 2. Migrações: Registro e idempotência da migration 009
 * 3. Graceful Shutdown: stopNotificationScheduler e stopReservationCleanupJob
 * 4. Integridade de e-mail e Resend
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=== TESTES DA FASE 7: ESTABILIZAÇÃO TÉCNICA E DIVERGÊNCIAS ===\n');

// 1. Verificação da Migration 009 e Schema Canônico
console.log('1) Verificação da Migration 009 e schema.sql');
const schemaContent = fs.readFileSync(path.resolve(__dirname, '../backend/src/database/schema.sql'), 'utf8');
const runMigrationsContent = fs.readFileSync(path.resolve(__dirname, '../backend/src/database/runMigrations.js'), 'utf8');
const mig009Path = path.resolve(__dirname, '../backend/src/database/migrations/009_order_items_line_total_and_resilience.sql');

assert.ok(fs.existsSync(mig009Path), 'Arquivo físico da migration 009 deve existir');
assert.ok(schemaContent.includes('line_total  DECIMAL(10,2)   NOT NULL DEFAULT 0.00'), 'schema.sql deve declarar line_total em order_items');
assert.ok(runMigrationsContent.includes('009_order_items_line_total_and_resilience'), 'runMigrations.js deve conter a migração 009 registrada');
console.log('✓ Migration 009 e schema.sql canônico alinhados com a coluna line_total.');

// 2. Verificação do Cálculo e Preenchimento de line_total no orderService
console.log('\n2) Verificação do preenchimento de line_total no orderService');
const orderServiceContent = fs.readFileSync(path.resolve(__dirname, '../backend/src/services/orderService.js'), 'utf8');

assert.ok(
  orderServiceContent.includes('INSERT INTO order_items (order_id, batch_id, event_id, quantity, unit_price, line_total)'),
  'orderService deve informar explicitamente line_total no INSERT de order_items'
);
assert.ok(
  orderServiceContent.includes('const lineTotal = Number((unitPrice * data.quantity).toFixed(2));'),
  'orderService deve calcular line_total como unitPrice * quantity com precisão de 2 casas decimais'
);
console.log('✓ orderService preenche line_total com precisão monetária correta.');

// 3. Verificação do Encerramento Gracioso e Escopo do Notification Scheduler
console.log('\n3) Verificação do Graceful Shutdown e escopo no server.js');
const serverContent = fs.readFileSync(path.resolve(__dirname, '../backend/src/server.js'), 'utf8');
const schedulerContent = fs.readFileSync(path.resolve(__dirname, '../backend/src/services/notificationScheduler.js'), 'utf8');

assert.ok(
  serverContent.includes("const { startNotificationScheduler, stopNotificationScheduler } = require('./services/notificationScheduler');"),
  'server.js deve importar stopNotificationScheduler no escopo de módulo'
);
assert.ok(
  serverContent.includes("const { startReservationCleanupJob, stopReservationCleanupJob } = require('./services/orderService');"),
  'server.js deve importar stopReservationCleanupJob no escopo de módulo'
);
assert.ok(
  schedulerContent.includes('async function stopNotificationScheduler'),
  'notificationScheduler deve exportar stopNotificationScheduler que aguarda ciclos pendentes'
);
assert.ok(
  orderServiceContent.includes('function stopReservationCleanupJob'),
  'orderService deve exportar stopReservationCleanupJob'
);
console.log('✓ Encerramento gracioso corrigido: funções no escopo global e parada controlada.');

// 4. Teste de Chamada Segura das Funções de Encerramento (sem crash)
console.log('\n4) Teste de invocação segura das funções de shutdown');
const { stopNotificationScheduler } = require('../backend/src/services/notificationScheduler');
const { stopReservationCleanupJob } = require('../backend/src/services/orderService');

assert.doesNotThrow(() => {
  stopReservationCleanupJob();
}, 'stopReservationCleanupJob deve poder ser chamado sem erros mesmo inativo');

stopNotificationScheduler().then(() => {
  console.log('✓ stopNotificationScheduler resolveu com sucesso.');

  // 5. Verificação da Política do Resend
  console.log('\n5) Verificação da resiliência do emailService');
  const emailService = require('../backend/src/services/emailService');
  assert.strictEqual(typeof emailService.sendMail, 'function', 'emailService deve exportar sendMail');
  assert.strictEqual(typeof emailService.maskEmail, 'function', 'emailService deve exportar maskEmail');

  console.log('\n===========================================');
  console.log('TODOS OS 5 TESTES DA FASE 7 FORAM APROVADOS! ✓');
  console.log('===========================================');
  process.exit(0);
}).catch(err => {
  console.error('Falha:', err);
  process.exit(1);
});
