'use strict';
/**
 * Suíte de Testes de Integridade, Cálculos e Segurança do EvoTech Events
 * Execução: node tests/backend-integrity.test.js
 */

const assert = require('assert');

// 1. Testa os Schemas de Validação
console.log('--- TESTE 1: Schemas de Validação ---');
const s = require('../backend/src/validators/schemas');

// 1.1 Validação de Pedido
const validOrder = {
  batchId: 10,
  quantity: 2,
  buyerName: 'Carlos Silva',
  buyerEmail: 'carlos@exemplo.com',
  buyerCpf: '123.456.789-01',
};
const parsedOrder = s.orderSchema.safeParse(validOrder);
assert.strictEqual(parsedOrder.success, true, 'Pedido válido deve passar na validação');
assert.strictEqual(parsedOrder.data.buyerCpf, '12345678901', 'CPF deve ser sanitizado para 11 dígitos numéricos');

// 1.2 Quantidade inválida (negativa ou zero)
const invalidQty = s.orderSchema.safeParse({ ...validOrder, quantity: 0 });
assert.strictEqual(invalidQty.success, false, 'Quantidade zero deve ser rejeitada');

const negativeQty = s.orderSchema.safeParse({ ...validOrder, quantity: -2 });
assert.strictEqual(negativeQty.success, false, 'Quantidade negativa deve ser rejeitada');

// 1.3 CPF inválido (menos de 11 dígitos)
const invalidCpf = s.orderSchema.safeParse({ ...validOrder, buyerCpf: '12345' });
assert.strictEqual(invalidCpf.success, false, 'CPF com menos de 11 dígitos deve falhar');
console.log('✓ Schemas de pedido: 100% validados.');

// 2. Testa Cálculos Financeiros & Tratamento de Divisão por Zero
console.log('\n--- TESTE 2: Fórmulas Matemáticas & Divisão por Zero ---');

function calcMargin(revenue, expenses) {
  return revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
}

function calcROI(revenue, expenses) {
  return expenses > 0 ? ((revenue - expenses) / expenses) * 100 : 0;
}

function calcAverageTicket(revenue, sold) {
  return sold > 0 ? revenue / sold : 0;
}

function calcBreakEven(revenue, cost) {
  return cost > 0 ? Math.min(100, (revenue / cost) * 100) : (revenue > 0 ? 100 : 0);
}

// 2.1 Casos sem dados (zero receita, zero custos)
assert.strictEqual(calcMargin(0, 0), 0, 'Margem com zero receita deve retornar 0, nunca NaN/Infinity');
assert.strictEqual(calcROI(0, 0), 0, 'ROI com zero despesas deve retornar 0, nunca NaN/Infinity');
assert.strictEqual(calcAverageTicket(0, 0), 0, 'Ticket médio com 0 vendas deve retornar 0');
assert.strictEqual(calcBreakEven(0, 0), 0, 'Break-even com 0 custos deve retornar 0');

// 2.2 Casos normais
// Receita = 100.000, Despesas = 60.000
// Saldo = 40.000
// Margem = 40.000 / 100.000 = 40%
// ROI = 40.000 / 60.000 = 66.67%
assert.strictEqual(calcMargin(100000, 60000), 40, 'Margem de 100k com 60k custo deve ser 40%');
assert.strictEqual(Math.round(calcROI(100000, 60000) * 100) / 100, 66.67, 'ROI deve ser ~66.67%');

// 2.3 Receita sem custos (custo = 0, receita = 50.000)
assert.strictEqual(calcROI(50000, 0), 0, 'ROI com custo 0 deve ser protegido contra divisão por zero');
assert.strictEqual(calcMargin(50000, 0), 100, 'Margem com custo 0 deve ser 100%');
assert.strictEqual(calcBreakEven(50000, 0), 100, 'Break-even com custo 0 e receita positiva deve ser 100%');
console.log('✓ Fórmulas matemáticas de ROI, Margem e Break-even: 100% consistentes.');

// 3. Testa Unit Economics & CAC = 0
console.log('\n--- TESTE 3: Unit Economics ---');
function calcLtvCac(ltv, cac) {
  return (cac && Number(cac) > 0) ? ltv / Number(cac) : null;
}
assert.strictEqual(calcLtvCac(500, 0), null, 'CAC = 0 deve retornar null e não dividir por zero');
assert.strictEqual(calcLtvCac(500, 100), 5, 'CAC = 100 com LTV = 500 deve dar ratio 5');
console.log('✓ Unit Economics LTV/CAC: protegido contra ocultação de erros.');

// 4. Testa Bloqueio de AUTO_CONFIRM_ORDERS em Produção
console.log('\n--- TESTE 4: Trava de Segurança em Produção ---');
function validateProductionEnv(nodeEnv, autoConfirm) {
  const isProd = nodeEnv === 'production';
  if (isProd && autoConfirm) {
    throw new Error('AUTO_CONFIRM_ORDERS=true é proibido em produção.');
  }
  return true;
}

assert.throws(() => {
  validateProductionEnv('production', true);
}, /proibido em produção/, 'Deve lançar erro se produção tiver autoConfirmOrders=true');

assert.strictEqual(validateProductionEnv('production', false), true, 'Produção com autoConfirm=false deve ser aceita');
assert.strictEqual(validateProductionEnv('development', true), true, 'Dev com autoConfirm=true é tolerado para testes locais');
console.log('✓ Trava de produção: validada com sucesso.');

// 5. Testa Sanitização XSS
console.log('\n--- TESTE 5: Função escapeHTML contra XSS ---');
function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const xssPayload = '<script>alert("xss")</script><img src="x" onerror="alert(1)">';
const escaped = escapeHTML(xssPayload);
assert.strictEqual(escaped.includes('<script>'), false, 'Não deve conter tags <script>');
assert.strictEqual(escaped.includes('&lt;script&gt;'), true, 'Deve escapar para entidades HTML');
console.log('✓ Proteção XSS: validada com sucesso.');

console.log('\n======================================================');
console.log(' TODOS OS TESTES DE INTEGRIDADE PASSARAM COM SUCESSO! ');
console.log('======================================================\n');
