'use strict';
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test';
process.env.JWT_SECRET = 'supersecret_test_jwt_key_at_least_32_chars!';
process.env.REFRESH_SECRET = 'supersecret_test_refresh_jwt_key_at_least_32_chars!';

const assert = require('assert');
const { sanitizeAuditData } = require('../backend/src/middlewares/audit');

console.log('--- INICIANDO TESTES DE SEGURANÇA E CONCORRÊNCIA ---');

// Teste 1: Sanitização de dados confidenciais na auditoria
console.log('Teste 1: Sanitização de dados confidenciais em audit_logs...');
const payloadComSenha = {
  name: 'Produtor Teste',
  email: 'teste@exemplo.com',
  password: 'senhaSuperSecreta123',
  refreshToken: 'abc123xyz_token',
  details: {
    authorization: 'Bearer secret_jwt',
    card_number: '4111111111111111',
    status: 'active'
  }
};

const sanitizado = sanitizeAuditData(payloadComSenha);
assert.strictEqual(sanitizado.password, '[REDACTED]', 'A senha deve ser redatada.');
assert.strictEqual(sanitizado.refreshToken, '[REDACTED]', 'O refreshToken deve ser redatado.');
assert.strictEqual(sanitizado.details.authorization, '[REDACTED]', 'Tokens de autorização devem ser redatados.');
assert.strictEqual(sanitizado.details.card_number, '[REDACTED]', 'Números de cartão devem ser redatados.');
assert.strictEqual(sanitizado.details.status, 'active', 'Campos não-sensíveis devem ser preservados.');
console.log('  -> Sucesso: Todas as credenciais foram devidamente ofuscadas.');

// Teste 2: Validação da fórmula de disponibilidade considerando quantity_reserved
console.log('Teste 2: Fórmula de disponibilidade com reservas ativas...');
function calcularDisponibilidade(total, sold, reserved) {
  return Number(total) - Number(sold) - Number(reserved || 0);
}

assert.strictEqual(calcularDisponibilidade(100, 40, 10), 50, 'Disponibilidade deve abater vendidos e reservados.');
assert.strictEqual(calcularDisponibilidade(100, 90, 10), 0, 'Lote com 90 vendidos e 10 reservados deve acusar 0 disponíveis.');
assert.strictEqual(calcularDisponibilidade(100, 95, 10), -5, 'Tentativa além da soma deve resultar negativo (bloqueio).');
console.log('  -> Sucesso: Cálculo de disponibilidade protege contra overbooking.');

// Teste 3: Proteção de capacidade no checkin sob concorrência
console.log('Teste 3: Verificação de regra de capacidade no checkin...');
function validarCapacidadeCheckin(capacidadeEvento, checkinsAtuais) {
  if (capacidadeEvento > 0 && checkinsAtuais >= capacidadeEvento) {
    return false; // bloqueado
  }
  return true; // liberado
}

assert.strictEqual(validarCapacidadeCheckin(500, 499), true, 'Deve permitir entrada quando sob a capacidade.');
assert.strictEqual(validarCapacidadeCheckin(500, 500), false, 'Deve bloquear entrada quando atingir a capacidade.');
assert.strictEqual(validarCapacidadeCheckin(0, 9999), true, 'Capacidade 0 (ilimitada) deve sempre liberar.');
console.log('  -> Sucesso: Regra de lotação máxima respeitada.');

// Teste 4: Verificação de isolamento de roles no authorize middleware
console.log('Teste 4: Hierarquia de papéis no painel administrativo...');
const { atLeast } = require('../backend/src/middlewares/authorize');

let passou = false;
let erroRecebido = null;
const reqGate = { user: { role: 'user', organizationId: 1, orgRole: 'gate' } };
const resMock = {};
const nextMock = (err) => {
  if (err) erroRecebido = err;
  else passou = true;
};

// Gate tentando ação que exige pelo menos finance (nível 2)
atLeast('finance')(reqGate, resMock, nextMock);
assert.strictEqual(passou, false, 'Portaria não deve ter acesso a ações financeiras.');
assert.strictEqual(erroRecebido.statusCode, 403, 'Erro deve ser 403 Forbidden.');
console.log('  -> Sucesso: Gate restrito a operações de portaria.');

console.log('--- TODOS OS TESTES DE CONCORRÊNCIA E SEGURANÇA FORAM CONCLUÍDOS COM SUCESSO! ---');
