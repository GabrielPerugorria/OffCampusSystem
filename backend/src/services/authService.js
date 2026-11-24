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
  let user;
  try {
    user = await db.queryOne(
      `SELECT id, name, email, cpf, phone, birth_date, avatar_url, role, status, email_verified_at
         FROM users WHERE id = ? LIMIT 1`, [userId]
    );
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      user = await db.queryOne(
        `SELECT id, name, email, cpf, phone, birth_date, role, status
           FROM users WHERE id = ? LIMIT 1`, [userId]
      );
    } else {
      throw err;
    }
  }
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
    avatarUrl: user.avatar_url || null,
    emailVerified: user.email_verified_at === undefined ? true : Boolean(user.email_verified_at),
    // "admin" = tem acesso ao painel; é o que admin-guard.js verifica.
    role: membership ? 'admin' : 'participante',
    orgRole: membership ? membership.role : null,
    organizationId: membership ? membership.organization_id : null,
    organizationName: membership ? membership.organization_name : null,
  };
}

async function createEmailVerificationChallenge({ userId, userName, targetEmail, purpose = 'register', ipAddress = null, userAgent = null }) {
  const challengeToken = crypto.randomBytes(32).toString('hex');
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashToken(code);

  await db.query(
    'UPDATE email_verification_codes SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL',
    [userId, purpose]
  );

  await db.query(
    `INSERT INTO email_verification_codes (
      user_id, purpose, target_email, challenge_token, code_hash, expires_at, resend_available_at, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), DATE_ADD(NOW(), INTERVAL 60 SECOND), ?, ?)`,
    [userId, purpose, targetEmail, challengeToken, codeHash, ipAddress || null, userAgent || null]
  );

  let html;
  let text;
  let subject;
  if (purpose === 'email_change') {
    const renderEmailChangeCodeTemplate = require('./emailTemplates/emailChangeCodeTemplate');
    ({ html, text } = renderEmailChangeCodeTemplate({ name: userName, newEmail: targetEmail, code, expiresMinutes: 15 }));
    subject = `Confirme seu novo e-mail: ${code} — EvoTech Events`;
  } else {
    const renderEmailVerificationTemplate = require('./emailTemplates/emailVerificationTemplate');
    ({ html, text } = renderEmailVerificationTemplate({ name: userName, code, expiresMinutes: 15 }));
    subject = `Código de Verificação: ${code} — EvoTech Events`;
  }

  const sendResult = await notificationOutboxService.sendImmediateTransactional({
    organizationId: null,
    category: 'transactional',
    recipientUserId: userId,
    recipientEmail: targetEmail,
    recipientName: userName,
    subject,
    htmlBody: html,
    textBody: text,
    idempotencyKey: `email_verify_${purpose}_${challengeToken}`,
  });

  return {
    challengeToken,
    emailMasked: emailService.maskEmail(targetEmail),
    expiresInSeconds: 900,
    emailDeliveryFailed: !sendResult || !sendResult.success,
    deliveryError: sendResult && sendResult.success ? null : (sendResult?.error || 'Não foi possível enviar o e-mail de verificação.'),
  };
}

async function register(data, { ipAddress = null, userAgent = null } = {}) {
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

  // Gera e envia código de 6 dígitos para confirmação obrigatória do e-mail
  const challenge = await createEmailVerificationChallenge({
    userId,
    userName: data.name,
    targetEmail: data.email,
    purpose: 'register',
    ipAddress,
    userAgent,
  });

  // Notificação interna para a equipe e administradores da plataforma
  inAppNotificationService.createNotification({
    category: 'account',
    severity: 'info',
    title: 'Novo cadastro de participante',
    message: `Novo participante registrado: ${data.name} (${emailService.maskEmail(data.email)}) — aguardando confirmação de e-mail.`,
    metadata: { userId, email: emailService.maskEmail(data.email) },
  }).catch(err => logger.error('[Auth] Erro ao registrar alerta interno de cadastro:', err.message));

  return {
    requiresEmailVerification: true,
    ...challenge,
  };
}

async function verifyEmail({ challengeToken, code, ipAddress = null }) {
  if (!challengeToken || !code) {
    throw AppError.badRequest('Token de verificação e código de 6 dígitos são obrigatórios.');
  }

  const row = await db.queryOne(
    `SELECT id, user_id, purpose, target_email, code_hash, attempts, max_attempts, expires_at, used_at
       FROM email_verification_codes
      WHERE challenge_token = ? AND purpose = 'register'
      LIMIT 1`,
    [challengeToken]
  );

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    throw AppError.unauthorized('Código de verificação expirado ou inválido. Solicite um novo código.');
  }

  if (Number(row.attempts) >= Number(row.max_attempts)) {
    await db.query('UPDATE email_verification_codes SET used_at = NOW() WHERE id = ?', [row.id]);
    throw AppError.unauthorized('Limite de tentativas excedido. Solicite um novo código ou faça login.');
  }

  const expectedHash = hashToken(code);
  const expBuf = Buffer.from(expectedHash, 'hex');
  const actBuf = Buffer.from(row.code_hash, 'hex');
  const isMatch = expBuf.length === actBuf.length && crypto.timingSafeEqual(expBuf, actBuf);

  if (!isMatch) {
    const nextAttempts = Number(row.attempts) + 1;
    await db.query('UPDATE email_verification_codes SET attempts = ? WHERE id = ?', [nextAttempts, row.id]);
    if (nextAttempts >= Number(row.max_attempts)) {
      await db.query('UPDATE email_verification_codes SET used_at = NOW() WHERE id = ?', [row.id]);
      throw AppError.unauthorized('Código incorreto. Limite de tentativas excedido.');
    }
    const remaining = Number(row.max_attempts) - nextAttempts;
    throw AppError.unauthorized(`Código incorreto. Você tem mais ${remaining} tentativa(s).`);
  }

  await db.query('UPDATE email_verification_codes SET used_at = NOW() WHERE id = ?', [row.id]);
  await db.query('UPDATE users SET email_verified_at = NOW() WHERE id = ?', [row.user_id]);

  const user = await db.queryOne('SELECT id, name, email FROM users WHERE id = ? LIMIT 1', [row.user_id]);
  if (user) {
    const loginUrl = `${env.frontendUrl}/index.html`;
    const renderWelcomeTemplate = require('./emailTemplates/welcomeTemplate');
    const { html, text } = renderWelcomeTemplate({ name: user.name, loginUrl });

    notificationOutboxService.sendImmediateTransactional({
      organizationId: null,
      category: 'transactional',
      recipientUserId: user.id,
      recipientEmail: user.email,
      recipientName: user.name,
      subject: 'Bem-vindo ao EvoTech Events — Conta Verificada',
      htmlBody: html,
      textBody: text,
      idempotencyKey: `welcome_${user.id}`,
    }).catch(err => logger.error('[Auth] Erro ao enviar boas-vindas:', err.message));

    inAppNotificationService.createNotification({
      category: 'account',
      severity: 'info',
      title: 'E-mail de participante verificado',
      message: `${user.name} (${emailService.maskEmail(user.email)}) confirmou o e-mail e ativou a conta.`,
      metadata: { userId: user.id, ipAddress },
    }).catch(err => logger.error('[Auth] Erro ao registrar notificação de verificação:', err.message));
  }

  return issueTokens(row.user_id);
}

async function resendVerificationCode({ challengeToken, ipAddress = null }) {
  if (!challengeToken) {
    throw AppError.badRequest('Token de verificação obrigatório.');
  }

  const row = await db.queryOne(
    `SELECT id, user_id, purpose, target_email, resend_available_at, expires_at, used_at
       FROM email_verification_codes
      WHERE challenge_token = ? AND purpose = 'register'
      LIMIT 1`,
    [challengeToken]
  );

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    throw AppError.unauthorized('Sessão de verificação expirada. Faça login ou cadastre-se novamente.');
  }

  if (new Date(row.resend_available_at) > new Date()) {
    const waitSeconds = Math.max(1, Math.ceil((new Date(row.resend_available_at).getTime() - Date.now()) / 1000));
    throw AppError.badRequest(`Aguarde ${waitSeconds} segundos antes de solicitar um novo código.`);
  }

  const user = await db.queryOne('SELECT id, name, email FROM users WHERE id = ? LIMIT 1', [row.user_id]);
  if (!user) throw AppError.unauthorized('Usuário não encontrado.');

  const newCode = String(crypto.randomInt(100000, 1000000));
  const newCodeHash = hashToken(newCode);

  await db.query(
    `UPDATE email_verification_codes
        SET code_hash = ?,
            attempts = 0,
            expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE),
            resend_available_at = DATE_ADD(NOW(), INTERVAL 60 SECOND),
            ip_address = ?
      WHERE id = ?`,
    [newCodeHash, ipAddress, row.id]
  );

  const renderEmailVerificationTemplate = require('./emailTemplates/emailVerificationTemplate');
  const { html, text } = renderEmailVerificationTemplate({ name: user.name, code: newCode, expiresMinutes: 15 });

  const sendResult = await notificationOutboxService.sendImmediateTransactional({
    organizationId: null,
    category: 'transactional',
    recipientUserId: user.id,
    recipientEmail: row.target_email,
    recipientName: user.name,
    subject: `Novo Código de Verificação: ${newCode} — EvoTech Events`,
    htmlBody: html,
    textBody: text,
    idempotencyKey: `email_verify_resend_${Date.now()}_${user.id}`,
  });

  if (!sendResult || !sendResult.success) {
    throw new AppError(
      'Não foi possível enviar o código de verificação por e-mail no momento. Tente novamente em instantes.',
      503,
      'EMAIL_DELIVERY_FAILED'
    );
  }

  return {
    success: true,
    message: `Novo código enviado com sucesso para ${emailService.maskEmail(row.target_email)}.`,
    expiresInSeconds: 900,
  };
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

  let user;
  try {
    user = await db.queryOne(
      'SELECT id, name, email, password_hash, status, email_verified_at FROM users WHERE email = ? LIMIT 1', [email]
    );
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      user = await db.queryOne(
        'SELECT id, name, email, password_hash, status FROM users WHERE email = ? LIMIT 1', [email]
      );
    } else {
      throw err;
    }
  }
  // Mensagem única para e-mail inexistente e senha errada (não revela cadastro).
  if (!user) {
    recordFailedLogin(attemptKey);
    throw AppError.unauthorized('E-mail ou senha incorretos.');
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    recordFailedLogin(attemptKey);
    const rec = loginAttempts.get(attemptKey);
    if (rec && rec.count >= 3) {
      const sess = await buildSession(user.id).catch(() => null);
      inAppNotificationService.createNotification({
        organizationId: sess ? sess.organizationId : null,
        category: 'account',
        severity: rec.count >= MAX_LOGIN_ATTEMPTS ? 'critical' : 'warning',
        title: rec.count >= MAX_LOGIN_ATTEMPTS ? 'Conta bloqueada temporariamente por tentativas incorretas' : 'Tentativas de login malsucedidas',
        message: `Foram registradas ${rec.count} tentativas incorretas de senha para ${emailService.maskEmail(user.email)}.`,
        metadata: { userId: user.id, ipAddress, attempts: rec.count },
      }).catch(() => {});
    }
    throw AppError.unauthorized('E-mail ou senha incorretos.');
  }
  if (user.status === 'blocked') throw AppError.forbidden('Conta bloqueada. Fale com o organizador.');

  // Sucesso: limpa falhas registradas
  clearFailedLogin(attemptKey);

  // Se o e-mail ainda não foi verificado (contas criadas após migration 010), exige confirmação antes de prosseguir
  if (user.email_verified_at === null) {
    const challenge = await createEmailVerificationChallenge({
      userId: user.id,
      userName: user.name,
      targetEmail: user.email,
      purpose: 'register',
      ipAddress,
      userAgent,
    });
    return {
      requiresEmailVerification: true,
      ...challenge,
    };
  }

  const session = await buildSession(user.id);

  // DESAFIO 2FA / CÓDIGO DE SEGURANÇA POR E-MAIL PARA TODOS OS USUÁRIOS (ADMINS E PARTICIPANTES)
  const challengeToken = crypto.randomBytes(32).toString('hex');
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashToken(code);

  // Invalida desafios anteriores não utilizados deste usuário
  await db.query(
    'UPDATE admin_login_codes SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
    [user.id]
  );

  // Armazena o código de verificação com expiração de 10 min e reenvio em 60s
  await db.query(
    `INSERT INTO admin_login_codes (
      user_id, challenge_token, code_hash, expires_at, resend_available_at, ip_address, user_agent
    ) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 60 SECOND), ?, ?)`,
    [user.id, challengeToken, codeHash, ipAddress || null, userAgent || null]
  );

  let html;
  let text;
  let subject;
  if (session.role === 'admin') {
    const renderAdminLoginCodeTemplate = require('./emailTemplates/adminLoginCodeTemplate');
    ({ html, text } = renderAdminLoginCodeTemplate({
      name: user.name,
      code,
      expiresMinutes: 10,
      ipAddress,
    }));
    subject = `Código de Acesso Administrativo: ${code} — EvoTech Events`;
  } else {
    const renderLoginCodeTemplate = require('./emailTemplates/loginCodeTemplate');
    ({ html, text } = renderLoginCodeTemplate({
      name: user.name,
      code,
      expiresMinutes: 10,
      ipAddress,
      userAgent,
    }));
    subject = `Código de Segurança para Login: ${code} — EvoTech Events`;
  }

  const sendResult = await notificationOutboxService.sendImmediateTransactional({
    organizationId: session.organizationId,
    category: 'transactional',
    recipientUserId: user.id,
    recipientEmail: user.email,
    recipientName: user.name,
    subject,
    htmlBody: html,
    textBody: text,
    idempotencyKey: `login_2fa_${challengeToken}`,
  }).catch(err => ({ success: false, error: err.message }));

  inAppNotificationService.createNotification({
    organizationId: session.organizationId,
    category: 'account',
    severity: session.role === 'admin' ? 'warning' : 'info',
    title: session.role === 'admin' ? 'Desafio 2FA de Login Administrativo' : 'Código de verificação de login emitido',
    message: `Código de acesso emitido para ${user.name} (${emailService.maskEmail(user.email)}).`,
    metadata: { userId: user.id, role: session.role, ipAddress, emailSent: Boolean(sendResult?.success) },
  }).catch(err => logger.error('[Auth] Erro ao registrar alerta 2FA:', err.message));

  return {
    requires2FA: true,
    role: session.role,
    challengeToken,
    emailMasked: emailService.maskEmail(user.email),
    expiresInSeconds: 600,
    emailDeliveryFailed: !sendResult || !sendResult.success,
    deliveryError: sendResult && sendResult.success ? null : (sendResult?.error || 'Não foi possível enviar o código por e-mail.'),
  };
}

/**
 * Valida o código 2FA enviado por e-mail e libera a sessão (admin ou participante)
 */
async function verifyLoginCode({ challengeToken, code, ipAddress = null, userAgent = null }) {
  if (!challengeToken || !code) {
    throw AppError.badRequest('Token de desafio e código de 6 dígitos são obrigatórios.');
  }

  const row = await db.queryOne(
    `SELECT id, user_id, code_hash, attempts, max_attempts, expires_at, used_at, ip_address, user_agent
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
    const sess = await buildSession(row.user_id).catch(() => null);
    await inAppNotificationService.createNotification({
      organizationId: sess ? sess.organizationId : null,
      category: 'account',
      severity: 'critical',
      title: 'Tentativa suspeita de acesso bloqueada',
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

  // Verifica se houve login em novo IP/dispositivo
  const prevLogin = await db.queryOne(
    `SELECT ip_address, user_agent FROM admin_login_codes
      WHERE user_id = ? AND used_at IS NOT NULL AND id != ?
      ORDER BY id DESC LIMIT 1`,
    [row.user_id, row.id]
  ).catch(() => null);

  const effectiveIp = ipAddress || row.ip_address || 'Não identificado';
  const effectiveUa = userAgent || row.user_agent || 'Navegador não identificado';
  const isNewDevice = Boolean(prevLogin && prevLogin.ip_address && ipAddress && prevLogin.ip_address !== ipAddress);

  // Notificação de segurança de login realizado (sem códigos ou tokens)
  const renderSecurityAlertTemplate = require('./emailTemplates/securityAlertTemplate');
  const { html, text } = renderSecurityAlertTemplate({
    name: session.nome,
    badge: isNewDevice ? 'Novo Acesso Detectado' : 'Login Realizado',
    severity: isNewDevice ? 'warning' : 'info',
    heading: isNewDevice ? 'Novo acesso detectado em sua conta' : 'Login concluído com sucesso',
    message: isNewDevice
      ? 'Detectamos um login na sua conta EvoTech Events a partir de um novo endereço de rede ou dispositivo.'
      : 'Um novo acesso à sua conta EvoTech Events foi concluído após a verificação por código.',
    details: [
      { label: 'Perfil', value: session.role === 'admin' ? 'Administrador' : 'Participante' },
      { label: 'Endereço IP', value: effectiveIp },
      { label: 'Dispositivo', value: String(effectiveUa).slice(0, 80) },
      { label: 'Data/Hora', value: new Date().toLocaleString('pt-BR') },
    ],
  });

  notificationOutboxService.sendImmediateTransactional({
    organizationId: session.organizationId,
    category: 'transactional',
    recipientUserId: row.user_id,
    recipientEmail: session.email,
    recipientName: session.nome,
    subject: isNewDevice ? 'Segurança: Novo acesso detectado — EvoTech Events' : 'Notificação de Login — EvoTech Events',
    htmlBody: html,
    textBody: text,
    idempotencyKey: `login_alert_${row.id}`,
  }).catch(err => logger.error('[Auth] Erro ao enviar alerta de login:', err.message));

  await inAppNotificationService.createNotification({
    organizationId: session.organizationId,
    category: 'account',
    severity: isNewDevice ? 'warning' : 'info',
    title: session.role === 'admin' ? 'Acesso administrativo autorizado (2FA)' : 'Login de participante verificado',
    message: `${session.nome} concluiu verificação de login com sucesso${isNewDevice ? ' (novo IP detectado)' : ''}.`,
    metadata: { userId: row.user_id, ipAddress: effectiveIp, isNewDevice },
  });

  return issueTokens(row.user_id);
}

/**
 * Reenvia o código 2FA/login com respeito ao intervalo mínimo de 60 segundos
 */
async function resendLoginCode({ challengeToken, ipAddress = null, userAgent = null }) {
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

  // Gera novo código e atualiza o desafio existente (preserva UNIQUE challenge_token)
  const newCode = String(crypto.randomInt(100000, 1000000));
  const newCodeHash = hashToken(newCode);

  await db.query(
    `UPDATE admin_login_codes
        SET code_hash = ?,
            attempts = 0,
            expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
            resend_available_at = DATE_ADD(NOW(), INTERVAL 60 SECOND),
            ip_address = ?,
            user_agent = ?
      WHERE id = ?`,
    [newCodeHash, ipAddress, userAgent, row.id]
  );

  let html;
  let text;
  let subject;
  if (session.role === 'admin') {
    const renderAdminLoginCodeTemplate = require('./emailTemplates/adminLoginCodeTemplate');
    ({ html, text } = renderAdminLoginCodeTemplate({
      name: user.name,
      code: newCode,
      expiresMinutes: 10,
      ipAddress,
    }));
    subject = `Novo Código de Acesso Administrativo: ${newCode} — EvoTech Events`;
  } else {
    const renderLoginCodeTemplate = require('./emailTemplates/loginCodeTemplate');
    ({ html, text } = renderLoginCodeTemplate({
      name: user.name,
      code: newCode,
      expiresMinutes: 10,
      ipAddress,
      userAgent,
    }));
    subject = `Novo Código de Login: ${newCode} — EvoTech Events`;
  }

  const sendResult = await notificationOutboxService.sendImmediateTransactional({
    organizationId: session.organizationId,
    category: 'transactional',
    recipientUserId: user.id,
    recipientEmail: user.email,
    recipientName: user.name,
    subject,
    htmlBody: html,
    textBody: text,
    idempotencyKey: `login_2fa_resend_${Date.now()}_${user.id}`,
  });

  if (!sendResult || !sendResult.success) {
    throw new AppError(
      'Não foi possível enviar o código de segurança por e-mail no momento. Tente novamente em instantes.',
      503,
      'EMAIL_DELIVERY_FAILED'
    );
  }

  return {
    success: true,
    message: `Novo código enviado com sucesso para ${emailService.maskEmail(user.email)}.`,
    expiresInSeconds: 600,
  };
}

const verifyAdminCode = verifyLoginCode;
const resendAdminCode = resendLoginCode;

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

async function updateMe(userId, data, { ipAddress = null } = {}) {
  const user = await db.queryOne('SELECT id, name, email, cpf, phone, birth_date, password_hash FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!user) throw AppError.unauthorized('Usuário não encontrado.');

  const session = await buildSession(userId);
  let passwordChanged = false;
  const changedFields = [];

  if (data.newPassword) {
    const match = await bcrypt.compare(data.currentPassword || '', user.password_hash);
    if (!match) throw AppError.badRequest('Senha atual incorreta.');
    const hash = await bcrypt.hash(data.newPassword, env.bcryptRounds);
    await db.query('UPDATE users SET password_hash = ?, tokens_valid_after = NOW() WHERE id = ?', [hash, userId])
      .catch(async (err) => {
        if (err.code === 'ER_BAD_FIELD_ERROR') {
          await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
        } else {
          throw err;
        }
      });
    await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
    passwordChanged = true;
    changedFields.push('Senha');
  }

  const fields = [];
  const params = [];
  if (data.name && data.name !== user.name) {
    fields.push('name = ?');
    params.push(data.name);
    changedFields.push('Nome');
  }
  if (data.phone !== undefined && data.phone !== user.phone) {
    fields.push('phone = ?');
    params.push(data.phone || null);
    changedFields.push('Telefone');
  }
  if (data.birthDate && data.birthDate !== user.birth_date) {
    fields.push('birth_date = ?');
    params.push(data.birthDate);
    changedFields.push('Data de nascimento');
  }
  if (data.avatarUrl !== undefined) {
    fields.push('avatar_url = ?');
    params.push(data.avatarUrl || null);
    changedFields.push('Foto de perfil');
  }
  if (data.cpf && data.cpf !== user.cpf) {
    // Se já tinha CPF cadastrado, exige reautenticação por senha atual
    if (user.cpf) {
      const match = await bcrypt.compare(data.currentPassword || '', user.password_hash);
      if (!match) throw AppError.badRequest('Informe sua senha atual para alterar o CPF cadastrado.');
    }
    const cpfTaken = await db.queryOne('SELECT id FROM users WHERE cpf = ? AND id != ? LIMIT 1', [data.cpf, userId]);
    if (cpfTaken) throw AppError.conflict('CPF já cadastrado em outra conta.');
    fields.push('cpf = ?');
    params.push(data.cpf);
    changedFields.push('CPF');
  }

  if (fields.length) {
    params.push(userId);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  if (passwordChanged) {
    const renderPasswordChangedTemplate = require('./emailTemplates/passwordChangedTemplate');
    const { html, text } = renderPasswordChangedTemplate({ name: data.name || user.name, timestamp: Date.now() });
    await notificationOutboxService.sendImmediateTransactional({
      organizationId: session.organizationId,
      category: 'transactional',
      recipientUserId: userId,
      recipientEmail: user.email,
      recipientName: data.name || user.name,
      subject: 'Segurança: Sua senha foi alterada — EvoTech Events',
      htmlBody: html,
      textBody: text,
      idempotencyKey: `pwd_changed_me_${userId}_${Date.now()}`,
    }).catch(err => logger.error('[Auth] Falha ao enfileirar aviso de alteração de senha:', err.message));
  } else if (changedFields.length > 0) {
    const renderSecurityAlertTemplate = require('./emailTemplates/securityAlertTemplate');
    const { html, text } = renderSecurityAlertTemplate({
      name: data.name || user.name,
      badge: 'Atualização de Perfil',
      severity: 'info',
      heading: 'Dados do seu perfil foram atualizados',
      message: 'As informações da sua conta no EvoTech Events foram alteradas.',
      details: [
        { label: 'Campos alterados', value: changedFields.join(', ') },
        ...(ipAddress ? [{ label: 'Endereço IP', value: ipAddress }] : []),
        { label: 'Data/Hora', value: new Date().toLocaleString('pt-BR') },
      ],
    });
    notificationOutboxService.sendImmediateTransactional({
      organizationId: session.organizationId,
      category: 'transactional',
      recipientUserId: userId,
      recipientEmail: user.email,
      recipientName: data.name || user.name,
      subject: 'Segurança: Alteração de dados do perfil — EvoTech Events',
      htmlBody: html,
      textBody: text,
      idempotencyKey: `profile_changed_${userId}_${Date.now()}`,
    }).catch(err => logger.error('[Auth] Erro ao notificar alteração de perfil:', err.message));
  }

  if (changedFields.length > 0) {
    inAppNotificationService.createNotification({
      organizationId: session.organizationId,
      category: 'account',
      severity: passwordChanged ? 'warning' : 'info',
      title: passwordChanged ? 'Senha alterada pelo usuário' : 'Alteração de dados de perfil',
      message: `${user.name} (${emailService.maskEmail(user.email)}) atualizou: ${changedFields.join(', ')}.`,
      metadata: { userId, changedFields, ipAddress },
    }).catch(() => {});
  }

  return buildSession(userId);
}

async function changePassword(userId, { currentPassword, newPassword }, { ipAddress = null } = {}) {
  await updateMe(userId, { currentPassword, newPassword }, { ipAddress });
  const tokens = await issueTokens(userId);
  return {
    ...tokens,
    message: 'Senha alterada com sucesso. Sessões anteriores foram encerradas.',
  };
}

async function requestEmailChange(userId, { newEmail, currentPassword }, { ipAddress = null, userAgent = null } = {}) {
  const user = await db.queryOne('SELECT id, name, email, password_hash FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!user) throw AppError.unauthorized('Usuário não encontrado.');

  const match = await bcrypt.compare(currentPassword || '', user.password_hash);
  if (!match) throw AppError.badRequest('Senha atual incorreta.');

  if (newEmail.toLowerCase() === user.email.toLowerCase()) {
    throw AppError.badRequest('O novo e-mail deve ser diferente do e-mail atual.');
  }

  const exists = await db.queryOne('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [newEmail, userId]);
  if (exists) throw AppError.conflict('Este e-mail já está em uso por outra conta.');

  const challenge = await createEmailVerificationChallenge({
    userId,
    userName: user.name,
    targetEmail: newEmail,
    purpose: 'email_change',
    ipAddress,
    userAgent,
  });

  if (challenge.emailDeliveryFailed) {
    throw new AppError(
      'Não foi possível enviar o código de confirmação para o novo e-mail. Tente novamente em instantes.',
      503,
      'EMAIL_DELIVERY_FAILED'
    );
  }

  return challenge;
}

async function confirmEmailChange(userId, { challengeToken, code }, { ipAddress = null } = {}) {
  if (!challengeToken || !code) {
    throw AppError.badRequest('Token de verificação e código de 6 dígitos são obrigatórios.');
  }

  const row = await db.queryOne(
    `SELECT id, user_id, target_email, code_hash, attempts, max_attempts, expires_at, used_at
       FROM email_verification_codes
      WHERE challenge_token = ? AND user_id = ? AND purpose = 'email_change'
      LIMIT 1`,
    [challengeToken, userId]
  );

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    throw AppError.unauthorized('Código de confirmação expirado ou inválido.');
  }

  if (Number(row.attempts) >= Number(row.max_attempts)) {
    await db.query('UPDATE email_verification_codes SET used_at = NOW() WHERE id = ?', [row.id]);
    throw AppError.unauthorized('Limite de tentativas excedido. Solicite a alteração novamente.');
  }

  const expectedHash = hashToken(code);
  const expBuf = Buffer.from(expectedHash, 'hex');
  const actBuf = Buffer.from(row.code_hash, 'hex');
  const isMatch = expBuf.length === actBuf.length && crypto.timingSafeEqual(expBuf, actBuf);

  if (!isMatch) {
    const nextAttempts = Number(row.attempts) + 1;
    await db.query('UPDATE email_verification_codes SET attempts = ? WHERE id = ?', [nextAttempts, row.id]);
    if (nextAttempts >= Number(row.max_attempts)) {
      await db.query('UPDATE email_verification_codes SET used_at = NOW() WHERE id = ?', [row.id]);
      throw AppError.unauthorized('Código incorreto. Limite de tentativas excedido.');
    }
    const remaining = Number(row.max_attempts) - nextAttempts;
    throw AppError.unauthorized(`Código incorreto. Você tem mais ${remaining} tentativa(s).`);
  }

  let oldEmail = null;
  let userName = null;
  const newEmail = row.target_email;

  await db.transaction(async (conn) => {
    const [takenRows] = await conn.execute('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [newEmail, userId]);
    if (takenRows.length > 0) {
      throw AppError.conflict('Este e-mail já foi vinculado a outra conta.');
    }
    const [uRows] = await conn.execute('SELECT name, email FROM users WHERE id = ? LIMIT 1 FOR UPDATE', [userId]);
    if (!uRows.length) throw AppError.unauthorized('Usuário não encontrado.');
    oldEmail = uRows[0].email;
    userName = uRows[0].name;

    await conn.execute(
      'UPDATE users SET email = ?, email_verified_at = NOW(), tokens_valid_after = NOW() WHERE id = ?',
      [newEmail, userId]
    );
    await conn.execute('UPDATE email_verification_codes SET used_at = NOW() WHERE id = ?', [row.id]);
    await conn.execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
  });

  const session = await buildSession(userId);
  const renderSecurityAlertTemplate = require('./emailTemplates/securityAlertTemplate');

  // Notifica o endereço ANTERIOR
  if (oldEmail) {
    const oldAlert = renderSecurityAlertTemplate({
      name: userName,
      badge: 'E-mail Alterado',
      severity: 'warning',
      heading: 'O e-mail da sua conta foi alterado',
      message: `O endereço de e-mail principal da sua conta foi alterado para ${emailService.maskEmail(newEmail)}.`,
      details: [
        { label: 'Novo e-mail', value: emailService.maskEmail(newEmail) },
        ...(ipAddress ? [{ label: 'Endereço IP', value: ipAddress }] : []),
        { label: 'Data/Hora', value: new Date().toLocaleString('pt-BR') },
      ],
      recommendation: 'Se você não autorizou esta alteração, entre em contato com o suporte imediatamente.',
    });
    notificationOutboxService.sendImmediateTransactional({
      organizationId: session.organizationId,
      category: 'transactional',
      recipientUserId: userId,
      recipientEmail: oldEmail,
      recipientName: userName,
      subject: 'Segurança: E-mail da conta alterado — EvoTech Events',
      htmlBody: oldAlert.html,
      textBody: oldAlert.text,
      idempotencyKey: `email_changed_old_${row.id}`,
    }).catch(() => {});
  }

  // Notifica o NOVO endereço
  const newAlert = renderSecurityAlertTemplate({
    name: userName,
    badge: 'E-mail Confirmado',
    severity: 'info',
    heading: 'Novo e-mail vinculado com sucesso',
    message: 'Este endereço agora é o e-mail principal da sua conta EvoTech Events. Sessões anteriores foram encerradas por segurança.',
    details: [
      { label: 'E-mail principal', value: newEmail },
      { label: 'Data/Hora', value: new Date().toLocaleString('pt-BR') },
    ],
  });
  notificationOutboxService.sendImmediateTransactional({
    organizationId: session.organizationId,
    category: 'transactional',
    recipientUserId: userId,
    recipientEmail: newEmail,
    recipientName: userName,
    subject: 'Novo e-mail confirmado — EvoTech Events',
    htmlBody: newAlert.html,
    textBody: newAlert.text,
    idempotencyKey: `email_changed_new_${row.id}`,
  }).catch(() => {});

  inAppNotificationService.createNotification({
    organizationId: session.organizationId,
    category: 'account',
    severity: 'warning',
    title: 'Alteração de e-mail concluída',
    message: `${userName} alterou o e-mail de ${emailService.maskEmail(oldEmail)} para ${emailService.maskEmail(newEmail)}.`,
    metadata: { userId, ipAddress },
  }).catch(() => {});

  const tokens = await issueTokens(userId);
  return {
    ...tokens,
    message: 'E-mail alterado e confirmado com sucesso.',
  };
}

async function revokeAllSessions(userId, currentPassword, { ipAddress = null } = {}) {
  const user = await db.queryOne('SELECT id, name, email, password_hash FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!user) throw AppError.unauthorized('Usuário não encontrado.');

  const match = await bcrypt.compare(currentPassword || '', user.password_hash);
  if (!match) throw AppError.badRequest('Senha atual incorreta.');

  await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
  await db.query('UPDATE users SET tokens_valid_after = NOW() WHERE id = ?', [userId]).catch(() => {});

  const session = await buildSession(userId);
  const renderSecurityAlertTemplate = require('./emailTemplates/securityAlertTemplate');
  const { html, text } = renderSecurityAlertTemplate({
    name: user.name,
    badge: 'Sessões Encerradas',
    severity: 'warning',
    heading: 'Todas as sessões ativas foram revogadas',
    message: 'Todas as sessões e dispositivos conectados à sua conta EvoTech Events foram encerrados.',
    details: [
      ...(ipAddress ? [{ label: 'Endereço IP', value: ipAddress }] : []),
      { label: 'Data/Hora', value: new Date().toLocaleString('pt-BR') },
    ],
  });

  notificationOutboxService.sendImmediateTransactional({
    organizationId: session.organizationId,
    category: 'transactional',
    recipientUserId: userId,
    recipientEmail: user.email,
    recipientName: user.name,
    subject: 'Segurança: Sessões encerradas — EvoTech Events',
    htmlBody: html,
    textBody: text,
    idempotencyKey: `sessions_revoked_${userId}_${Date.now()}`,
  }).catch(() => {});

  inAppNotificationService.createNotification({
    organizationId: session.organizationId,
    category: 'account',
    severity: 'warning',
    title: 'Revogação manual de sessões',
    message: `${user.name} (${emailService.maskEmail(user.email)}) encerrou todas as sessões ativas.`,
    metadata: { userId, ipAddress },
  }).catch(() => {});

  const tokens = await issueTokens(userId);
  return {
    ...tokens,
    message: 'Todas as outras sessões foram encerradas com segurança.',
  };
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

    // 1. Altera a senha e revoga tokens JWT anteriores
    await conn.execute(
      'UPDATE users SET password_hash = ?, tokens_valid_after = NOW() WHERE id = ?',
      [passwordHash, row.user_id]
    ).catch(async (err) => {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, row.user_id]);
      } else {
        throw err;
      }
    });

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
  register, verifyEmail, resendVerificationCode,
  login, verifyLoginCode, resendLoginCode,
  verifyAdminCode, resendAdminCode,
  refresh, logout, updateMe, changePassword,
  requestEmailChange, confirmEmailChange, revokeAllSessions,
  forgotPassword, resetPassword,
  buildSession, myTickets, myHistory, myOrders, myOrderDetails,
};
