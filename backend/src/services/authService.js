'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const emailService = require('./emailService');
const notificationOutboxService = require('./notificationOutboxService');
const inAppNotificationService = require('./inAppNotificationService');

const hashToken = t => crypto.createHash('sha256').update(t).digest('hex');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, jti: crypto.randomUUID() },
    env.jwt.secret,
    {
      algorithm: 'HS256',
      expiresIn: env.jwt.expiresIn,
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
    }
  );
}

async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + env.jwt.refreshExpiresDays * 86400000);
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, hashToken(token), expiresAt]
  );
  return token;
}

// Monta o objeto de sessão que o frontend consome (formato próximo do
// antigo evo_session, para não quebrar as telas).
async function buildSession(userId) {
  const user = await db.queryOne(
    `SELECT id, name, email, cpf, phone, birth_date, role, status
       FROM users WHERE id = ? LIMIT 1`, [userId]
  );
  if (!user) throw AppError.unauthorized('Usuário não encontrado.');

  const membership = await db.queryOne(
    `SELECT om.organization_id, om.role, o.name AS organization_name
       FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = ? AND om.status = 'active'
      ORDER BY FIELD(om.role,'owner','admin','finance','bar','gate')
      LIMIT 1`, [userId]
  );

  return {
    id: user.id,
    nome: user.name,
    email: user.email,
    cpf: user.cpf,
    tel: user.phone,
    dt: user.birth_date,
    // "admin" = tem acesso ao painel; é o que admin-guard.js verifica.
    role: membership ? 'admin' : 'participante',
    orgRole: membership ? membership.role : null,
    organizationId: membership ? membership.organization_id : null,
    organizationName: membership ? membership.organization_name : null,
  };
}

async function register(data) {
  const exists = await db.queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [data.email]);
  if (exists) throw AppError.conflict('E-mail já cadastrado.');

  if (data.cpf) {
    const cpfTaken = await db.queryOne('SELECT id FROM users WHERE cpf = ? LIMIT 1', [data.cpf]);
    if (cpfTaken) throw AppError.conflict('CPF já cadastrado.');
  }

  const passwordHash = await bcrypt.hash(data.password, env.bcryptRounds);
  const result = await db.query(
    `INSERT INTO users (name, email, password_hash, cpf, phone, birth_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.name, data.email, passwordHash, data.cpf || null, data.phone || null, data.birthDate || null]
  );

  const userId = result.insertId;

  // Envio do e-mail de boas-vindas com persistência garantida na outbox
  const loginUrl = `${env.frontendUrl}/index.html`;
  const renderWelcomeTemplate = require('./emailTemplates/welcomeTemplate');
  const { html, text } = renderWelcomeTemplate({ name: data.name, loginUrl });

  await notificationOutboxService.sendImmediateTransactional({
    organizationId: null,
    category: 'transactional',
    recipientUserId: userId,
    recipientEmail: data.email,
    recipientName: data.name,
    subject: 'Bem-vindo ao EvoTech Events',
    htmlBody: html,
    textBody: text,
    idempotencyKey: `welcome_${userId}`,
  }).catch(err => logger.error('[Auth] Erro ao enviar boas-vindas:', err.message));

  // Notificação interna para a equipe e administradores
  inAppNotificationService.createNotification({
    category: 'account',
    severity: 'info',
    title: 'Novo cadastro de participante',
    message: `Novo participante registrado: ${data.name} (${emailService.maskEmail(data.email)}).`,
    metadata: { userId, email: emailService.maskEmail(data.email) },
  }).catch(err => logger.error('[Auth] Erro ao registrar alerta interno de cadastro:', err.message));

  return issueTokens(userId);
}

const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

function checkLoginLockout(key) {
  const record = loginAttempts.get(key);
  if (!record) return;
  const now = Date.now();
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingMin = Math.ceil((record.lockedUntil - now) / 60000);
    throw new AppError(
      `Muitas tentativas incorretas. Por segurança, tente novamente em ${remainingMin} minuto(s).`,
      429,
      'TOO_MANY_ATTEMPTS'
    );
  }
  if (now > record.resetAt) {
    loginAttempts.delete(key);
  }
}

function recordFailedLogin(key) {
  const now = Date.now();
  let record = loginAttempts.get(key);
  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + LOCKOUT_DURATION_MS, lockedUntil: 0 };
  }
  record.count += 1;
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
  loginAttempts.set(key, record);
}

function clearFailedLogin(key) {
  loginAttempts.delete(key);
}

async function login(email, password, { ipAddress = null, userAgent = null } = {}) {
  const attemptKey = `${ipAddress || 'local'}:${email.toLowerCase().trim()}`;
  checkLoginLockout(attemptKey);

  const user = await db.queryOne(
    'SELECT id, name, email, password_hash, status FROM users WHERE email = ? LIMIT 1', [email]
  );
  // Mensagem única para e-mail inexistente e senha errada (não revela cadastro).
  if (!user) {
    recordFailedLogin(attemptKey);
    throw AppError.unauthorized('E-mail ou senha incorretos.');
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    recordFailedLogin(attemptKey);
    throw AppError.unauthorized('E-mail ou senha incorretos.');
  }
  if (user.status === 'blocked') throw AppError.forbidden('Conta bloqueada. Fale com o organizador.');

  // Sucesso: limpa falhas registradas
  clearFailedLogin(attemptKey);

  const session = await buildSession(user.id);

  // DESAFIO 2FA OBRIGATÓRIO PARA CONTAS COM ACESSO ADMINISTRATIVO
  if (session.role === 'admin') {
    // 1. Gera token de desafio criptográfico seguro (64 caracteres hex)
    const challengeToken = crypto.randomBytes(32).toString('hex');
    // 2. Gera código OTP numérico de 6 dígitos
    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashToken(code);

    // 3. Invalida desafios anteriores não utilizados deste usuário
    await db.query(
      'UPDATE admin_login_codes SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
      [user.id]
    );

    // 4. Armazena o código de verificação com expiração de 10 min e reenvio em 60s
    await db.query(
      `INSERT INTO admin_login_codes (
        user_id, challenge_token, code_hash, expires_at, resend_available_at, ip_address, user_agent
      ) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 60 SECOND), ?, ?)`,
      [user.id, challengeToken, codeHash, ipAddress || null, userAgent || null]
    );

    // 5. Renderiza template oficial de segurança e envia via outbox persistente imediata
    const renderAdminLoginCodeTemplate = require('./emailTemplates/adminLoginCodeTemplate');
    const { html, text } = renderAdminLoginCodeTemplate({
      name: user.name,
      code,
      expiresMinutes: 10,
      ipAddress,
    });

    await notificationOutboxService.sendImmediateTransactional({
      organizationId: session.organizationId,
      category: 'transactional',
      recipientUserId: user.id,
      recipientEmail: user.email,
      recipientName: user.name,
      subject: `Código de Acesso Administrativo: ${code} — EvoTech Events`,
      htmlBody: html,
      textBody: text,
      idempotencyKey: `admin_2fa_${challengeToken}`,
    }).catch(err => logger.error('[Auth] Falha no disparo do código 2FA:', err.message));

    // 6. Registra notificação interna de segurança
    inAppNotificationService.createNotification({
      organizationId: session.organizationId,
      category: 'account',
      severity: 'warning',
      title: 'Desafio 2FA de Login Administrativo',
      message: `Código de acesso emitido para o administrador ${user.name} (${emailService.maskEmail(user.email)}).`,
      metadata: { userId: user.id, ipAddress },
    }).catch(err => logger.error('[Auth] Erro ao registrar alerta 2FA:', err.message));

    return {
      requires2FA: true,
      challengeToken,
      emailMasked: emailService.maskEmail(user.email),
      expiresInSeconds: 600,
    };
  }

  // Usuário participante comum: autenticação direta
  return issueTokens(user.id);
}

/**
 * Valida o código 2FA enviado por e-mail e libera a sessão administrativa
 */
async function verifyAdminCode({ challengeToken, code, ipAddress = null }) {
  if (!challengeToken || !code) {
    throw AppError.badRequest('Token de desafio e código de 6 dígitos são obrigatórios.');
  }

  const row = await db.queryOne(
    `SELECT id, user_id, code_hash, attempts, max_attempts, expires_at, used_at
       FROM admin_login_codes
      WHERE challenge_token = ?
      LIMIT 1`,
    [challengeToken]
  );

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    throw AppError.unauthorized('Código de verificação expirado ou inválido. Faça login novamente.');
  }

  if (Number(row.attempts) >= Number(row.max_attempts)) {
    await db.query('UPDATE admin_login_codes SET used_at = NOW() WHERE id = ?', [row.id]);
    const user = await db.queryOne('SELECT email, name FROM users WHERE id = ?', [row.user_id]);
    await inAppNotificationService.createNotification({
      category: 'account',
      severity: 'critical',
      title: 'Tentativa suspeita de acesso administrativo bloqueada',
      message: `Acesso bloqueado para ${emailService.maskEmail(user?.email)} por excesso de tentativas incorretas no 2FA.`,
      metadata: { userId: row.user_id, ipAddress },
    });
    throw AppError.unauthorized('Limite de tentativas excedido. Faça login novamente.');
  }

  const expectedHash = hashToken(code);
  const expBuf = Buffer.from(expectedHash, 'hex');
  const actBuf = Buffer.from(row.code_hash, 'hex');
  const isMatch = expBuf.length === actBuf.length && crypto.timingSafeEqual(expBuf, actBuf);

  if (!isMatch) {
    const nextAttempts = Number(row.attempts) + 1;
    await db.query('UPDATE admin_login_codes SET attempts = ? WHERE id = ?', [nextAttempts, row.id]);

    if (nextAttempts >= Number(row.max_attempts)) {
      await db.query('UPDATE admin_login_codes SET used_at = NOW() WHERE id = ?', [row.id]);
      throw AppError.unauthorized('Código incorreto. Limite de tentativas excedido. Faça login novamente.');
    }

    const remaining = Number(row.max_attempts) - nextAttempts;
    throw AppError.unauthorized(`Código de verificação incorreto. Você tem mais ${remaining} tentativa(s).`);
  }

  // Código correto: consome o token de uso único
  await db.query('UPDATE admin_login_codes SET used_at = NOW() WHERE id = ?', [row.id]);

  const session = await buildSession(row.user_id);

  // Registra acesso bem-sucedido na central de notificações internas
  await inAppNotificationService.createNotification({
    organizationId: session.organizationId,
    category: 'account',
    severity: 'info',
    title: 'Acesso administrativo autorizado (2FA)',
    message: `Administrador ${session.nome} concluiu verificação 2FA com sucesso.`,
    metadata: { userId: row.user_id, ipAddress },
  });

  return issueTokens(row.user_id);
}

/**
 * Reenvia o código 2FA com respeito ao intervalo mínimo de 60 segundos
 */
async function resendAdminCode({ challengeToken, ipAddress = null }) {
  if (!challengeToken) {
    throw AppError.badRequest('Token de desafio obrigatório.');
  }

  const row = await db.queryOne(
    `SELECT id, user_id, resend_available_at, expires_at, used_at
       FROM admin_login_codes
      WHERE challenge_token = ?
      LIMIT 1`,
    [challengeToken]
  );

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    throw AppError.unauthorized('Sessão de verificação expirada. Faça login novamente.');
  }

  if (new Date(row.resend_available_at) > new Date()) {
    const waitSeconds = Math.max(1, Math.ceil((new Date(row.resend_available_at).getTime() - Date.now()) / 1000));
    throw AppError.badRequest(`Aguarde ${waitSeconds} segundos antes de solicitar um novo código.`);
  }

  const user = await db.queryOne('SELECT id, name, email FROM users WHERE id = ?', [row.user_id]);
  if (!user) throw AppError.unauthorized('Usuário não encontrado.');

  const session = await buildSession(user.id);

  // Invalida o código anterior
  await db.query('UPDATE admin_login_codes SET used_at = NOW() WHERE id = ?', [row.id]);

  // Gera novo código
  const newCode = String(crypto.randomInt(100000, 1000000));
  const newCodeHash = hashToken(newCode);

  await db.query(
    `INSERT INTO admin_login_codes (
      user_id, challenge_token, code_hash, expires_at, resend_available_at, ip_address
    ) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 60 SECOND), ?)`,
    [user.id, challengeToken, newCodeHash, ipAddress]
  );

  const renderAdminLoginCodeTemplate = require('./emailTemplates/adminLoginCodeTemplate');
  const { html, text } = renderAdminLoginCodeTemplate({
    name: user.name,
    code: newCode,
    expiresMinutes: 10,
    ipAddress,
  });

  await notificationOutboxService.sendImmediateTransactional({
    organizationId: session.organizationId,
    category: 'transactional',
    recipientUserId: user.id,
    recipientEmail: user.email,
    recipientName: user.name,
    subject: `Novo Código de Acesso Administrativo: ${newCode} — EvoTech Events`,
    htmlBody: html,
    textBody: text,
    idempotencyKey: `admin_2fa_resend_${Date.now()}`,
  }).catch(err => logger.error('[Auth] Erro ao reenviar código 2FA:', err.message));

  return {
    success: true,
    message: `Novo código enviado com sucesso para ${emailService.maskEmail(user.email)}.`,
    expiresInSeconds: 600,
  };
}

async function issueTokens(userId) {
  const session = await buildSession(userId);
  const accessToken = signAccessToken({ id: userId, role: session.role });
  const refreshToken = await issueRefreshToken(userId);
  return { accessToken, refreshToken, user: session };
}

async function refresh(refreshToken) {
  const row = await db.queryOne(
    `SELECT id, user_id, expires_at, revoked_at
       FROM refresh_tokens WHERE token_hash = ? LIMIT 1`,
    [hashToken(refreshToken)]
  );
  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) {
    throw AppError.unauthorized('Sessão expirada. Faça login novamente.');
  }
  // Rotação: o token usado é revogado e um novo é emitido.
  await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [row.id]);
  return issueTokens(row.user_id);
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  await db.query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
    [hashToken(refreshToken)]
  );
}

async function updateMe(userId, data) {
  let passwordChanged = false;
  if (data.newPassword) {
    const user = await db.queryOne('SELECT password_hash FROM users WHERE id = ?', [userId]);
    const match = await bcrypt.compare(data.currentPassword || '', user.password_hash);
    if (!match) throw AppError.badRequest('Senha atual incorreta.');
    const hash = await bcrypt.hash(data.newPassword, env.bcryptRounds);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
    passwordChanged = true;
  }
  const fields = [];
  const params = [];
  if (data.name)  { fields.push('name = ?');  params.push(data.name); }
  if (data.phone) { fields.push('phone = ?'); params.push(data.phone); }
  if (fields.length) {
    params.push(userId);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  if (passwordChanged) {
    const u = await db.queryOne('SELECT name, email FROM users WHERE id = ?', [userId]);
    if (u) {
      emailService.sendPasswordChangedNotification({ to: u.email, name: u.name })
        .then(result => {
          if (result && !result.success) {
            logger.error(`[Auth] Falha no envio do aviso de alteração de senha: ${result.error}`);
          }
        })
        .catch(err => logger.error('[Auth] Exceção ao enviar aviso de alteração de senha:', err.message));
    }
  }
  return buildSession(userId);
}

async function forgotPassword(email) {
  const genericMessage = 'Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.';
  if (!email) return { message: genericMessage };

  const user = await db.queryOne('SELECT id, name, email FROM users WHERE email = ? LIMIT 1', [email]);
  if (!user) {
    // Retorna mensagem genérica para não revelar existência de usuário (proteção contra enumeração)
    return { message: genericMessage };
  }

  // Invalida tokens anteriores não utilizados do usuário
  await db.query(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
    [user.id]
  );

  // Gera token criptograficamente seguro (32 bytes = 64 chars hex)
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

  await db.query(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [user.id, tokenHash, expiresAt]
  );

  // Renderiza template de e-mail de recuperação de senha
  const renderPasswordResetTemplate = require('./emailTemplates/passwordResetTemplate');
  const resetLink = `${env.frontendUrl}/index.html?reset_token=${encodeURIComponent(token)}`;
  const { html, text } = renderPasswordResetTemplate({ name: user.name, resetLink, expiresMinutes: 30 });

  // Dispara e-mail de recuperação de senha via outbox persistente imediata
  await notificationOutboxService.sendImmediateTransactional({
    organizationId: null,
    category: 'transactional',
    recipientUserId: user.id,
    recipientEmail: user.email,
    recipientName: user.name,
    subject: 'Recuperação de Senha — EvoTech Events',
    htmlBody: html,
    textBody: text,
    idempotencyKey: `pwd_reset_${tokenHash}`,
  }).catch(err => logger.error('[Auth] Erro ao disparar e-mail de recuperação de senha:', err.message));

  // Alerta interno na central de notificações administrativas
  inAppNotificationService.createNotification({
    category: 'account',
    severity: 'info',
    title: 'Solicitação de recuperação de senha',
    message: `Instruções de redefinição de senha geradas para uma conta de usuário.`,
    metadata: { emailMasked: emailService.maskEmail(user.email) },
  }).catch(err => logger.error('[Auth] Erro ao registrar alerta de recuperação:', err.message));

  return { message: genericMessage };
}

async function resetPassword(token, newPassword) {
  if (!token) throw AppError.badRequest('Token de recuperação obrigatório.');
  const tokenHash = hashToken(token);

  // bcrypt.hash executado ANTES da transação: é CPU-intensivo e não pode segurar
  // o lock da conexão durante o processamento. A validação prévia do token é feita
  // fora da transação apenas para retornar erros de forma rápida ao usuário.
  // A validação definitiva ocorre DENTRO da transação com SELECT FOR UPDATE.
  const preCheck = await db.queryOne(
    `SELECT id, expires_at, used_at
       FROM password_reset_tokens
      WHERE token_hash = ?
      LIMIT 1`,
    [tokenHash]
  );
  if (!preCheck || preCheck.used_at || new Date(preCheck.expires_at) < new Date()) {
    throw AppError.badRequest('Link de recuperação inválido ou expirado.');
  }

  // Hash da nova senha feito fora da transação (operação CPU-intensiva)
  const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);

  // Variáveis para capturar dados após a transação (necessários para o e-mail)
  let userEmail = null;
  let userName = null;

  await db.transaction(async (conn) => {
    // SELECT FOR UPDATE serializa acessos concorrentes ao mesmo token.
    // Se dois requests chegarem ao mesmo tempo com o mesmo token,
    // apenas um obterá o lock; o segundo encontrará used_at preenchido.
    const [tokenRows] = await conn.execute(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.name, u.email
         FROM password_reset_tokens prt
         JOIN users u ON u.id = prt.user_id
        WHERE prt.token_hash = ?
        LIMIT 1
        FOR UPDATE`,
      [tokenHash]
    );
    const row = tokenRows[0];

    // Validação definitiva dentro da transação com lock
    if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
      throw AppError.badRequest('Link de recuperação inválido ou expirado.');
    }

    // 1. Altera a senha
    await conn.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, row.user_id]
    );

    // 2. Marca token como utilizado (one-time use, dentro da mesma transação)
    await conn.execute(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?',
      [row.id]
    );

    // 3. Revoga todas as sessões ativas por segurança
    await conn.execute(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [row.user_id]
    );

    userEmail = row.email;
    userName = row.name;
  });

  // E-mail disparado de forma assíncrona APÓS confirmação do commit da transação
  if (userEmail) {
    const renderPasswordChangedTemplate = require('./emailTemplates/passwordChangedTemplate');
    const { html, text } = renderPasswordChangedTemplate({ name: userName, timestamp: Date.now() });

    await notificationOutboxService.sendImmediateTransactional({
      organizationId: null,
      category: 'transactional',
      recipientEmail: userEmail,
      recipientName: userName,
      subject: 'Segurança: Sua senha foi alterada — EvoTech Events',
      htmlBody: html,
      textBody: text,
      idempotencyKey: `pwd_changed_${Date.now()}_${userEmail}`,
    }).catch(err => logger.error('[Auth] Falha ao disparar notificação de senha alterada:', err.message));

    inAppNotificationService.createNotification({
      category: 'account',
      severity: 'info',
      title: 'Senha de conta alterada com sucesso',
      message: `A senha do usuário ${userName} (${emailService.maskEmail(userEmail)}) foi redefinida com revogação das sessões ativas.`,
      metadata: { emailMasked: emailService.maskEmail(userEmail) },
    }).catch(err => logger.error('[Auth] Erro ao registrar notificação de troca de senha:', err.message));
  }

  return { message: 'Senha atualizada com sucesso. Você já pode fazer login com sua nova senha.' };
}

// Ingressos e histórico do participante (aba "Meus ingressos").
async function myTickets(userId, email) {
  return db.query(
    `SELECT t.id, t.code, t.status, t.price_paid, t.issued_at,
            b.name AS batch_name,
            e.id AS event_id, e.name AS event_name, e.event_date, e.venue, e.banner_url,
            c.checked_in_at
       FROM tickets t
       JOIN ticket_batches b ON b.id = t.batch_id
       JOIN events e         ON e.id = t.event_id
       JOIN orders o         ON o.id = t.order_id
  LEFT JOIN checkins c       ON c.ticket_id = t.id
      WHERE (o.user_id = ? OR t.holder_email = ?)
        AND o.status = 'paid'
      ORDER BY t.issued_at DESC`,
    [userId, email]
  );
}

async function myHistory(userId, email) {
  return db.query(
    `SELECT e.name AS event_name, e.event_date, c.checked_in_at
       FROM checkins c
       JOIN tickets t ON t.id = c.ticket_id
       JOIN orders o  ON o.id = t.order_id
       JOIN events e  ON e.id = c.event_id
      WHERE o.user_id = ? OR t.holder_email = ?
      ORDER BY c.checked_in_at DESC`,
    [userId, email]
  );
}

// Lista completa de pedidos do participante (pending, paid, cancelled)
async function myOrders(userId, email) {
  const orders = await db.query(
    `SELECT o.id, o.event_id, o.total_amount, o.status, o.payment_method,
            o.paid_at, o.created_at, o.cancellation_reason,
            e.name AS event_name, e.event_date, e.venue, e.banner_url
       FROM orders o
       JOIN events e ON e.id = o.event_id
      WHERE o.user_id = ? OR o.buyer_email = ?
      ORDER BY o.created_at DESC`,
    [userId, email]
  );

  if (orders.length === 0) return [];

  const orderIds = orders.map(o => o.id);
  const placeholders = orderIds.map(() => '?').join(',');

  // Busca itens dos pedidos
  const items = await db.query(
    `SELECT oi.order_id, oi.batch_id, oi.quantity, oi.unit_price,
            b.name AS batch_name
       FROM order_items oi
       JOIN ticket_batches b ON b.id = oi.batch_id
      WHERE oi.order_id IN (${placeholders})`,
    orderIds
  );

  // Busca tickets emitidos (para pedidos confirmados)
  const tickets = await db.query(
    `SELECT t.id, t.order_id, t.code, t.holder_name, t.price_paid, t.status, t.issued_at,
            b.name AS batch_name,
            c.checked_in_at
       FROM tickets t
       JOIN ticket_batches b ON b.id = t.batch_id
  LEFT JOIN checkins c       ON c.ticket_id = t.id
      WHERE t.order_id IN (${placeholders})
      ORDER BY t.id ASC`,
    orderIds
  );

  const itemsByOrder = items.reduce((acc, item) => {
    (acc[item.order_id] = acc[item.order_id] || []).push(item);
    return acc;
  }, {});

  const ticketsByOrder = tickets.reduce((acc, ticket) => {
    (acc[ticket.order_id] = acc[ticket.order_id] || []).push(ticket);
    return acc;
  }, {});

  return orders.map(order => ({
    ...order,
    items: itemsByOrder[order.id] || [],
    tickets: ticketsByOrder[order.id] || [],
  }));
}

async function myOrderDetails(orderId, userId, email) {
  const order = await db.queryOne(
    `SELECT o.id, o.event_id, o.total_amount, o.status, o.payment_method,
            o.paid_at, o.created_at, o.cancellation_reason,
            e.name AS event_name, e.event_date, e.venue, e.banner_url
       FROM orders o
       JOIN events e ON e.id = o.event_id
      WHERE o.id = ? AND (o.user_id = ? OR o.buyer_email = ?)
      LIMIT 1`,
    [orderId, userId, email]
  );

  if (!order) throw AppError.notFound('Pedido não encontrado.');

  const items = await db.query(
    `SELECT oi.id, oi.batch_id, oi.quantity, oi.unit_price,
            b.name AS batch_name
       FROM order_items oi
       JOIN ticket_batches b ON b.id = oi.batch_id
      WHERE oi.order_id = ?`,
    [orderId]
  );

  const tickets = await db.query(
    `SELECT t.id, t.code, t.holder_name, t.price_paid, t.status, t.issued_at,
            b.name AS batch_name,
            c.checked_in_at
       FROM tickets t
       JOIN ticket_batches b ON b.id = t.batch_id
  LEFT JOIN checkins c       ON c.ticket_id = t.id
      WHERE t.order_id = ?
      ORDER BY t.id ASC`,
    [orderId]
  );

  return {
    ...order,
    items,
    tickets,
  };
}

module.exports = {
  register, login, refresh, logout, updateMe, forgotPassword, resetPassword,
  verifyAdminCode, resendAdminCode,
  buildSession, myTickets, myHistory, myOrders, myOrderDetails,
};
