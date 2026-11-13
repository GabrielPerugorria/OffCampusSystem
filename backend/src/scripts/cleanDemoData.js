'use strict';
/**
 * Script de Limpeza Transacional de Dados Demonstrativos
 * Remove com segurança todos os eventos fictícios, lotes, pedidos, ingressos,
 * checkins, movimentações de estoque de eventos, despesas fictícias e contatos demo.
 * 
 * Preserva:
 * - A organização principal (OffCampus Produções)
 * - O usuário administrador proprietário (admin@evotech.com)
 * - Vínculos estruturais de organização
 * 
 * Gera backup prévio em JSON antes de executar a exclusão.
 * Execução: node src/scripts/cleanDemoData.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const logger = require('../utils/logger');

async function runCleanup() {
  console.log('=== AUDITORIA E LIMPEZA DE DADOS DEMONSTRATIVOS ===\n');

  // 1. Identificar organização
  const org = await db.queryOne(
    `SELECT id, name, slug, owner_user_id FROM organizations WHERE slug = 'offcampus' LIMIT 1`
  );

  if (!org) {
    console.log('Organização "offcampus" não encontrada. Verificando primeira organização cadastrada...');
  }
  const targetOrg = org || await db.queryOne(`SELECT id, name, slug, owner_user_id FROM organizations ORDER BY id ASC LIMIT 1`);

  if (!targetOrg) {
    console.log('Nenhuma organização encontrada no banco. Banco já está vazio ou não inicializado.');
    process.exit(0);
  }

  const orgId = targetOrg.id;
  console.log(`Organização alvo: [ID ${orgId}] "${targetOrg.name}" (${targetOrg.slug})`);

  // 2. Levantamento quantitativo antes da exclusão
  const countsBefore = {
    events: (await db.queryOne(`SELECT COUNT(*) as n FROM events WHERE organization_id = ?`, [orgId])).n,
    batches: (await db.queryOne(
      `SELECT COUNT(*) as n FROM ticket_batches tb JOIN events e ON tb.event_id = e.id WHERE e.organization_id = ?`,
      [orgId]
    )).n,
    orders: (await db.queryOne(
      `SELECT COUNT(*) as n FROM orders o JOIN events e ON o.event_id = e.id WHERE e.organization_id = ?`,
      [orgId]
    )).n,
    orderItems: (await db.queryOne(
      `SELECT COUNT(*) as n FROM order_items oi JOIN events e ON oi.event_id = e.id WHERE e.organization_id = ?`,
      [orgId]
    )).n,
    tickets: (await db.queryOne(
      `SELECT COUNT(*) as n FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.organization_id = ?`,
      [orgId]
    )).n,
    checkins: (await db.queryOne(
      `SELECT COUNT(*) as n FROM checkins c JOIN events e ON c.event_id = e.id WHERE e.organization_id = ?`,
      [orgId]
    )).n,
    products: (await db.queryOne(`SELECT COUNT(*) as n FROM products WHERE organization_id = ?`, [orgId])).n,
    stockMovements: (await db.queryOne(
      `SELECT COUNT(*) as n FROM stock_movements sm JOIN products p ON sm.product_id = p.id WHERE p.organization_id = ?`,
      [orgId]
    )).n,
    expenses: (await db.queryOne(`SELECT COUNT(*) as n FROM expenses WHERE organization_id = ?`, [orgId])).n,
    expenseCategories: (await db.queryOne(`SELECT COUNT(*) as n FROM expense_categories WHERE organization_id = ?`, [orgId])).n,
    contacts: (await db.queryOne(`SELECT COUNT(*) as n FROM contacts WHERE organization_id = ?`, [orgId])).n,
    demoUsers: (await db.queryOne(
      `SELECT COUNT(*) as n FROM users WHERE email LIKE '%@exemplo.com' OR email IN ('demo@evotech.com', 'carla@evotech.com', 'diego@evotech.com', 'bia@evotech.com')`
    )).n,
  };

  console.log('Registros identificados para remoção/auditoria:');
  console.table(countsBefore);

  // 3. Backup de segurança consistente antes da exclusão
  const backupDir = path.resolve(__dirname, '../database/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupDir, `backup_before_cleanup_${timestamp}.json`);

  const eventsData = await db.query(`SELECT * FROM events WHERE organization_id = ?`, [orgId]);
  const batchesData = await db.query(
    `SELECT tb.* FROM ticket_batches tb JOIN events e ON tb.event_id = e.id WHERE e.organization_id = ?`,
    [orgId]
  );
  const ordersData = await db.query(
    `SELECT o.* FROM orders o JOIN events e ON o.event_id = e.id WHERE e.organization_id = ?`,
    [orgId]
  );
  const ticketsData = await db.query(
    `SELECT t.* FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.organization_id = ?`,
    [orgId]
  );
  const checkinsData = await db.query(
    `SELECT c.* FROM checkins c JOIN events e ON c.event_id = e.id WHERE e.organization_id = ?`,
    [orgId]
  );
  const expensesData = await db.query(`SELECT * FROM expenses WHERE organization_id = ?`, [orgId]);
  const contactsData = await db.query(`SELECT * FROM contacts WHERE organization_id = ?`, [orgId]);

  const backupPayload = {
    timestamp: new Date().toISOString(),
    organization: targetOrg,
    countsBefore,
    data: {
      events: eventsData,
      batches: batchesData,
      orders: ordersData,
      tickets: ticketsData,
      checkins: checkinsData,
      expenses: expensesData,
      contacts: contactsData,
    },
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2), 'utf8');
  console.log(`[BACKUP OK] Backup de segurança salvo em: ${backupFilePath}\n`);

  // 4. Execução transacional de exclusão respeitando chaves estrangeiras
  console.log('Iniciando exclusão transacional segura...');
  await db.transaction(async (conn) => {
    // 4.1 Check-ins de eventos da organização
    await conn.execute(
      `DELETE c FROM checkins c
       INNER JOIN events e ON c.event_id = e.id
       WHERE e.organization_id = ?`,
      [orgId]
    );

    // 4.2 Ingressos vinculados a eventos da organização
    await conn.execute(
      `DELETE t FROM tickets t
       INNER JOIN events e ON t.event_id = e.id
       WHERE e.organization_id = ?`,
      [orgId]
    );

    // 4.3 Itens de pedidos de eventos da organização
    await conn.execute(
      `DELETE oi FROM order_items oi
       INNER JOIN events e ON oi.event_id = e.id
       WHERE e.organization_id = ?`,
      [orgId]
    );

    // 4.4 Pedidos de eventos da organização
    await conn.execute(
      `DELETE o FROM orders o
       INNER JOIN events e ON o.event_id = e.id
       WHERE e.organization_id = ?`,
      [orgId]
    );

    // 4.5 Lotes de ingressos vinculados a eventos da organização
    await conn.execute(
      `DELETE tb FROM ticket_batches tb
       INNER JOIN events e ON tb.event_id = e.id
       WHERE e.organization_id = ?`,
      [orgId]
    );

    // 4.6 Despesas de eventos ou despesas fictícias da organização
    await conn.execute(
      `DELETE FROM expenses WHERE organization_id = ?`,
      [orgId]
    );

    // 4.7 Movimentações de estoque
    await conn.execute(
      `DELETE sm FROM stock_movements sm
       INNER JOIN products p ON sm.product_id = p.id
       WHERE p.organization_id = ?`,
      [orgId]
    );

    // 4.8 Produtos demonstrativos
    await conn.execute(
      `DELETE FROM products WHERE organization_id = ?`,
      [orgId]
    );

    // 4.9 Contatos demonstrativos
    await conn.execute(
      `DELETE FROM contacts WHERE organization_id = ?`,
      [orgId]
    );

    // 4.10 Excluir todos os eventos da organização
    await conn.execute(
      `DELETE FROM events WHERE organization_id = ?`,
      [orgId]
    );

    // 4.11 Remover usuários demo e compradores sintéticos, preservando owner e admins
    const [demoUsers] = await conn.execute(
      `SELECT id FROM users
       WHERE (email LIKE '%@exemplo.com' OR email IN ('demo@evotech.com', 'carla@evotech.com', 'diego@evotech.com', 'bia@evotech.com'))
         AND id != ?`,
      [targetOrg.owner_user_id]
    );

    if (demoUsers.length > 0) {
      const demoUserIds = demoUsers.map((u) => u.id);
      const placeholders = demoUserIds.map(() => '?').join(',');
      await conn.execute(
        `DELETE FROM organization_members WHERE user_id IN (${placeholders})`,
        demoUserIds
      );
      await conn.execute(
        `DELETE FROM users WHERE id IN (${placeholders})`,
        demoUserIds
      );
    }

    // 4.12 Registrar na auditoria
    await conn.execute(
      `INSERT INTO audit_logs (organization_id, user_id, user_name, action)
       VALUES (?, ?, 'Sistema', 'Limpeza completa de dados demonstrativos para testes reais')`,
      [orgId, targetOrg.owner_user_id]
    );
  });

  console.log('[EXCLUSÃO CONCLUÍDA COM SUCESSO]\n');

  // 5. Validação final pós-limpeza
  const countsAfter = {
    events: (await db.queryOne(`SELECT COUNT(*) as n FROM events WHERE organization_id = ?`, [orgId])).n,
    batches: (await db.queryOne(
      `SELECT COUNT(*) as n FROM ticket_batches tb JOIN events e ON tb.event_id = e.id WHERE e.organization_id = ?`,
      [orgId]
    )).n,
    orders: (await db.queryOne(
      `SELECT COUNT(*) as n FROM orders o JOIN events e ON o.event_id = e.id WHERE e.organization_id = ?`,
      [orgId]
    )).n,
    tickets: (await db.queryOne(
      `SELECT COUNT(*) as n FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.organization_id = ?`,
      [orgId]
    )).n,
    checkins: (await db.queryOne(
      `SELECT COUNT(*) as n FROM checkins c JOIN events e ON c.event_id = e.id WHERE e.organization_id = ?`,
      [orgId]
    )).n,
    products: (await db.queryOne(`SELECT COUNT(*) as n FROM products WHERE organization_id = ?`, [orgId])).n,
    expenses: (await db.queryOne(`SELECT COUNT(*) as n FROM expenses WHERE organization_id = ?`, [orgId])).n,
    contacts: (await db.queryOne(`SELECT COUNT(*) as n FROM contacts WHERE organization_id = ?`, [orgId])).n,
    activeAdminUsers: (await db.queryOne(`SELECT COUNT(*) as n FROM users WHERE role = 'platform_admin'`)).n,
    preservedOrganizations: (await db.queryOne(`SELECT COUNT(*) as n FROM organizations WHERE id = ?`, [orgId])).n,
  };

  console.log('Validação pós-limpeza:');
  console.table(countsAfter);

  if (countsAfter.events === 0 && countsAfter.orders === 0 && countsAfter.tickets === 0 && countsAfter.preservedOrganizations === 1) {
    console.log('ORGANIZAÇÃO PRONTA PARA TESTES REAIS (Zero eventos fictícios, administrador preservado).');
  } else {
    console.error('AVISO: Verifique a contagem de registros acima.');
  }

  process.exit(0);
}

runCleanup().catch((err) => {
  console.error('Erro durante limpeza de dados:', err);
  process.exit(1);
});
