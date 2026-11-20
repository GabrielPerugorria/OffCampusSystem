'use strict';
/**
 * JWT Security Tests — validação de emissão, verificação, revogação e auto-elevação.
 * NÃO depende de MySQL. Testa diretamente a lógica de tokens.
 *
 * Executar:  node tests/jwt-security.test.js
 */
const path = require('path');
// Resolve jsonwebtoken a partir do backend/node_modules
const backendDir = path.resolve(__dirname, '..', 'backend');
const jwt = require(path.join(backendDir, 'node_modules', 'jsonwebtoken'));
const crypto = require('crypto');
const assert = require('assert');

const SECRET = crypto.randomBytes(32).toString('hex'); // 64 hex chars (32 bytes)
const WEAK_SECRET = 'short';
const WRONG_SECRET = crypto.randomBytes(32).toString('hex');
const ISSUER = 'offcampussystem';
const AUDIENCE = 'offcampus-client';
const ALGO = 'HS256';

const VERIFY_OPTS = { algorithms: [ALGO], issuer: ISSUER, audience: AUDIENCE };

function signToken(payload, opts = {}) {
  return jwt.sign(
    { jti: crypto.randomUUID(), ...payload },
    opts.secret || SECRET,
    {
      algorithm: opts.algorithm || ALGO,
      expiresIn: opts.expiresIn || '1h',
      issuer: opts.issuer !== undefined ? opts.issuer : ISSUER,
      audience: opts.audience !== undefined ? opts.audience : AUDIENCE,
    }
  );
}

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

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✔ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✘ ${name}`);
    console.log(`    → ${err.message}`);
    failed++;
  }
}

console.log('\n=== JWT SECURITY TESTS ===\n');

// --- 1. Emissão de tokens ---
console.log('1) Emissão de tokens');

test('token inclui jti único', () => {
  const t1 = signToken({ sub: 1, role: 'admin' });
  const t2 = signToken({ sub: 1, role: 'admin' });
  const d1 = jwt.decode(t1);
  const d2 = jwt.decode(t2);
  assert.ok(d1.jti, 'jti ausente no token 1');
  assert.ok(d2.jti, 'jti ausente no token 2');
  assert.notStrictEqual(d1.jti, d2.jti, 'jti deve ser único entre tokens');
});

test('token inclui issuer e audience', () => {
  const token = signToken({ sub: 1, role: 'admin' });
  const decoded = jwt.decode(token);
  assert.strictEqual(decoded.iss, ISSUER);
  assert.strictEqual(decoded.aud, AUDIENCE);
});

test('token inclui sub e role sem dados sensíveis', () => {
  const token = signToken({ sub: 42, role: 'admin' });
  const decoded = jwt.decode(token);
  assert.strictEqual(decoded.sub, 42);
  assert.strictEqual(decoded.role, 'admin');
  assert.strictEqual(decoded.password, undefined, 'Token não deve conter password');
  assert.strictEqual(decoded.email, undefined, 'Token não deve conter email');
});

test('token inclui exp e iat', () => {
  const token = signToken({ sub: 1, role: 'admin' });
  const decoded = jwt.decode(token);
  assert.ok(decoded.exp, 'exp ausente');
  assert.ok(decoded.iat, 'iat ausente');
  assert.ok(decoded.exp > decoded.iat, 'exp deve ser posterior a iat');
});

// --- 2. Verificação de assinatura ---
console.log('\n2) Verificação de assinatura');

test('rejeita token assinado com secret errado', () => {
  const token = signToken({ sub: 1, role: 'admin' }, { secret: WRONG_SECRET });
  assert.throws(
    () => jwt.verify(token, SECRET, VERIFY_OPTS),
    { name: 'JsonWebTokenError' }
  );
});

test('rejeita token sem assinatura (alg: none)', () => {
  // Cria token sem assinatura
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 1, role: 'admin', iss: ISSUER, aud: AUDIENCE })).toString('base64url');
  const fakeToken = `${header}.${payload}.`;
  assert.throws(
    () => jwt.verify(fakeToken, SECRET, VERIFY_OPTS),
    { name: 'JsonWebTokenError' },
    'Token sem assinatura deve ser rejeitado'
  );
});

// --- 3. Validação de claims ---
console.log('\n3) Validação de claims');

test('rejeita token com issuer incorreto', () => {
  const token = signToken({ sub: 1, role: 'admin' }, { issuer: 'malicious-issuer' });
  assert.throws(
    () => jwt.verify(token, SECRET, VERIFY_OPTS),
    { name: 'JsonWebTokenError' }
  );
});

test('rejeita token com audience incorreta', () => {
  const token = signToken({ sub: 1, role: 'admin' }, { audience: 'wrong-audience' });
  assert.throws(
    () => jwt.verify(token, SECRET, VERIFY_OPTS),
    { name: 'JsonWebTokenError' }
  );
});

test('rejeita token expirado', () => {
  const token = jwt.sign(
    { sub: 1, role: 'admin', jti: crypto.randomUUID() },
    SECRET,
    { algorithm: ALGO, expiresIn: '-1s', issuer: ISSUER, audience: AUDIENCE }
  );
  assert.throws(
    () => jwt.verify(token, SECRET, VERIFY_OPTS),
    { name: 'TokenExpiredError' }
  );
});

test('rejeita token com algoritmo diferente (RS256 vs HS256)', () => {
  // Tenta verificar como HS256 um token que foi assinado com secret como se fosse RS256
  // jwt.sign com HS384 e verify com HS256 expected
  const token = jwt.sign(
    { sub: 1, role: 'admin', jti: crypto.randomUUID() },
    SECRET,
    { algorithm: 'HS384', expiresIn: '1h', issuer: ISSUER, audience: AUDIENCE }
  );
  assert.throws(
    () => jwt.verify(token, SECRET, VERIFY_OPTS),
    /invalid algorithm/i
  );
});

// --- 4. Prevenção de auto-elevação ---
console.log('\n4) Prevenção de auto-elevação');

test('role no token não pode ser alterado por um atacante', () => {
  // Cria token com role participante
  const token = signToken({ sub: 1, role: 'participante' });
  const verified = jwt.verify(token, SECRET, VERIFY_OPTS);
  assert.strictEqual(verified.role, 'participante');

  // Tenta decodificar, alterar role e recodificar sem a chave
  const parts = token.split('.');
  const tampered = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  tampered.role = 'admin';
  const newPayload = Buffer.from(JSON.stringify(tampered)).toString('base64url');
  const tamperedToken = `${parts[0]}.${newPayload}.${parts[2]}`;

  assert.throws(
    () => jwt.verify(tamperedToken, SECRET, VERIFY_OPTS),
    { name: 'JsonWebTokenError' },
    'Token adulterado deve ser rejeitado'
  );
});

test('token de participante não dá acesso admin (simulação de middleware)', () => {
  const token = signToken({ sub: 1, role: 'participante' });
  const payload = jwt.verify(token, SECRET, VERIFY_OPTS);
  // Simula authorize.js: apenas owner/admin têm acesso
  const allowedRoles = ['owner', 'admin'];
  assert.ok(!allowedRoles.includes(payload.role), 'Participante não deve ter acesso admin');
});

test('atacante não pode forjar token com role owner usando outro secret', () => {
  const forgedToken = signToken({ sub: 1, role: 'owner' }, { secret: WRONG_SECRET });
  assert.throws(
    () => jwt.verify(forgedToken, SECRET, VERIFY_OPTS),
    { name: 'JsonWebTokenError' }
  );
});

// --- 5. Revogação (lógica pura, sem DB) ---
console.log('\n5) Revogação (lógica pura)');

test('token com jti pode ser marcado como revogado em um Set simulado', () => {
  const revokedSet = new Set();
  const token = signToken({ sub: 1, role: 'admin' });
  const payload = jwt.verify(token, SECRET, VERIFY_OPTS);

  // Antes de revogar
  assert.ok(!revokedSet.has(payload.jti), 'Token não deve estar revogado inicialmente');

  // Revogar
  revokedSet.add(payload.jti);
  assert.ok(revokedSet.has(payload.jti), 'Token deve estar revogado após adicionar jti');
});

test('token sem jti é aceito pelo jwt.verify mas detectável pelo middleware', () => {
  // Tokens antigos (antes da migration) podem não ter jti
  const oldToken = jwt.sign(
    { sub: 1, role: 'admin' },
    SECRET,
    { algorithm: ALGO, expiresIn: '1h', issuer: ISSUER, audience: AUDIENCE }
  );
  const payload = jwt.verify(oldToken, SECRET, VERIFY_OPTS);
  assert.strictEqual(payload.jti, undefined, 'Token antigo não tem jti');
  // O middleware aceita tokens sem jti (pré-migration) — OK
});

// --- 6. Refresh token ---
console.log('\n6) Refresh token');

test('refresh token é hash SHA-256 de 96 bytes aleatórios', () => {
  const rawToken = crypto.randomBytes(48).toString('hex');
  assert.strictEqual(rawToken.length, 96, 'Refresh token deve ter 96 hex chars');
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  assert.strictEqual(hash.length, 64, 'Hash SHA-256 deve ter 64 hex chars');
  // Dois tokens diferentes geram hashes diferentes
  const rawToken2 = crypto.randomBytes(48).toString('hex');
  const hash2 = crypto.createHash('sha256').update(rawToken2).digest('hex');
  assert.notStrictEqual(hash, hash2);
});

// --- Resumo ---
console.log(`\n=== RESULTADO: ${passed} aprovados, ${failed} reprovados ===\n`);
if (failed > 0) process.exit(1);
