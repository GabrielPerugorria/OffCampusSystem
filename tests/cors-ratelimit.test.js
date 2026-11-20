'use strict';
/**
 * Testes de CORS e Rate Limiting — SEM MySQL.
 * Verifica configurações de segurança diretamente no código-fonte.
 *
 * Executar:  node tests/cors-ratelimit.test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✔ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✘ ${name}`);
    console.log(`    → ${err.message}`);
    failed++;
  }
}

const projectRoot = path.resolve(__dirname, '..');

console.log('\n=== CORS & RATE LIMITING TESTS ===\n');

// --- CORS ---
console.log('1) Configuração CORS');

test('cors.js existe e exporta função origin', () => {
  const corsPath = path.join(projectRoot, 'backend/src/config/cors.js');
  assert.ok(fs.existsSync(corsPath), 'cors.js não encontrado');
  const content = fs.readFileSync(corsPath, 'utf8');
  assert.ok(content.includes('origin('), 'Deve exportar função origin');
  assert.ok(content.includes('callback'), 'Deve usar callback');
});

test('CORS rejeita origens não listadas em produção', () => {
  const corsPath = path.join(projectRoot, 'backend/src/config/cors.js');
  const content = fs.readFileSync(corsPath, 'utf8');
  // Verifica que em produção (isProduction) não aceita qualquer origem
  assert.ok(
    content.includes('env.isProduction') || content.includes('isProduction'),
    'CORS deve diferenciar produção de desenvolvimento'
  );
  // Não deve ter origin: '*' nem origin: true incondicional
  assert.ok(!content.includes("origin: '*'"), 'CORS não deve ter wildcard incondicional');
  assert.ok(!content.includes('origin: true'), 'CORS não deve ter origin: true incondicional');
});

test('env.js exige CORS_ORIGINS em produção', () => {
  const envPath = path.join(projectRoot, 'backend/src/config/env.js');
  const content = fs.readFileSync(envPath, 'utf8');
  assert.ok(
    content.includes('corsOrigins') && content.includes('isProduction'),
    'env.js deve validar corsOrigins em produção'
  );
});

test('env.js bloqueia JWT_SECRET curto em produção', () => {
  const envPath = path.join(projectRoot, 'backend/src/config/env.js');
  const content = fs.readFileSync(envPath, 'utf8');
  assert.ok(
    content.includes('secret.length') || content.includes('.length < 64'),
    'env.js deve verificar comprimento mínimo do JWT_SECRET em produção'
  );
});

test('.env.example documenta CORS_ORIGINS', () => {
  const envExPath = path.join(projectRoot, 'backend/.env.example');
  const content = fs.readFileSync(envExPath, 'utf8');
  assert.ok(content.includes('CORS_ORIGINS'), '.env.example deve incluir CORS_ORIGINS');
});

// --- Rate Limiting ---
console.log('\n2) Rate Limiting');

test('rateLimit.js existe e exporta apiLimiter e authLimiter', () => {
  const rlPath = path.join(projectRoot, 'backend/src/middlewares/rateLimit.js');
  assert.ok(fs.existsSync(rlPath));
  const content = fs.readFileSync(rlPath, 'utf8');
  assert.ok(content.includes('apiLimiter'), 'Deve exportar apiLimiter');
  assert.ok(content.includes('authLimiter'), 'Deve exportar authLimiter');
});

test('authLimiter tem limite mais restrito que apiLimiter', () => {
  const rlPath = path.join(projectRoot, 'backend/src/middlewares/rateLimit.js');
  const content = fs.readFileSync(rlPath, 'utf8');
  // Extrai valores de max usando regex simples
  const apiMatch = content.match(/apiLimiter[\s\S]*?max:\s*(\d+)/);
  const authMatch = content.match(/authLimiter[\s\S]*?max:\s*(\d+)/);
  assert.ok(apiMatch, 'apiLimiter deve ter max definido');
  assert.ok(authMatch, 'authLimiter deve ter max definido');
  const apiMax = parseInt(apiMatch[1]);
  const authMax = parseInt(authMatch[1]);
  assert.ok(authMax < apiMax, `authLimiter max (${authMax}) deve ser menor que apiLimiter max (${apiMax})`);
});

test('authLimiter ignora requisições bem-sucedidas', () => {
  const rlPath = path.join(projectRoot, 'backend/src/middlewares/rateLimit.js');
  const content = fs.readFileSync(rlPath, 'utf8');
  assert.ok(
    content.includes('skipSuccessfulRequests: true'),
    'authLimiter deve ter skipSuccessfulRequests: true'
  );
});

test('authLimiter é aplicado nas rotas de autenticação', () => {
  const authRoutesPath = path.join(projectRoot, 'backend/src/routes/authRoutes.js');
  const content = fs.readFileSync(authRoutesPath, 'utf8');
  assert.ok(content.includes('authLimiter'), 'authRoutes deve usar authLimiter');
  // Login e register devem ter rate limiting
  const loginLine = content.split('\n').find(l => l.includes('/login'));
  assert.ok(loginLine && loginLine.includes('authLimiter'), '/login deve ter authLimiter');
  const registerLine = content.split('\n').find(l => l.includes('/register'));
  assert.ok(registerLine && registerLine.includes('authLimiter'), '/register deve ter authLimiter');
});

test('rate limiting retorna código 429', () => {
  const rlPath = path.join(projectRoot, 'backend/src/middlewares/rateLimit.js');
  const content = fs.readFileSync(rlPath, 'utf8');
  assert.ok(content.includes('RATE_LIMITED'), 'Resposta deve incluir código RATE_LIMITED');
});

test('lockout de login (authService) não é permanente', () => {
  const authPath = path.join(projectRoot, 'backend/src/services/authService.js');
  const content = fs.readFileSync(authPath, 'utf8');
  assert.ok(content.includes('LOCKOUT_DURATION_MS'), 'Deve ter duração de lockout definida');
  assert.ok(content.includes('15 * 60 * 1000') || content.includes('900000'), 'Lockout deve ser temporário (15 min)');
  // Não deve ter bloqueio permanente
  assert.ok(!content.includes('permanentBlock'), 'Não deve ter bloqueio permanente');
});

test('mensagem de login não revela existência de conta', () => {
  const authPath = path.join(projectRoot, 'backend/src/services/authService.js');
  const content = fs.readFileSync(authPath, 'utf8');
  // Verifica que mensagem de e-mail inexistente é a mesma que senha errada
  const messages = content.match(/E-mail ou senha incorretos/g);
  assert.ok(messages && messages.length >= 2, 'Mensagem deve ser idêntica para e-mail inexistente e senha errada');
});

// --- Segurança adicional ---
console.log('\n3) Segurança geral');

test('.env está no .gitignore', () => {
  const giPath = path.join(projectRoot, 'backend/.gitignore');
  const content = fs.readFileSync(giPath, 'utf8');
  assert.ok(content.includes('.env'), '.gitignore deve excluir .env');
  assert.ok(content.includes('!.env.example'), '.gitignore deve preservar .env.example');
});

test('errorHandler não vaza stack trace em produção', () => {
  const ehPath = path.join(projectRoot, 'backend/src/middlewares/errorHandler.js');
  const content = fs.readFileSync(ehPath, 'utf8');
  assert.ok(content.includes('isProduction'), 'Deve verificar isProduction');
  assert.ok(content.includes('Erro interno no servidor'), 'Deve ter mensagem genérica para produção');
});

test('helmet está habilitado no app.js', () => {
  const appPath = path.join(projectRoot, 'backend/src/app.js');
  const content = fs.readFileSync(appPath, 'utf8');
  assert.ok(content.includes('helmet()'), 'app.js deve usar helmet()');
});

test('body parser tem limite de tamanho', () => {
  const appPath = path.join(projectRoot, 'backend/src/app.js');
  const content = fs.readFileSync(appPath, 'utf8');
  assert.ok(content.includes("limit: '256kb'") || content.includes("limit: '1mb'"), 'Body parser deve ter limite');
});

test('x-powered-by desabilitado', () => {
  const appPath = path.join(projectRoot, 'backend/src/app.js');
  const content = fs.readFileSync(appPath, 'utf8');
  assert.ok(content.includes("disable('x-powered-by')"), 'x-powered-by deve estar desabilitado');
});

console.log(`\n=== RESULTADO: ${passed} aprovados, ${failed} reprovados ===\n`);
if (failed > 0) process.exit(1);
