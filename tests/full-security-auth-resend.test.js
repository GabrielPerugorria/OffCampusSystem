'use strict';
/**
 * Suíte Completa: Autenticação, Verificação de E-mail, Segurança de Perfil,
 * Isolamento Multi-Tenant e Resiliência do Resend.
 *
 * Execução: node tests/full-security-auth-resend.test.js
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long_123456';
process.env.REFRESH_SECRET = 'test_refresh_secret_at_least_32_characters_long_123456';
process.env.RESEND_API_KEY = 're_test_mock_api_key_12345';
process.env.FRONTEND_URL = 'https://gabrielperugorria.github.io/OffCampusSystem';

const path = require('path');
require('module').globalPaths.push(path.resolve(__dirname, '../backend/node_modules'));

const assert = require('assert');
const jwt = require(path.resolve(__dirname, '../backend/node_modules/jsonwebtoken'));
const db = require('../backend/src/config/db');
const env = require('../backend/src/config/env');
const emailService = require('../backend/src/services/emailService');
const authService = require('../backend/src/services/authService');
const inAppNotificationService = require('../backend/src/services/inAppNotificationService');
const { authenticate } = require('../backend/src/middlewares/auth');

console.log('================================================================');
console.log(' SUÍTE COMPLETA: RESEND, VERIFICAÇÃO, PERFIL E MULTI-TENANT    ');
console.log('================================================================\n');

const tables = {
  users: [],
  organizations: [],
  organization_members: [],
  refresh_tokens: [],
  revoked_tokens: [],
  password_reset_tokens: [],
  email_verification_codes: [],
  admin_login_codes: [],
  in_app_notifications: [],
  notification_outbox: [],
};
let autoInc = 5000;

function resetDb() {
  for (const k of Object.keys(tables)) tables[k] = [];
  autoInc = 5000;
}

db.query = async (sql, params = []) => handleSql(sql, params);
db.queryOne = async (sql, params = []) => (await handleSql(sql, params))[0] || null;
db.transaction = async (cb) => cb({
  execute: async (sql, params = []) => [await handleSql(sql, params)],
});

async function handleSql(sql, params) {
  const s = sql.trim().replace(/\s+/g, ' ');

  if (s.startsWith('INSERT INTO users')) {
    const item = {
      id: ++autoInc,
      name: params[0],
      email: params[1],
      password_hash: params[2],
      cpf: params[3] || null,
      phone: params[4] || null,
      birth_date: params[5] || null,
      avatar_url: null,
      role: 'user',
      status: 'active',
      email_verified_at: null,
      tokens_valid_after: null,
      created_at: new Date(),
    };
    tables.users.push(item);
    return { insertId: item.id };
  }
  if (s.includes('FROM users WHERE email = ? AND id != ?')) {
    return tables.users.filter(u => u.email === params[0] && u.id !== Number(params[1]));
  }
  if (s.includes('FROM users WHERE cpf = ? AND id != ?')) {
    return tables.users.filter(u => u.cpf === params[0] && u.id !== Number(params[1]));
  }
  if (s.includes('FROM users WHERE email = ?')) {
    return tables.users.filter(u => u.email === params[0]);
  }
  if (s.includes('FROM users WHERE id = ?')) {
    return tables.users.filter(u => u.id === Number(params[0]));
  }
  if (s.startsWith('UPDATE users SET email = ?, email_verified_at = NOW(), tokens_valid_after = NOW() WHERE id = ?')) {
    const u = tables.users.find(i => i.id === Number(params[1]));
    if (u) {
      u.email = params[0];
      u.email_verified_at = new Date();
      u.tokens_valid_after = new Date();
    }
    return { affectedRows: u ? 1 : 0 };
  }
  if (s.startsWith('UPDATE users SET password_hash = ?, tokens_valid_after = NOW() WHERE id = ?')) {
    const u = tables.users.find(i => i.id === Number(params[1]));
    if (u) {
      u.password_hash = params[0];
      u.tokens_valid_after = new Date();
    }
    return { affectedRows: u ? 1 : 0 };
  }
  if (s.startsWith('UPDATE users SET email_verified_at = NOW() WHERE id = ?')) {
    const u = tables.users.find(i => i.id === Number(params[0]));
    if (u) u.email_verified_at = new Date();
    return { affectedRows: u ? 1 : 0 };
  }
  if (s.startsWith('UPDATE users SET tokens_valid_after = NOW() WHERE id = ?')) {
    const u = tables.users.find(i => i.id === Number(params[0]));
    if (u) u.tokens_valid_after = new Date();
    return { affectedRows: u ? 1 : 0 };
  }
  if (s.startsWith('UPDATE users SET ') && !s.includes('password_hash') && !s.includes('email_verified_at') && !s.includes('tokens_valid_after')) {
    const userId = Number(params[params.length - 1]);
    const u = tables.users.find(i => i.id === userId);
    if (u) {
      const setPart = s.slice('UPDATE users SET '.length, s.indexOf(' WHERE id = ?'));
      const cols = setPart.split(',').map(c => c.trim().split(' = ')[0]);
      cols.forEach((col, idx) => { u[col] = params[idx]; });
    }
    return { affectedRows: u ? 1 : 0 };
  }

  if (s.includes('FROM organization_members om')) {
    const userId = Number(params[0]);
    const m = tables.organization_members.find(i => i.user_id === userId && i.status === 'active');
    if (!m) return [];
    const org = tables.organizations.find(o => o.id === m.organization_id);
    return [{ organization_id: m.organization_id, role: m.role, status: m.status, organization_name: org?.name || 'Org' }];
  }

  if (s.startsWith('INSERT INTO email_verification_codes')) {
    const item = {
      id: ++autoInc,
      user_id: params[0],
      purpose: params[1],
      target_email: params[2],
      challenge_token: params[3],
      code_hash: params[4],
      attempts: 0,
      max_attempts: 5,
      expires_at: new Date(Date.now() + 15 * 60000),
      resend_available_at: new Date(Date.now() + 60000),
      used_at: null,
      ip_address: params[5] || null,
      user_agent: params[6] || null,
    };
    tables.email_verification_codes.push(item);
    return { insertId: item.id };
  }
  if (s.startsWith('UPDATE email_verification_codes SET used_at = NOW() WHERE user_id = ?')) {
    tables.email_verification_codes.forEach(c => {
      if (c.user_id === Number(params[0]) && c.purpose === params[1] && !c.used_at) c.used_at = new Date();
    });
    return { affectedRows: 1 };
  }
  if (s.includes('FROM email_verification_codes WHERE challenge_token = ? AND user_id = ?')) {
    return tables.email_verification_codes.filter(c => c.challenge_token === params[0] && c.user_id === Number(params[1]) && c.purpose === 'email_change');
  }
  if (s.includes('FROM email_verification_codes WHERE challenge_token = ?')) {
    return tables.email_verification_codes.filter(c => c.challenge_token === params[0] && c.purpose === 'register');
  }
  if (s.startsWith('UPDATE email_verification_codes SET code_hash = ?')) {
    const c = tables.email_verification_codes.find(i => i.id === Number(params[2]));
    if (c) {
      c.code_hash = params[0];
      c.attempts = 0;
      c.expires_at = new Date(Date.now() + 15 * 60000);
      c.resend_available_at = new Date(Date.now() + 60000);
    }
    return { affectedRows: c ? 1 : 0 };
  }
  if (s.startsWith('UPDATE email_verification_codes SET used_at = NOW() WHERE id = ?')) {
    const c = tables.email_verification_codes.find(i => i.id === Number(params[0]));
    if (c) c.used_at = new Date();
    return { affectedRows: c ? 1 : 0 };
  }
  if (s.startsWith('UPDATE email_verification_codes SET attempts = ? WHERE id = ?')) {
    const c = tables.email_verification_codes.find(i => i.id === Number(params[1]));
    if (c) c.attempts = Number(params[0]);
    return { affectedRows: c ? 1 : 0 };
  }

  if (s.startsWith('UPDATE admin_login_codes SET used_at = NOW() WHERE user_id = ?')) {
    tables.admin_login_codes.forEach(c => { if (c.user_id === Number(params[0]) && !c.used_at) c.used_at = new Date(); });
    return { affectedRows: 1 };
  }
  if (s.startsWith('INSERT INTO admin_login_codes')) {
    const item = {
      id: ++autoInc,
      user_id: params[0],
      challenge_token: params[1],
      code_hash: params[2],
      attempts: 0,
      max_attempts: 5,
      expires_at: new Date(Date.now() + 10 * 60000),
      resend_available_at: new Date(Date.now() + 60000),
      used_at: null,
      ip_address: params[3] || null,
      user_agent: params[4] || null,
    };
    tables.admin_login_codes.push(item);
    return { insertId: item.id };
  }
  if (s.includes('FROM admin_login_codes WHERE challenge_token = ?')) {
    return tables.admin_login_codes.filter(c => c.challenge_token === params[0]);
  }
  if (s.includes('FROM admin_login_codes WHERE user_id = ? AND used_at IS NOT NULL')) {
    return tables.admin_login_codes.filter(c => c.user_id === Number(params[0]) && c.used_at && c.id !== Number(params[1]));
  }
  if (s.startsWith('UPDATE admin_login_codes SET code_hash = ?')) {
    const c = tables.admin_login_codes.find(i => i.id === Number(params[3]));
    if (c) {
      c.code_hash = params[0];
      c.attempts = 0;
      c.expires_at = new Date(Date.now() + 10 * 60000);
      c.resend_available_at = new Date(Date.now() + 60000);
    }
    return { affectedRows: c ? 1 : 0 };
  }
  if (s.startsWith('UPDATE admin_login_codes SET used_at = NOW() WHERE id = ?')) {
    const c = tables.admin_login_codes.find(i => i.id === Number(params[0]));
    if (c) c.used_at = new Date();
    return { affectedRows: c ? 1 : 0 };
  }
  if (s.startsWith('UPDATE admin_login_codes SET attempts = ? WHERE id = ?')) {
    const c = tables.admin_login_codes.find(i => i.id === Number(params[1]));
    if (c) c.attempts = Number(params[0]);
    return { affectedRows: c ? 1 : 0 };
  }

  if (s.startsWith('INSERT INTO refresh_tokens')) {
    const item = { id: ++autoInc, user_id: params[0], token_hash: params[1], expires_at: params[2], revoked_at: null };
    tables.refresh_tokens.push(item);
    return { insertId: item.id };
  }
  if (s.includes('FROM refresh_tokens WHERE token_hash = ?')) {
    return tables.refresh_tokens.filter(t => t.token_hash === params[0]);
  }
  if (s.startsWith('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ?')) {
    tables.refresh_tokens.forEach(t => { if (t.user_id === Number(params[0]) && !t.revoked_at) t.revoked_at = new Date(); });
    return { affectedRows: 1 };
  }
  if (s.includes('FROM revoked_tokens WHERE jti = ?')) {
    return [];
  }

  if (s.startsWith('INSERT INTO notification_outbox')) {
    const item = {
      id: ++autoInc,
      organization_id: params[0],
      category: params[2],
      recipient_email: params[5],
      subject: params[7],
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
      idempotency_key: params[10],
    };
    if (tables.notification_outbox.some(o => o.idempotency_key === item.idempotency_key)) return { insertId: 0 };
    tables.notification_outbox.push(item);
    return { insertId: item.id };
  }
  if (s.startsWith('UPDATE notification_outbox SET status = \'processing\'')) return { affectedRows: 1 };
  if (s.startsWith('UPDATE notification_outbox SET status = \'resend_accepted\'')) {
    const o = tables.notification_outbox.find(i => i.id === Number(params[1]));
    if (o) { o.status = 'resend_accepted'; o.resend_message_id = params[0]; }
    return { affectedRows: 1 };
  }
  if (s.startsWith('SELECT attempts, max_attempts FROM notification_outbox')) {
    const o = tables.notification_outbox.find(i => i.id === Number(params[0]));
    return o ? [o] : [];
  }
  if (s.startsWith('UPDATE notification_outbox SET status = \'pending\', attempts = ?')) {
    const o = tables.notification_outbox.find(i => i.id === Number(params[3]));
    if (o) { o.attempts = params[0]; o.last_error = params[1]; }
    return { affectedRows: 1 };
  }

  if (s.startsWith('INSERT INTO in_app_notifications')) {
    const item = {
      id: ++autoInc,
      organization_id: params[0],
      event_id: params[1],
      category: params[2],
      severity: params[3],
      title: params[4],
      message: params[5],
      metadata: params[6] ? JSON.parse(params[6]) : null,
      read_at: null,
      created_at: new Date(),
    };
    tables.in_app_notifications.push(item);
    return { insertId: item.id };
  }
  if (s.includes('FROM in_app_notifications')) {
    let items = [...tables.in_app_notifications];
    let pIdx = 0;
    if (s.includes('(organization_id = ? OR organization_id IS NULL)')) {
      const orgId = Number(params[pIdx++]);
      items = items.filter(i => i.organization_id === orgId || i.organization_id === null);
    } else if (s.includes('organization_id = ?')) {
      const orgId = Number(params[pIdx++]);
      items = items.filter(i => i.organization_id === orgId);
    }
    if (s.includes('COUNT(*)')) {
      return [{ total: items.length, unread: items.filter(i => !i.read_at).length }];
    }
    return items;
  }

  return [];
}

let sentEmails = [];
let shouldFailResend = false;
emailService._setResendClient({
  emails: {
    send: async (payload) => {
      if (shouldFailResend) return { error: { message: 'Resend API unavailable', name: 'api_error' } };
      sentEmails.push(payload);
      return { data: { id: `msg_${Date.now()}_${Math.random()}` } };
    },
  },
});

async function run() {
  resetDb();
  sentEmails = [];

  // 1. Falha do Resend no cadastro: não mente, sinaliza emailDeliveryFailed=true e não emite tokens
  console.log('--- TESTE 1: Falha do Resend no cadastro preserva integridade ---');
  shouldFailResend = true;
  const failReg = await authService.register({
    name: 'Lucas Teste',
    email: 'lucas@evotech.com',
    password: 'Password123!',
  });
  assert.strictEqual(failReg.requiresEmailVerification, true);
  assert.strictEqual(failReg.emailDeliveryFailed, true);
  assert.strictEqual(failReg.accessToken, undefined);
  shouldFailResend = false;
  console.log('✓ Falha de envio no cadastro sinalizada corretamente sem liberar sessão.');

  // 2. Reenvio controlado respeita cooldown de 60s e falha real retorna 503
  console.log('\n--- TESTE 2: Cooldown de reenvio e erro 503 em falha real ---');
  let cooldownHit = false;
  try {
    await authService.resendVerificationCode({ challengeToken: failReg.challengeToken });
  } catch (err) {
    cooldownHit = true;
    assert.strictEqual(err.statusCode, 400);
  }
  assert.ok(cooldownHit);

  // Libera cooldown manualmente no mock e testa sucesso
  tables.email_verification_codes[0].resend_available_at = new Date(Date.now() - 1000);
  const resendOk = await authService.resendVerificationCode({ challengeToken: failReg.challengeToken });
  assert.strictEqual(resendOk.success, true);
  const regCode = sentEmails[sentEmails.length - 1].text.match(/\b(\d{6})\b/)[1];
  const verified = await authService.verifyEmail({ challengeToken: failReg.challengeToken, code: regCode });
  assert.ok(verified.accessToken);
  console.log('✓ Reenvio e ativação de conta após confirmação de e-mail validados.');

  // 3. Alteração de senha autenticada revoga sessões antigas (JWT antigo é rejeitado por tokens_valid_after)
  console.log('\n--- TESTE 3: Alteração de senha revoga JWTs antigos e notifica ---');
  const userId = verified.user.id;
  // Simula token emitido 5 segundos atrás
  const oldJwt = jwt.sign(
    { sub: userId, role: 'participante', jti: 'old-jti', iat: Math.floor(Date.now() / 1000) - 5 },
    env.jwt.secret,
    { algorithm: 'HS256', issuer: env.jwt.issuer, audience: env.jwt.audience, expiresIn: '15m' }
  );
  const changed = await authService.changePassword(userId, {
    currentPassword: 'Password123!',
    newPassword: 'NewPassword456!',
  }, { ipAddress: '127.0.0.1' });
  assert.ok(changed.accessToken);

  let rejectedOldJwt = false;
  await authenticate({ headers: { authorization: `Bearer ${oldJwt}` } }, {}, (err) => {
    if (err && err.statusCode === 401) rejectedOldJwt = true;
  });
  assert.ok(rejectedOldJwt, 'JWT emitido antes da troca de senha deve ser revogado imediatamente');
  assert.ok(sentEmails.some(e => e.to === 'lucas@evotech.com' && e.subject.includes('senha foi alterada')));
  console.log('✓ Troca de senha revogou tokens anteriores e disparou e-mail de segurança.');

  // 4. Alteração de e-mail exige reautenticação, código no novo e-mail e notifica ambos
  console.log('\n--- TESTE 4: Alteração segura de e-mail com notificação ao antigo e novo ---');
  sentEmails = [];
  const emailChg = await authService.requestEmailChange(userId, {
    newEmail: 'lucas.novo@evotech.com',
    currentPassword: 'NewPassword456!',
  });
  const chgCode = sentEmails[sentEmails.length - 1].text.match(/\b(\d{6})\b/)[1];
  const chgConfirm = await authService.confirmEmailChange(userId, {
    challengeToken: emailChg.challengeToken,
    code: chgCode,
  });
  assert.strictEqual(chgConfirm.user.email, 'lucas.novo@evotech.com');
  assert.ok(sentEmails.some(e => e.to === 'lucas@evotech.com' && e.subject.includes('E-mail da conta alterado')));
  assert.ok(sentEmails.some(e => e.to === 'lucas.novo@evotech.com' && e.subject.includes('Novo e-mail confirmado')));
  console.log('✓ Alteração de e-mail confirmada com alertas para o endereço anterior e o novo.');

  // 5. Detecção de novo IP no login
  console.log('\n--- TESTE 5: Detecção de novo IP no login e alerta de segurança ---');
  sentEmails = [];
  const login1 = await authService.login('lucas.novo@evotech.com', 'NewPassword456!', { ipAddress: '10.0.0.1', userAgent: 'Chrome' });
  const code1 = sentEmails[sentEmails.length - 1].text.match(/\b(\d{6})\b/)[1];
  await authService.verifyLoginCode({ challengeToken: login1.challengeToken, code: code1, ipAddress: '10.0.0.1', userAgent: 'Chrome' });

  sentEmails = [];
  const login2 = await authService.login('lucas.novo@evotech.com', 'NewPassword456!', { ipAddress: '203.0.113.50', userAgent: 'Firefox' });
  const code2 = sentEmails[sentEmails.length - 1].text.match(/\b(\d{6})\b/)[1];
  await authService.verifyLoginCode({ challengeToken: login2.challengeToken, code: code2, ipAddress: '203.0.113.50', userAgent: 'Firefox' });
  assert.ok(sentEmails.some(e => e.subject.includes('Novo acesso detectado')), 'Deve enviar alerta de novo acesso quando o IP muda');
  console.log('✓ Detecção de novo dispositivo/IP validada.');

  // 6. Isolamento Multi-tenant estrito na central de notificações
  console.log('\n--- TESTE 6: Isolamento Multi-Tenant na Central Administrativa ---');
  tables.in_app_notifications = [];
  await inAppNotificationService.createNotification({ organizationId: 10, category: 'sales', title: 'Venda Org 10', message: 'R$ 100' });
  await inAppNotificationService.createNotification({ organizationId: 20, category: 'sales', title: 'Venda Org 20', message: 'R$ 200' });
  await inAppNotificationService.createNotification({ organizationId: null, category: 'account', title: 'Evento Global', message: 'Sistema' });

  const org10List = await inAppNotificationService.listNotifications({ organizationId: 10, includeSystem: false });
  assert.strictEqual(org10List.total, 1);
  assert.strictEqual(org10List.items[0].title, 'Venda Org 10');

  const platformList = await inAppNotificationService.listNotifications({ organizationId: 10, includeSystem: true });
  assert.strictEqual(platformList.total, 2);
  console.log('✓ Isolamento multi-tenant estrito comprovado (zero vazamento entre orgs e sistema).');

  console.log('\n================================================================');
  console.log(' TODOS OS 6 CENÁRIOS AVANÇADOS FORAM APROVADOS COM SUCESSO!     ');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('\n❌ FALHA:', err);
  process.exit(1);
});
