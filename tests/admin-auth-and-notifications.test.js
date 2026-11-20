'use strict';
/**
 * Suíte de Testes de Autenticação, 2FA Administrativo e Notificações Internas
 * Cobertura de Testes Obrigatórios (Seção 14 dos Requisitos)
 *
 * Execução: node tests/admin-auth-and-notifications.test.js
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long_123456';
process.env.REFRESH_SECRET = 'test_refresh_secret_at_least_32_characters_long_123456';
process.env.RESEND_API_KEY = 're_test_mock_api_key_12345';
process.env.FRONTEND_URL = 'https://gabrielperugorria.github.io/OffCampusSystem';

const path = require('path');
require('module').globalPaths.push(path.resolve(__dirname, '../backend/node_modules'));

const assert = require('assert');
const crypto = require('crypto');
const bcrypt = require(path.resolve(__dirname, '../backend/node_modules/bcryptjs'));
const db = require('../backend/src/config/db');
const emailService = require('../backend/src/services/emailService');
const authService = require('../backend/src/services/authService');
const inAppNotificationService = require('../backend/src/services/inAppNotificationService');
const notificationOutboxService = require('../backend/src/services/notificationOutboxService');

console.log('================================================================');
console.log(' SUÍTE: AUTENTICAÇÃO, 2FA ADMINISTRATIVO E NOTIFICAÇÕES INTERNAS');
console.log(' COBERTURA: RECUPERAÇÃO, CADASTRO, LOGIN, 2FA E IN-APP NOTIFS   ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// BANCO EM MEMÓRIA DETERMINÍSTICO
// -----------------------------------------------------------------------------

const tables = {
  users: [],
  organizations: [],
  organization_members: [],
  refresh_tokens: [],
  password_reset_tokens: [],
  admin_login_codes: [],
  in_app_notifications: [],
  notification_outbox: [],
};

let autoInc = 2000;

function resetDatabase() {
  for (const k of Object.keys(tables)) {
    tables[k] = [];
  }
  autoInc = 2000;
}

db.query = async function (sql, params = []) {
  return handleSql(sql, params);
};

db.queryOne = async function (sql, params = []) {
  const rows = await handleSql(sql, params);
  return rows[0] || null;
};

db.transaction = async function (callback) {
  const conn = {
    execute: async (sql, params = []) => {
      const res = await handleSql(sql, params);
      return [res];
    },
  };
  return await callback(conn);
};

async function handleSql(sql, params) {
  const s = sql.trim().replace(/\s+/g, ' ');

  // INSERT INTO users
  if (s.startsWith('INSERT INTO users')) {
    const item = {
      id: ++autoInc,
      name: params[0],
      email: params[1],
      password_hash: params[2],
      cpf: params[3] || null,
      phone: params[4] || null,
      birth_date: params[5] || null,
      role: 'participante',
      status: 'active',
      created_at: new Date(),
    };
    tables.users.push(item);
    return { insertId: item.id };
  }

  // SELECT users
  if (s.startsWith('SELECT id FROM users WHERE email = ?')) {
    return tables.users.filter(u => u.email === params[0]);
  }
  if (s.startsWith('SELECT id FROM users WHERE cpf = ?')) {
    return tables.users.filter(u => u.cpf === params[0]);
  }
  if (s.includes('FROM users WHERE email = ?')) {
    return tables.users.filter(u => u.email === params[0]);
  }
  if (s.includes('FROM users WHERE id = ?')) {
    return tables.users.filter(u => u.id === Number(params[0]));
  }

  // UPDATE users
  if (s.startsWith('UPDATE users SET password_hash = ? WHERE id = ?')) {
    const u = tables.users.find(item => item.id === Number(params[1]));
    if (u) u.password_hash = params[0];
    return { affectedRows: u ? 1 : 0 };
  }

  // SELECT organization_members
  if (s.includes('FROM organization_members om')) {
    const userId = Number(params[0]);
    const m = tables.organization_members.find(item => item.user_id === userId && item.status === 'active');
    if (!m) return [];
    const org = tables.organizations.find(o => o.id === m.organization_id);
    return [{
      organization_id: m.organization_id,
      role: m.role,
      status: m.status,
      organization_name: org ? org.name : 'Org',
    }];
  }

  // INSERT / UPDATE refresh_tokens
  if (s.startsWith('INSERT INTO refresh_tokens')) {
    const item = {
      id: ++autoInc,
      user_id: params[0],
      token_hash: params[1],
      expires_at: params[2],
      revoked_at: null,
    };
    tables.refresh_tokens.push(item);
    return { insertId: item.id };
  }
  if (s.includes('FROM refresh_tokens WHERE token_hash = ?')) {
    return tables.refresh_tokens.filter(t => t.token_hash === params[0]);
  }
  if (s.startsWith('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?')) {
    const t = tables.refresh_tokens.find(item => item.id === Number(params[0]));
    if (t) t.revoked_at = new Date();
    return { affectedRows: t ? 1 : 0 };
  }
  if (s.startsWith('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ?')) {
    let affected = 0;
    tables.refresh_tokens.forEach(t => {
      if (t.user_id === Number(params[0]) && !t.revoked_at) {
        t.revoked_at = new Date();
        affected++;
      }
    });
    return { affectedRows: affected };
  }

  // password_reset_tokens
  if (s.startsWith('INSERT INTO password_reset_tokens')) {
    const item = {
      id: ++autoInc,
      user_id: params[0],
      token_hash: params[1],
      expires_at: params[2],
      used_at: null,
      created_at: new Date(),
    };
    tables.password_reset_tokens.push(item);
    return { insertId: item.id };
  }
  if (s.startsWith('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ?')) {
    let count = 0;
    tables.password_reset_tokens.forEach(t => {
      if (t.user_id === Number(params[0]) && !t.used_at) {
        t.used_at = new Date();
        count++;
      }
    });
    return { affectedRows: count };
  }
  if (s.includes('FROM password_reset_tokens') && s.includes('token_hash = ?')) {
    const hash = params[0];
    const row = tables.password_reset_tokens.find(t => t.token_hash === hash);
    if (!row) return [];
    const u = tables.users.find(u => u.id === row.user_id);
    return [{ ...row, name: u?.name, email: u?.email }];
  }
  if (s.startsWith('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?')) {
    const t = tables.password_reset_tokens.find(item => item.id === Number(params[0]));
    if (t) t.used_at = new Date();
    return { affectedRows: t ? 1 : 0 };
  }

  // admin_login_codes
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
      ip_address: params[3] || null,
      user_agent: params[4] || null,
      used_at: null,
      created_at: new Date(),
    };
    tables.admin_login_codes.push(item);
    return { insertId: item.id };
  }
  if (s.startsWith('UPDATE admin_login_codes SET used_at = NOW() WHERE user_id = ?')) {
    let affected = 0;
    tables.admin_login_codes.forEach(c => {
      if (c.user_id === Number(params[0]) && !c.used_at) {
        c.used_at = new Date();
        affected++;
      }
    });
    return { affectedRows: affected };
  }
  if (s.includes('FROM admin_login_codes WHERE challenge_token = ?')) {
    return tables.admin_login_codes.filter(c => c.challenge_token === params[0]);
  }
  if (s.startsWith('UPDATE admin_login_codes SET used_at = NOW() WHERE id = ?')) {
    const c = tables.admin_login_codes.find(item => item.id === Number(params[0]));
    if (c) c.used_at = new Date();
    return { affectedRows: c ? 1 : 0 };
  }
  if (s.startsWith('UPDATE admin_login_codes SET attempts = ? WHERE id = ?')) {
    const c = tables.admin_login_codes.find(item => item.id === Number(params[1]));
    if (c) c.attempts = Number(params[0]);
    return { affectedRows: c ? 1 : 0 };
  }

  // in_app_notifications
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
  if (s.includes('FROM in_app_notifications') && s.includes('COUNT(*)')) {
    const unread = tables.in_app_notifications.filter(i => !i.read_at).length;
    return [{ total: tables.in_app_notifications.length, unread }];
  }
  if (s.includes('FROM in_app_notifications') && s.includes('WHERE read_at IS NULL')) {
    const unread = tables.in_app_notifications.filter(i => !i.read_at).length;
    return [{ unread }];
  }
  if (s.includes('FROM in_app_notifications')) {
    let items = [...tables.in_app_notifications];
    if (s.includes('read_at IS NULL')) {
      items = items.filter(i => !i.read_at);
    }
    return items;
  }
  if (s.startsWith('UPDATE in_app_notifications SET read_at = NOW() WHERE id = ?')) {
    const i = tables.in_app_notifications.find(item => item.id === Number(params[0]));
    if (i && !i.read_at) {
      i.read_at = new Date();
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }
  if (s.startsWith('UPDATE in_app_notifications SET read_at = NOW() WHERE read_at IS NULL')) {
    let count = 0;
    tables.in_app_notifications.forEach(i => {
      if (!i.read_at) {
        i.read_at = new Date();
        count++;
      }
    });
    return { affectedRows: count };
  }

  // notification_outbox
  if (s.startsWith('INSERT INTO notification_outbox')) {
    const item = {
      id: ++autoInc,
      organization_id: params[0],
      event_id: params[1],
      category: params[2],
      priority: params[3],
      recipient_user_id: params[4],
      recipient_email: params[5],
      recipient_name: params[6],
      subject: params[7],
      html_body: params[8],
      text_body: params[9],
      status: 'pending',
      idempotency_key: params[10],
      scheduled_for: params[11] || new Date(),
      payload: params[12],
      attempts: 0,
      resend_message_id: null,
      created_at: new Date(),
    };
    tables.notification_outbox.push(item);
    return { insertId: item.id };
  }
  if (s.startsWith('UPDATE notification_outbox') && s.includes("status = 'processing'")) {
    const o = tables.notification_outbox.find(item => item.id === Number(params[0]));
    if (o) o.status = 'processing';
    return { affectedRows: 1 };
  }
  if (s.startsWith('UPDATE notification_outbox') && s.includes("status = 'resend_accepted'")) {
    const o = tables.notification_outbox.find(item => item.id === Number(params[1]));
    if (o) {
      o.status = 'resend_accepted';
      o.resend_message_id = params[0];
      o.resend_accepted_at = new Date();
    }
    return { affectedRows: 1 };
  }
  if (s.startsWith('UPDATE notification_outbox') && (s.includes("status = 'resend_failed'") || s.includes("next_retry_at = DATE_ADD"))) {
    const id = params[params.length - 1];
    const o = tables.notification_outbox.find(item => item.id === Number(id));
    if (o) {
      o.attempts = params[0];
      o.last_error = params[1];
      if (s.includes("status = 'resend_failed'")) {
        o.status = 'resend_failed';
      } else {
        o.status = 'pending';
        o.next_retry_at = new Date(Date.now() + (params[2] || 2) * 60000);
      }
      o.processing_started_at = null;
    }
    return { affectedRows: 1 };
  }
  if (s.includes('SELECT attempts, max_attempts FROM notification_outbox')) {
    return tables.notification_outbox.filter(item => item.id === Number(params[0]));
  }

  return [];
}

// Configura Mock do Resend para capturar e-mails disparados
let lastSentEmail = null;
let resendShouldFail = false;

emailService._setResendClient({
  emails: {
    send: async (payload) => {
      if (resendShouldFail) {
        return {
          data: null,
          error: {
            name: 'validation_error',
            message: 'You can only send testing emails to your own email address. Verify a domain at resend.com/domains.',
          },
        };
      }
      lastSentEmail = { ...payload, sentAt: new Date() };
      return {
        data: { id: `msg_resend_mock_${Date.now()}` },
        error: null,
      };
    },
  },
});

async function runTests() {
  resetDatabase();

  // Cria organização inicial
  tables.organizations.push({ id: 1, name: 'EvoTech Produções', slug: 'evotech' });

  // ---------------------------------------------------------------------------
  // 1. CADASTRO DE PARTICIPANTE
  // ---------------------------------------------------------------------------
  console.log('--- TESTE 1: Cadastro válido de novo participante ---');
  const userReg = await authService.register({
    name: 'Mariana Silva',
    email: 'mariana.silva@exemplo.com',
    password: 'SenhaForte123!',
    cpf: '12345678901',
    phone: '51999998888',
  });
  assert.ok(userReg.accessToken, 'Deve emitir accessToken no cadastro');
  assert.ok(userReg.refreshToken, 'Deve emitir refreshToken no cadastro');
  assert.strictEqual(userReg.user.nome, 'Mariana Silva');
  assert.strictEqual(userReg.user.role, 'participante');

  // Verifica persistência na outbox do e-mail de boas-vindas
  const welcomeOutbox = tables.notification_outbox.find(o => o.recipient_email === 'mariana.silva@exemplo.com');
  assert.ok(welcomeOutbox, 'E-mail de boas-vindas deve ser registrado na outbox');
  assert.strictEqual(welcomeOutbox.status, 'resend_accepted');
  console.log('✓ Cadastro concluído com emissão de tokens e boas-vindas na outbox.');

  console.log('\n--- TESTE 2: Prevenção de e-mails duplicados no cadastro ---');
  let duplicateThrew = false;
  try {
    await authService.register({
      name: 'Mariana Fake',
      email: 'mariana.silva@exemplo.com',
      password: 'OutraSenha123!',
    });
  } catch (err) {
    duplicateThrew = true;
    assert.strictEqual(err.statusCode, 409, 'Deve retornar conflito 409 para e-mail duplicado');
  }
  assert.ok(duplicateThrew, 'Deve impedir cadastro com mesmo e-mail');
  console.log('✓ Bloqueio de e-mail duplicado validado com sucesso.');

  // ---------------------------------------------------------------------------
  // 2. LOGIN DE PARTICIPANTE COMUM (SEM 2FA)
  // ---------------------------------------------------------------------------
  console.log('\n--- TESTE 3: Login de participante comum (sem desafio 2FA) ---');
  const partLogin = await authService.login('mariana.silva@exemplo.com', 'SenhaForte123!');
  assert.strictEqual(partLogin.requires2FA, undefined, 'Participante comum NÃO deve exigir 2FA');
  assert.ok(partLogin.accessToken, 'Participante comum recebe tokens imediatamente');
  assert.strictEqual(partLogin.user.role, 'participante');
  console.log('✓ Participante comum autenticado diretamente sem desafio 2FA.');

  console.log('\n--- TESTE 4: Tentativa com senha incorreta ---');
  let wrongPassThrew = false;
  try {
    await authService.login('mariana.silva@exemplo.com', 'SenhaErrada999!');
  } catch (err) {
    wrongPassThrew = true;
    assert.strictEqual(err.statusCode, 401, 'Deve retornar 401 para senha incorreta');
  }
  assert.ok(wrongPassThrew);
  console.log('✓ Proteção de credenciais: senha incorreta rejeitada com 401.');

  // ---------------------------------------------------------------------------
  // 3. RECUPERAÇÃO DE SENHA (ESQUECI MINHA SENHA)
  // ---------------------------------------------------------------------------
  console.log('\n--- TESTE 5: Solicitação de recuperação de senha com link seguro ---');
  lastSentEmail = null;
  const forgotRes = await authService.forgotPassword('mariana.silva@exemplo.com');
  assert.ok(forgotRes.message.includes('instruções'), 'Mensagem neutra de segurança');

  const resetTokenRecord = tables.password_reset_tokens.find(t => t.user_id === userReg.user.id);
  assert.ok(resetTokenRecord, 'Token de recuperação gravado no banco');
  assert.strictEqual(resetTokenRecord.used_at, null);
  assert.ok(lastSentEmail, 'E-mail de recuperação deve ter sido disparado');
  assert.strictEqual(lastSentEmail.to, 'mariana.silva@exemplo.com', 'Destinatário deve ser o e-mail real do usuário');
  assert.ok(lastSentEmail.html.includes('reset_token='), 'E-mail deve conter link funcional de redefinição');
  console.log('✓ Solicitação de recuperação enviada ao e-mail real com token seguro.');

  console.log('\n--- TESTE 6: Redefinição de senha e revogação atômica de sessões ---');
  // Extrai o token da URL do e-mail
  const urlMatch = lastSentEmail.html.match(/reset_token=([a-f0-9]{64})/);
  assert.ok(urlMatch, 'Token deve ser extraído do e-mail');
  const token = urlMatch[1];

  const resetRes = await authService.resetPassword(token, 'MinhaNovaSenha2026!');
  assert.ok(resetRes.message.includes('sucesso'));
  assert.ok(resetTokenRecord.used_at, 'Token deve ser marcado como utilizado');

  // Tentativa de reutilizar o mesmo token
  let reuseThrew = false;
  try {
    await authService.resetPassword(token, 'OutraSenhaTentativa!');
  } catch (err) {
    reuseThrew = true;
    assert.strictEqual(err.statusCode, 400);
  }
  assert.ok(reuseThrew, 'Token já utilizado não pode ser reutilizado');

  // Valida login com nova senha
  const newLogin = await authService.login('mariana.silva@exemplo.com', 'MinhaNovaSenha2026!');
  assert.ok(newLogin.accessToken, 'Deve autenticar com a nova senha');
  console.log('✓ Senha redefinida, token de uso único invalidado e login validado.');

  // ---------------------------------------------------------------------------
  // 4. DESAFIO DE VERIFICAÇÃO EM 2 ETAPAS (2FA) PARA ADMINISTRADORES
  // ---------------------------------------------------------------------------
  console.log('\n--- TESTE 7: Login de Administrador — Emissão de Desafio 2FA ---');
  // Cadastra usuário admin e associa à organização
  const adminHash = await bcrypt.hash('AdminMaster123!', 10);
  const adminUser = {
    id: 10,
    name: 'Carlos Organizador',
    email: 'carlos.admin@evotech.com',
    password_hash: adminHash,
    role: 'participante', // Papel base
    status: 'active',
  };
  tables.users.push(adminUser);
  tables.organization_members.push({
    user_id: 10,
    organization_id: 1,
    role: 'owner', // Torna-o admin
    status: 'active',
  });

  lastSentEmail = null;
  const adminChallenge = await authService.login('carlos.admin@evotech.com', 'AdminMaster123!', {
    ipAddress: '189.45.22.10',
  });

  assert.strictEqual(adminChallenge.requires2FA, true, 'Conta administrativa DEVE exigir 2FA');
  assert.ok(adminChallenge.challengeToken, 'Deve retornar challengeToken seguro');
  assert.strictEqual(adminChallenge.accessToken, undefined, 'NÃO pode emitir JWT antes do 2FA');
  assert.strictEqual(adminChallenge.emailMasked.includes('@evotech.com'), true);

  // Confirma disparo de e-mail com código de 6 dígitos
  assert.ok(lastSentEmail, 'E-mail 2FA disparado via Resend');
  assert.strictEqual(lastSentEmail.to, 'carlos.admin@evotech.com', 'E-mail enviado para o endereço real do administrador');
  const codeMatch = lastSentEmail.text.match(/\b\d{6}\b/);
  assert.ok(codeMatch, 'E-mail deve conter código de 6 dígitos');
  const adminCode = codeMatch[0];
  console.log(`✓ Desafio 2FA ativado para admin: código de 6 dígitos enviado para ${lastSentEmail.to}.`);

  console.log('\n--- TESTE 8: Validação de 2FA com código incorreto ---');
  let wrongCodeThrew = false;
  try {
    await authService.verifyAdminCode({
      challengeToken: adminChallenge.challengeToken,
      code: '000000',
    });
  } catch (err) {
    wrongCodeThrew = true;
    assert.strictEqual(err.statusCode, 401);
    assert.ok(err.message.includes('incorreto'));
  }
  assert.ok(wrongCodeThrew, 'Código incorreto deve ser rejeitado');
  console.log('✓ Código 2FA incorreto rejeitado com controle de tentativas.');

  console.log('\n--- TESTE 9: Validação de 2FA com código correto ---');
  const adminVerified = await authService.verifyAdminCode({
    challengeToken: adminChallenge.challengeToken,
    code: adminCode,
  });
  assert.ok(adminVerified.accessToken, 'Deve emitir accessToken após 2FA correto');
  assert.strictEqual(adminVerified.user.role, 'admin');
  assert.strictEqual(adminVerified.user.organizationId, 1);
  console.log('✓ 2FA validado com sucesso: sessão administrativa liberada.');

  console.log('\n--- TESTE 10: Impedimento de reutilização do código 2FA ---');
  let reuse2FAThrew = false;
  try {
    await authService.verifyAdminCode({
      challengeToken: adminChallenge.challengeToken,
      code: adminCode,
    });
  } catch (err) {
    reuse2FAThrew = true;
    assert.strictEqual(err.statusCode, 401);
  }
  assert.ok(reuse2FAThrew, 'Código 2FA já utilizado deve ser rejeitado');
  console.log('✓ Código 2FA de uso único comprovado.');

  console.log('\n--- TESTE 11: Rate limit no reenvio do código 2FA ---');
  const challenge2 = await authService.login('carlos.admin@evotech.com', 'AdminMaster123!');
  assert.strictEqual(challenge2.requires2FA, true);

  // Solicita reenvio imediato (deve ser bloqueado pelo intervalo mínimo de 60s)
  let resendRateThrew = false;
  try {
    await authService.resendAdminCode({ challengeToken: challenge2.challengeToken });
  } catch (err) {
    resendRateThrew = true;
    assert.strictEqual(err.statusCode, 400);
    assert.ok(err.message.includes('segundos'));
  }
  assert.ok(resendRateThrew, 'Reenvio imediato bloqueado por rate limit');
  console.log('✓ Rate limit de reenvio de código 2FA validado com sucesso.');

  // ---------------------------------------------------------------------------
  // 5. CENTRAL DE NOTIFICAÇÕES INTERNAS (IN-APP NOTIFICATIONS)
  // ---------------------------------------------------------------------------
  console.log('\n--- TESTE 12: Criação e consulta de notificações internas ---');
  await inAppNotificationService.createNotification({
    organizationId: 1,
    category: 'sales',
    severity: 'info',
    title: 'Nova venda de ingresso',
    message: 'Pedido #501 confirmado no valor de R$ 180,00.',
  });
  await inAppNotificationService.createNotification({
    organizationId: 1,
    category: 'stock',
    severity: 'critical',
    title: 'Estoque de Cerveja Crítico',
    message: 'Restam apenas 15 unidades no estoque principal.',
  });

  const listAll = await inAppNotificationService.listNotifications({ organizationId: 1 });
  assert.ok(listAll.total >= 2, 'Deve listar notificações internas criadas');
  assert.ok(listAll.unreadCount >= 2, 'Contador de não lidas deve corresponder');
  console.log(`✓ Central interna: ${listAll.total} notificações registradas com ${listAll.unreadCount} não lidas.`);

  console.log('\n--- TESTE 13: Marcação individual e em lote como lida ---');
  const firstNotif = listAll.items[0];
  const readSuccess = await inAppNotificationService.markAsRead(firstNotif.id, 1);
  assert.strictEqual(readSuccess, true);

  const unreadCountAfterOne = await inAppNotificationService.getUnreadCount(1);
  assert.strictEqual(unreadCountAfterOne, listAll.unreadCount - 1);

  await inAppNotificationService.markAllAsRead(1);
  const finalUnread = await inAppNotificationService.getUnreadCount(1);
  assert.strictEqual(finalUnread, 0, 'Todas as notificações devem estar lidas');
  console.log('✓ Marcação individual e em massa (markAllAsRead) 100% validadas.');

  // ---------------------------------------------------------------------------
  // 6. TRATAMENTO DE ERROS DO RESEND E OUTBOX PERSISTENTE
  // ---------------------------------------------------------------------------
  console.log('\n--- TESTE 14: Resiliência contra restrição Sandbox da API do Resend ---');
  resendShouldFail = true; // Simula a rejeição 403 do Resend (domínio não verificado)

  const failResult = await notificationOutboxService.sendImmediateTransactional({
    organizationId: 1,
    category: 'transactional',
    recipientEmail: 'comprador.externo@outrodominio.com',
    recipientName: 'Comprador Externo',
    subject: 'Confirmação de Teste',
    htmlBody: '<p>Teste</p>',
    textBody: 'Teste',
  });

  assert.strictEqual(failResult.success, false, 'Deve retornar failure controlado');
  assert.ok(failResult.error.includes('testing emails to your own email address'), 'Deve capturar mensagem oficial do Resend');

  // Verifica que a notificação foi persistida no outbox com retenção segura e registro de erro
  const failedJob = tables.notification_outbox.find(o => o.id === failResult.outboxId);
  assert.ok(failedJob, 'Notificação deve estar persistida no outbox');
  assert.ok(['pending', 'resend_failed'].includes(failedJob.status), 'Status do outbox deve registrar retenção ou reagendamento');
  assert.strictEqual(failedJob.attempts, 1, 'Tentativa de envio registrada no outbox');
  assert.ok(failedJob.last_error.includes('testing emails'), 'Erro do provedor deve ser registrado no banco');
  console.log('✓ Rejeição do provedor tratada sem crash, com registro transparente no outbox.');

  console.log('\n================================================================');
  console.log(' SUCESSO ABSOLUTO: TODOS OS 14 TESTES FORAM APROVADOS!         ');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ FALHA NOS TESTES:', err);
  process.exit(1);
});
