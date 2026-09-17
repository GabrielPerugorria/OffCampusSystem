'use strict';
// Popula o banco com os dados de demonstração que existiam no localStorage.
// As senhas são geradas com bcrypt aqui — nunca ficam em texto no SQL.
// Uso: npm run db:seed
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');
const { slugify } = require('../utils/slug');

const EVENTS = [
  {
    name: 'OFFCampus na Copa', type: 'Experiência Premium', date: '2026-12-31 22:00:00',
    venue: 'Curitiba, PR', capacity: 380, status: 'upcoming',
    description: 'Música ao vivo, áreas VIP e networking com convidados especiais.',
    rules: 'Documento obrigatório. +18.', goalAttendance: 340, goalRevenue: 60000,
    batches: [
      { name: 'Lote Promocional', price: 49.90, total: 100, sold: 50 },
      { name: '1º Lote',          price: 79.90, total: 300, sold: 100 },
      { name: 'VIP',              price: 149.90, total: 50, sold: 20 },
      { name: 'Open Bar',         price: 199.90, total: 30, sold: 10 },
    ],
  },
  {
    name: 'Resenha do Portes', type: 'Festival Eletrônico', date: '2026-11-15 23:00:00',
    venue: 'Curitiba, PR', capacity: 470, status: 'active', banner: 'imagens/resenhadoportes.png',
    description: 'Line-up exclusivo, produção premium e acesso controlado para uma noite inesquecível.',
    rules: 'Documento obrigatório. Não é permitida a entrada de bebidas externas.',
    goalAttendance: 420, goalRevenue: 45000,
    batches: [
      { name: '1º Lote',  price: 69.90, total: 250, sold: 100 },
      { name: '2º Lote',  price: 99.90, total: 200, sold: 100 },
      { name: 'Camarote', price: 179.90, total: 20, sold: 5 },
    ],
  },
  {
    name: 'Halloween OffCampus', type: 'Ambiente VIP', date: '2026-10-31 22:00:00',
    venue: 'Curitiba, PR', capacity: 610, status: 'active', banner: 'imagens/halloween.png',
    description: 'A maior festa de Halloween universitária do sul do Brasil. Open food, música e ambiente VIP.',
    rules: 'Estudantes com carteirinha têm 20% de desconto. Fantasia incentivada.',
    goalAttendance: 550, goalRevenue: 52000,
    batches: [
      { name: 'Lote Estudante',   price: 39.90, total: 150, sold: 70 },
      { name: '1º Lote',          price: 59.90, total: 400, sold: 200 },
      { name: 'VIP + Open Food',  price: 129.90, total: 60, sold: 20 },
    ],
  },
];

const PRODUCTS = [
  { name: 'Cerveja Long Neck', emoji: '🍺', category: 'Cerveja',     cost: 4.50, stock: 240, min: 40 },
  { name: 'Vodka 1L',          emoji: '🥃', category: 'Destilado',   cost: 28.00, stock: 42, min: 10 },
  { name: 'Gin Tônica Kit',    emoji: '🍹', category: 'Destilado',   cost: 22.00, stock: 55, min: 10 },
  { name: 'Energético 473ml',  emoji: '⚡', category: 'Energético',  cost: 8.00,  stock: 18, min: 20 },
  { name: 'Refrigerante 2L',   emoji: '🥤', category: 'Refrigerante', cost: 6.00, stock: 90, min: 15 },
  { name: 'Água 500ml',        emoji: '💧', category: 'Água',        cost: 1.50, stock: 200, min: 50 },
];

const EXPENSES = [
  { category: 'Segurança',    icon: '🛡️', description: 'Equipe de segurança para 3 eventos', amount: 42000 },
  { category: 'Marketing',    icon: '📣', description: 'Redes sociais + panfletos',          amount: 28000 },
  { category: 'Bebidas',      icon: '🍺', description: 'Estoque para Open Bar',              amount: 38000 },
  { category: 'Estrutura',    icon: '🏗️', description: 'Palco, som, iluminação',             amount: 26000 },
  { category: 'DJs/Atrações', icon: '🎤', description: 'Line-up confirmado',                 amount: 49000 },
];

const CONTACTS = [
  { name: 'DJ KassiBeat', role: 'DJ Residente', email: 'dj@kassib.com', phone: '(41) 99111-2222', category: 'Artista / DJ', fee: 3500, notes: 'Disponível nas sextas.' },
  { name: 'Lucas Portaria', role: 'Coordenador de Segurança', email: 'lucas@sec.com', phone: '(41) 99333-4444', category: 'Segurança', fee: 1200, notes: 'Traz equipe de 10 pessoas.' },
  { name: 'BebidaTop Distribuidora', role: 'Fornecedor de Bebidas', email: 'vendas@bebidatop.com', phone: '(41) 3333-4444', category: 'Fornecedor', fee: 0, notes: 'Entrega 48h antes.' },
];

const TEAM = [
  { name: 'Carla Financeiro', email: 'carla@evotech.com', role: 'finance' },
  { name: 'Diego Portaria',   email: 'diego@evotech.com', role: 'gate' },
  { name: 'Bia Bar',          email: 'bia@evotech.com',   role: 'bar' },
];

async function run() {
  const hash = pwd => bcrypt.hash(pwd, env.bcryptRounds);

  const already = await db.queryOne('SELECT COUNT(*) AS n FROM users');
  if (Number(already.n) > 0) {
    console.log('O banco já contém dados. Seed abortado para não duplicar registros.');
    console.log('Para recomeçar do zero: npm run db:setup && npm run db:seed');
    process.exit(0);
  }

  // --- Admin e organização ---
  const admin = await db.query(
    `INSERT INTO users (name, email, password_hash, cpf, phone, birth_date, role)
     VALUES (?,?,?,?,?,?, 'platform_admin')`,
    ['Admin EvoTech', 'admin@evotech.com', await hash('admin123'),
     '00000000000', '41999999999', '1990-01-01']
  );
  const org = await db.query(
    'INSERT INTO organizations (name, slug, owner_user_id) VALUES (?,?,?)',
    ['OffCampus Produções', 'offcampus', admin.insertId]
  );
  const orgId = org.insertId;
  await db.query(
    `INSERT INTO organization_members (organization_id, user_id, role) VALUES (?,?, 'owner')`,
    [orgId, admin.insertId]
  );

  // --- Equipe ---
  for (const member of TEAM) {
    const u = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?,?,?)',
      [member.name, member.email, await hash('equipe123')]
    );
    await db.query(
      'INSERT INTO organization_members (organization_id, user_id, role) VALUES (?,?,?)',
      [orgId, u.insertId, member.role]
    );
  }

  // --- Participante demo ---
  const demo = await db.query(
    `INSERT INTO users (name, email, password_hash, cpf, phone, birth_date)
     VALUES (?,?,?,?,?,?)`,
    ['João Cardoso', 'demo@evotech.com', await hash('demo123'),
     '11111111111', '41988888888', '1998-05-12']
  );

  // --- Eventos e lotes ---
  const eventIds = {};
  const batchIds = {};
  for (const ev of EVENTS) {
    const r = await db.query(
      `INSERT INTO events
         (organization_id, name, slug, type, description, rules, venue, event_date,
          capacity, banner_url, status, goal_attendance, goal_revenue)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [orgId, ev.name, slugify(ev.name), ev.type, ev.description, ev.rules, ev.venue,
       ev.date, ev.capacity, ev.banner || null, ev.status, ev.goalAttendance, ev.goalRevenue]
    );
    eventIds[ev.name] = r.insertId;
    let order = 0;
    for (const b of ev.batches) {
      order += 1;
      const br = await db.query(
        `INSERT INTO ticket_batches (event_id, name, price, quantity_total, quantity_sold, sort_order)
         VALUES (?,?,?,?,?,?)`,
        [r.insertId, b.name, b.price, b.total, 0, order]
      );
      batchIds[`${ev.name}|${b.name}`] = { id: br.insertId, price: b.price, sold: b.sold };
    }
  }

  // --- Vendas de demonstração ---
  // Os "vendidos" do protótipo viram pedidos e ingressos REAIS, para que
  // receita, participantes e portaria fechem entre si.
  const { generateTicketCode } = require('../utils/ticketCode');
  // Compradores fictícios de demonstração. São claramente sintéticos
  // (dominío @exemplo.com) para não serem confundidos com clientes reais.
  const FIRST = ['Ana', 'Pedro', 'Maria', 'Lucas', 'Julia', 'Rafael', 'Camila', 'Bruno',
    'Larissa', 'Gustavo', 'Beatriz', 'Thiago', 'Fernanda', 'Matheus', 'Carolina'];
  const LAST = ['Lima', 'Souza', 'Santos', 'Oliveira', 'Pereira', 'Costa', 'Almeida',
    'Ribeiro', 'Martins', 'Rocha'];

  const buyers = [
    { name: 'João Cardoso', email: 'demo@evotech.com', cpf: '11111111111', userId: demo.insertId },
  ];
  for (let i = 0; i < 120; i += 1) {
    const name = `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`;
    buyers.push({
      name,
      email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}.${i}@exemplo.com`,
      cpf: String(10000000000 + i * 37),
      userId: null,
    });
  }

  let buyerIndex = 0;
  const createdTickets = [];
  for (const ev of EVENTS) {
    for (const b of ev.batches) {
      const batch = batchIds[`${ev.name}|${b.name}`];
      if (!batch.sold) continue;
      for (let i = 0; i < batch.sold; i += 1) {
        const buyer = buyers[buyerIndex % buyers.length];
        buyerIndex += 1;
        const order = await db.query(
          `INSERT INTO orders
             (event_id, user_id, buyer_name, buyer_email, buyer_cpf, total_amount, status, payment_method, paid_at)
           VALUES (?,?,?,?,?,?, 'paid', 'pix', NOW())`,
          [eventIds[ev.name], buyer.userId, buyer.name, buyer.email, buyer.cpf, batch.price]
        );
        const code = generateTicketCode(ev.name, b.name);
        const t = await db.query(
          `INSERT INTO tickets (order_id, batch_id, event_id, code, holder_name, holder_email, holder_cpf, price_paid)
           VALUES (?,?,?,?,?,?,?,?)`,
          [order.insertId, batch.id, eventIds[ev.name], code, buyer.name, buyer.email, buyer.cpf, batch.price]
        );
        createdTickets.push({ id: t.insertId, eventId: eventIds[ev.name], name: buyer.name });
      }
      await db.query('UPDATE ticket_batches SET quantity_sold = ? WHERE id = ?', [batch.sold, batch.id]);
    }
  }

  // --- Check-ins de demonstração (3 primeiros ingressos) ---
  for (const t of createdTickets.slice(0, 3)) {
    await db.query(
      `INSERT INTO checkins (event_id, ticket_id, guest_name, method, checked_by_user_id, checked_in_at)
       VALUES (?,?,?, 'code', ?, DATE_SUB(NOW(), INTERVAL ? HOUR))`,
      [t.eventId, t.id, t.name, admin.insertId, 2]
    );
    await db.query(`UPDATE tickets SET status = 'used' WHERE id = ?`, [t.id]);
  }

  // --- Produtos e estoque ---
  for (const p of PRODUCTS) {
    const r = await db.query(
      `INSERT INTO products (organization_id, name, emoji, category, unit_cost, stock_quantity, min_stock)
       VALUES (?,?,?,?,?,?,?)`,
      [orgId, p.name, p.emoji, p.category, p.cost, p.stock, p.min]
    );
    await db.query(
      `INSERT INTO stock_movements (product_id, type, quantity, unit_value, reason, user_id)
       VALUES (?, 'in', ?, ?, 'Estoque inicial', ?)`,
      [r.insertId, p.stock, p.cost, admin.insertId]
    );
  }

  // --- Despesas ---
  for (const x of EXPENSES) {
    const c = await db.query(
      'INSERT INTO expense_categories (organization_id, name, icon) VALUES (?,?,?)',
      [orgId, x.category, x.icon]
    );
    await db.query(
      `INSERT INTO expenses (organization_id, category_id, description, amount, expense_date, created_by)
       VALUES (?,?,?,?, CURDATE(), ?)`,
      [orgId, c.insertId, x.description, x.amount, admin.insertId]
    );
  }

  // --- Contatos ---
  for (const c of CONTACTS) {
    await db.query(
      `INSERT INTO contacts (organization_id, name, role_title, email, phone, category, fee, notes)
       VALUES (?,?,?,?,?,?,?,?)`,
      [orgId, c.name, c.role, c.email, c.phone, c.category, c.fee, c.notes]
    );
  }

  await db.query(
    `INSERT INTO audit_logs (organization_id, user_id, user_name, action)
     VALUES (?,?,?, 'Banco inicializado com os dados de demonstração')`,
    [orgId, admin.insertId, 'Admin EvoTech']
  );

  console.log('Seed concluído.');
  console.log('  admin@evotech.com / admin123   (owner do produtor)');
  console.log('  carla@evotech.com / equipe123  (financeiro)');
  console.log('  diego@evotech.com / equipe123  (portaria)');
  console.log('  bia@evotech.com   / equipe123  (bar)');
  console.log('  demo@evotech.com  / demo123    (participante)');
  console.log(`  ${createdTickets.length} ingressos e 3 check-ins criados.`);
  process.exit(0);
}

run().catch(err => { console.error('Falha no seed:', err); process.exit(1); });
