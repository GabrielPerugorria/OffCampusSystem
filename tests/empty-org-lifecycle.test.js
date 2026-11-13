'use strict';
/**
 * Suíte de Testes do Ciclo Operacional Completo
 * Validação:
 * 1. Organização limpa (0 eventos fictícios)
 * 2. Criação do primeiro evento
 * 3. Criação de lotes de ingressos
 * 4. Compra e criação de pedido
 * 5. Emissão oficial de ingressos com código único
 * 6. Validação e Check-in na portaria (prevenção de reentrada)
 * 7. Cadastro de produto no Open Bar e movimentação
 * 8. Lançamento de despesa operacional
 * 9. Cálculo exato de indicadores financeiros e ROI
 * 10. Limpeza do ciclo de teste (retorno ao estado limpo)
 * 
 * Execução: node tests/empty-org-lifecycle.test.js
 */

const assert = require('assert');
const path = require('path');
const db = require('../backend/src/config/db');
const eventService = require('../backend/src/services/eventService');
const orderService = require('../backend/src/services/orderService');
const checkinService = require('../backend/src/services/checkinService');
const inventoryService = require('../backend/src/services/inventoryService');
const financeService = require('../backend/src/services/financeService');

async function run() {
  console.log('=== TESTE DE CICLO OPERACIONAL COMPLETO (TESTES REAIS) ===\n');

  // 1. Identificar organização e admin
  const org = await db.queryOne(`SELECT * FROM organizations WHERE slug = 'offcampus' LIMIT 1`);
  assert(org, 'Organização principal "offcampus" deve existir');
  const admin = await db.queryOne(`SELECT * FROM users WHERE email = 'admin@evotech.com' LIMIT 1`);
  assert(admin, 'Usuário admin@evotech.com deve existir');
  const orgId = org.id;
  const adminUser = { id: admin.id, organizationId: orgId, role: 'platform_admin' };

  console.log(`[PASSO 1] Organização: [${orgId}] ${org.name} | Admin: ${admin.email}`);

  // 2. Verificar estado inicial limpo
  const initialEvents = await eventService.listByOrganization(orgId, {});
  console.log(`[PASSO 2] Eventos cadastrados antes do teste: ${initialEvents.length}`);
  assert.strictEqual(initialEvents.length, 0, 'Organização deve iniciar com 0 eventos');

  // 3. Criar primeiro evento
  console.log('[PASSO 3] Criando primeiro evento real...');
  const newEventData = {
    name: 'Festival EvoTech Verão 2027',
    type: 'Festival de Música',
    eventDate: '2027-01-20 20:00:00',
    venue: 'Espaço das Américas, Curitiba',
    capacity: 500,
    status: 'active',
    description: 'Evento de inauguração do sistema para testes reais.',
    rules: 'Entrada permitida somente com documento original.',
    goalAttendance: 400,
    goalRevenue: 40000,
  };
  const createdEvent = await eventService.create(orgId, newEventData);
  assert(createdEvent.id, 'Evento deve ser criado com ID');
  assert.strictEqual(createdEvent.name, newEventData.name);
  console.log(`✓ Evento criado: ID ${createdEvent.id} ("${createdEvent.name}")`);

  // 4. Criar Lote de Ingressos
  console.log('[PASSO 4] Criando lote de ingressos...');
  const batchData = {
    name: '1º Lote Pista',
    price: 80.00,
    quantityTotal: 100,
    status: 'active',
  };
  const createdBatch = await eventService.createBatch(createdEvent.id, orgId, batchData);
  assert(createdBatch.id, 'Lote deve ser criado com ID');
  assert.strictEqual(Number(createdBatch.price), 80.00);
  assert.strictEqual(Number(createdBatch.quantityTotal), 100);
  console.log(`✓ Lote criado: ID ${createdBatch.id} ("${createdBatch.name}") - R$ 80,00`);

  // 5. Realizar Pedido (Venda de 2 Ingressos)
  console.log('[PASSO 5] Realizando pedido e emissão de ingressos...');
  const orderData = {
    batchId: createdBatch.id,
    quantity: 2,
    buyerName: 'Marcos Vinicius',
    buyerEmail: 'marcos.vinicius@teste.com',
    buyerCpf: '12345678909',
  };
  const createdOrder = await orderService.createOrder(orderData, adminUser);
  assert(createdOrder.orderId, 'Pedido deve ser gerado');
  assert.strictEqual(Number(createdOrder.total), 160.00, 'Total do pedido deve ser 2 * 80 = 160');
  console.log(`✓ Pedido gerado: #${createdOrder.orderId} - Total: R$ ${createdOrder.total}`);

  // 6. Verificar Ingressos Emitidos
  const tickets = await db.query(
    'SELECT * FROM tickets WHERE order_id = ? ORDER BY id ASC',
    [createdOrder.orderId]
  );
  assert.strictEqual(tickets.length, 2, 'Devem ser emitidos exatamente 2 ingressos');
  const ticket1 = tickets[0];
  const ticket2 = tickets[1];
  assert(ticket1.code, 'Ingresso deve conter código alfanumérico único');
  assert.notStrictEqual(ticket1.code, ticket2.code, 'Códigos de ingressos devem ser distintos');
  console.log(`✓ Ingressos emitidos: [${ticket1.code}] e [${ticket2.code}]`);

  // 7. Check-in na Portaria
  console.log('[PASSO 7] Realizando check-in do primeiro ingresso...');
  const checkinResult = await checkinService.checkIn({ code: ticket1.code }, adminUser);
  assert.strictEqual(checkinResult.ticketId, ticket1.id, 'Check-in deve bater com ID do ingresso');
  assert.strictEqual(checkinResult.guestName, ticket1.holder_name);
  console.log(`✓ Check-in realizado com sucesso: ${checkinResult.guestName}`);

  // 8. Tentar reentrada com o mesmo ingresso (deve ser bloqueado)
  console.log('[PASSO 8] Testando bloqueio de reentrada...');
  let doubleCheckinBlocked = false;
  try {
    await checkinService.checkIn({ code: ticket1.code }, adminUser);
  } catch (err) {
    doubleCheckinBlocked = true;
    console.log(`✓ Reentrada bloqueada corretamente: "${err.message}"`);
  }
  assert.strictEqual(doubleCheckinBlocked, true, 'Reentrada com ingresso já utilizado deve ser bloqueada');

  // 9. Cadastro de Produto no Bar e Estoque
  console.log('[PASSO 9] Cadastrando produto no Open Bar...');
  const productData = {
    name: 'Cerveja Artesanal IPA',
    emoji: '🍺',
    category: 'Cerveja',
    unitCost: 6.50,
    stockQuantity: 100,
    minStock: 20,
  };
  const createdProduct = await inventoryService.create(orgId, productData, adminUser.id);
  assert(createdProduct.id, 'Produto deve ser criado com ID');
  console.log(`✓ Produto criado: ID ${createdProduct.id} ("${createdProduct.name}")`);

  // 10. Lançamento de Despesa Operacional
  console.log('[PASSO 10] Lançando despesa operacional...');
  const expenseData = {
    categoryName: 'Segurança',
    amount: 60.00,
    description: 'Equipe de segurança da portaria',
    eventId: createdEvent.id,
  };
  const createdExpense = await financeService.createExpense(orgId, adminUser.id, expenseData);
  assert(createdExpense.id, 'Despesa deve ser registrada com ID');
  assert.strictEqual(Number(createdExpense.amount), 60.00);
  console.log(`✓ Despesa lançada: ID ${createdExpense.id} - R$ ${createdExpense.amount}`);

  // 11. Validação dos Indicadores Consolidados
  console.log('[PASSO 11] Verificando métricas e indicadores consolidados...');
  const updatedEvent = await eventService.getOwned(createdEvent.id, orgId);
  assert.strictEqual(updatedEvent.sold, 2, 'Vendidos deve ser 2');
  assert.strictEqual(updatedEvent.revenue, 160.00, 'Receita deve ser 160,00');
  assert.strictEqual(updatedEvent.checkins, 1, 'Checkins registrados deve ser 1');
  assert.strictEqual(updatedEvent.averageTicket, 80.00, 'Ticket médio deve ser 80,00');

  const receitaTotal = updatedEvent.revenue;
  const despesaTotal = Number(createdExpense.amount);
  const saldoOperacional = receitaTotal - despesaTotal;
  const margem = ((saldoOperacional) / receitaTotal) * 100;
  const roi = ((saldoOperacional) / despesaTotal) * 100;

  assert.strictEqual(saldoOperacional, 100.00, 'Saldo deve ser 160 - 60 = 100');
  assert.strictEqual(margem, 62.5, 'Margem deve ser 100/160 = 62.5%');
  assert.strictEqual(roi, (100 / 60) * 100, 'ROI deve ser 100/60 = 166.67%');
  console.log(`✓ Métricas validadas com perfeição: Receita: R$ 160,00 | Saldo: R$ ${saldoOperacional.toFixed(2)} | Margem: ${margem.toFixed(1)}% | ROI: ${roi.toFixed(1)}%`);

  // 12. Limpeza pós-teste: restaurar estado 100% limpo
  console.log('\n[PASSO 12] Limpando dados do teste para deixar a base pronta para testes reais...');
  await db.transaction(async (conn) => {
    await conn.execute('DELETE FROM checkins WHERE event_id = ?', [createdEvent.id]);
    await conn.execute('DELETE FROM tickets WHERE event_id = ?', [createdEvent.id]);
    await conn.execute('DELETE FROM order_items WHERE event_id = ?', [createdEvent.id]);
    await conn.execute('DELETE FROM orders WHERE event_id = ?', [createdEvent.id]);
    await conn.execute('DELETE FROM ticket_batches WHERE event_id = ?', [createdEvent.id]);
    await conn.execute('DELETE FROM expenses WHERE id = ?', [createdExpense.id]);
    await conn.execute('DELETE FROM stock_movements WHERE product_id = ?', [createdProduct.id]);
    await conn.execute('DELETE FROM products WHERE id = ?', [createdProduct.id]);
    await conn.execute('DELETE FROM events WHERE id = ?', [createdEvent.id]);
  });

  const finalEvents = await eventService.listByOrganization(orgId, {});
  assert.strictEqual(finalEvents.length, 0, 'Organização deve retornar ao estado vazio (0 eventos)');
  console.log('✓ Base restaurada com sucesso ao estado inicial limpo (0 eventos).\n');

  console.log('======================================================');
  console.log(' CICLO OPERACIONAL COMPLETO VALIDADO COM 100% SUCESSO! ');
  console.log('======================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('\nFALHA NO TESTE DO CICLO OPERACIONAL:', err);
  process.exit(1);
});
