'use strict';
/* ============================================================
   BOOTSTRAP DO PRIMEIRO ADMINISTRADOR — OffCampusSystem

   Cria exatamente UM usuário `platform_admin`. Nada mais.
   Não cria organizações, eventos, produtos, pedidos, ingressos
   nem qualquer dado de demonstração. Não executa seed.

   Salvaguardas:
   - Recusa se já existir qualquer platform_admin.
   - Recusa se o e-mail já pertencer a outro usuário.
   - Exige senha forte (mesma política do resto do sistema).
   - Marca o e-mail como verificado apenas porque o operador
     provou controle do ambiente ao rodar este script; o admin
     ainda assim deve trocar a senha no primeiro acesso.
   - Não imprime a senha em nenhum momento.

   Uso (interativo, recomendado — nada fica no histórico do shell):
     npm run admin:create

   Uso (não interativo, para CI/Railway one-off):
     BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... npm run admin:create

   DEPOIS DE CRIAR: remova BOOTSTRAP_ADMIN_EMAIL e
   BOOTSTRAP_ADMIN_PASSWORD das variáveis de ambiente.
   ============================================================ */

const readline = require('readline');
const db = require('../config/db');
const env = require('../config/env');
const password = require('../utils/password');
const audit = require('../middlewares/audit');

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  if (!hidden) {
    return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
  }

  // Entrada oculta: intercepta a escrita no terminal para não ecoar a senha.
  return new Promise(resolve => {
    const onData = (char) => {
      if (['\n', '\r', '\u0004'].includes(String(char))) {
        process.stdin.removeListener('data', onData);
      } else {
        process.stdout.write('\x1B[2K\x1B[200D' + question + '*'.repeat(rl.line.length));
      }
    };
    process.stdin.on('data', onData);
    rl.question(question, answer => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

function fail(message, detail) {
  console.error(`\n[bootstrap] ${message}`);
  if (detail) console.error(`            ${detail}`);
  console.error('');
  process.exit(1);
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  OffCampus — criação do primeiro administrador         ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`Banco: ${env.db.database}@${env.db.host}\n`);

  await db.healthCheck().catch(() => fail('Não foi possível conectar ao banco.'));

  const existingAdmin = await db.queryOne(
    `SELECT id, email, created_at FROM users WHERE role = 'platform_admin' LIMIT 1`
  );
  if (existingAdmin) {
    fail(
      'Já existe um administrador de plataforma. Nada foi criado.',
      `Conta existente: ${existingAdmin.email} (criada em ${existingAdmin.created_at}).`
    );
  }

  const interactive = !env.bootstrap.adminEmail || !env.bootstrap.adminPassword;

  let name;
  let email = env.bootstrap.adminEmail;
  let plain = env.bootstrap.adminPassword;

  if (interactive) {
    if (!process.stdin.isTTY) {
      fail(
        'Sem terminal interativo e sem variáveis de bootstrap definidas.',
        'Defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD, ou rode em um terminal.'
      );
    }
    name = await ask('Nome completo do administrador: ');
    email = (await ask('E-mail: ')).toLowerCase();
    plain = await ask('Senha: ', { hidden: true });
    const confirm = await ask('Confirme a senha: ', { hidden: true });
    if (plain !== confirm) fail('As senhas não conferem. Nada foi criado.');
  } else {
    name = process.env.BOOTSTRAP_ADMIN_NAME || 'Administrador';
    email = String(email).toLowerCase();
    console.log('[bootstrap] Usando BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD do ambiente.');
  }

  if (!name || name.length < 3) fail('Nome inválido (mínimo 3 caracteres).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('E-mail inválido.');

  const issues = password.validate(plain, { email, name });
  if (issues.length) {
    fail('Senha recusada pela política de segurança:', issues.join('\n            '));
  }

  const emailTaken = await db.queryOne('SELECT id, role FROM users WHERE email = ? LIMIT 1', [email]);
  if (emailTaken) {
    fail(
      'Este e-mail já pertence a um usuário existente. Nada foi criado.',
      'Para promover uma conta existente, faça isso manualmente e de forma auditada.'
    );
  }

  const hash = await password.hash(plain);
  plain = null;   // não mantém a senha em memória além do necessário

  const result = await db.query(
    `INSERT INTO users
       (name, email, password_hash, role, status, email_verified_at, password_changed_at)
     VALUES (?, ?, ?, 'platform_admin', 'active', NOW(), NOW())`,
    [name, email, hash]
  );

  await audit.record({
    action: audit.ACTIONS.ADMIN_BOOTSTRAP,
    userId: result.insertId,
    userName: name,
    entity: 'user',
    entityId: result.insertId,
    metadata: { via: interactive ? 'interativo' : 'variaveis_de_ambiente' },
  });

  console.log('\n────────────────────────────────────────────────────────');
  console.log('  Administrador criado.');
  console.log(`  id:    ${result.insertId}`);
  console.log(`  email: ${email}`);
  console.log('  e-mail marcado como verificado; nenhum outro dado foi criado.');
  console.log('────────────────────────────────────────────────────────');
  console.log('\n  PRÓXIMOS PASSOS OBRIGATÓRIOS:');
  console.log('  1. Remova BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD');
  console.log('     das variáveis de ambiente do Railway agora.');
  console.log('  2. Entre no sistema e troque a senha em Perfil → Alterar senha.');
  console.log('  3. Crie a organização pelo painel (não por script).\n');
}

main()
  .then(async () => { await db.pool.end(); process.exit(0); })
  .catch(async (err) => {
    console.error('\n[bootstrap] Falha:', err.message, '\n');
    try { await db.pool.end(); } catch { /* ignore */ }
    process.exit(1);
  });
