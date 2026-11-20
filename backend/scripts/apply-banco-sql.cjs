const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

async function applyBancoSql() {
  console.log('[BANCO.SQL] Iniciando aplicação idempotente e segura...');

  // 1. Verificar se o usuário gabrielperugorria681@gmail.com já existe
  let user = await db.queryOne('SELECT id, name, email, role, status FROM users WHERE email = ?', [
    'gabrielperugorria681@gmail.com',
  ]);

  if (!user) {
    console.log('[BANCO.SQL] Usuário gabrielperugorria681@gmail.com não encontrado. Criando...');
    const defaultPassword = process.env.INITIAL_OWNER_PASSWORD || process.argv[2] || 'OffCampus2026!';
    const hash = await bcrypt.hash(defaultPassword, 10);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES (?, ?, ?, 'user', 'active')`,
      ['Gabriel Perugorria', 'gabrielperugorria681@gmail.com', hash]
    );
    const userId = result.insertId;
    user = { id: userId, name: 'Gabriel Perugorria', email: 'gabrielperugorria681@gmail.com' };
    console.log(`[BANCO.SQL] Usuário criado com sucesso (ID: ${userId}).`);
  } else {
    console.log(`[BANCO.SQL] Usuário já existente (ID: ${user.id}).`);
  }

  // 2. Localizar ou criar a organização OffCampus de forma idempotente
  let org = await db.queryOne(
    "SELECT id, name, slug, owner_user_id FROM organizations WHERE slug = 'offcampus' OR slug = 'OffCampus' LIMIT 1"
  );

  if (!org) {
    console.log('[BANCO.SQL] Organização OffCampus não encontrada. Inserindo...');
    const orgResult = await db.query(
      `INSERT INTO organizations (name, slug, owner_user_id)
       VALUES ('OffCampus', 'offcampus', ?)`,
      [user.id]
    );
    org = { id: orgResult.insertId, name: 'OffCampus', slug: 'offcampus', owner_user_id: user.id };
    console.log(`[BANCO.SQL] Organização criada com sucesso (ID: ${org.id}).`);
  } else {
    console.log(`[BANCO.SQL] Organização encontrada (ID: ${org.id}, Nome: ${org.name}).`);
    // Atualiza owner se não for o Gabriel
    if (org.owner_user_id !== user.id) {
      await db.query('UPDATE organizations SET owner_user_id = ? WHERE id = ?', [user.id, org.id]);
      console.log(`[BANCO.SQL] Organização ID ${org.id} atualizada com owner_user_id = ${user.id}.`);
    }
  }

  // 3. Inserir ou atualizar em organization_members com role 'owner' e status 'active'
  await db.query(
    `INSERT INTO organization_members (organization_id, user_id, role, status)
     VALUES (?, ?, 'owner', 'active')
     ON DUPLICATE KEY UPDATE role = 'owner', status = 'active'`,
    [org.id, user.id]
  );
  console.log(`[BANCO.SQL] Membro proprietário vinculado em organization_members.`);

  // 4. Executar consultas de conferência exatamente como definidas no banco.sql
  console.log('\n--- CONFERÊNCIA 1: Organização do Usuário ---');
  const orgCheck = await db.query(
    `SELECT
       o.id,
       o.name,
       o.slug,
       u.email
     FROM organizations o
     JOIN users u ON u.id = o.owner_user_id
     WHERE u.email = ?`,
    ['gabrielperugorria681@gmail.com']
  );
  console.table(orgCheck);

  console.log('\n--- CONFERÊNCIA 2: Membros e Produtoras ---');
  const membersCheck = await db.query(
    `SELECT
       u.name,
       u.email,
       o.name AS produtora,
       om.role,
       om.status
     FROM users u
     JOIN organization_members om ON om.user_id = u.id
     JOIN organizations o ON o.id = om.organization_id
     ORDER BY u.created_at DESC`
  );
  console.table(membersCheck);

  console.log('\n[BANCO.SQL] Todas as operações foram concluídas com sucesso!');
  process.exit(0);
}

applyBancoSql().catch((err) => {
  console.error('[BANCO.SQL ERRO FATAL]:', err);
  process.exit(1);
});
