'use strict';
const db = require('../config/db');
const AppError = require('../utils/AppError');
const analytics = require('./analyticsService');
const inventory = require('./inventoryService');
const finance = require('./financeService');

function toCSV(rows, headers) {
  const escape = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = headers.map(h => escape(h.label)).join(';');
  const body = rows.map(r => headers.map(h => escape(r[h.key])).join(';'));
  // BOM para o Excel abrir acentuação corretamente.
  return `\uFEFF${[head, ...body].join('\n')}`;
}

const REPORTS = {
  async eventos(organizationId) {
    const rows = await analytics.eventFinancials(organizationId);
    return {
      filename: 'eventos',
      csv: toCSV(rows.map(e => ({
        nome: e.name, status: e.status, data: e.eventDate || 'A definir',
        capacidade: e.capacity, vendidos: e.sold, ocupacao: e.occupancy.toFixed(1),
        receita: e.revenue.toFixed(2), custo: e.totalCost.toFixed(2),
        margem: e.margin.toFixed(1), roi: e.roi.toFixed(1),
      })), [
        { key: 'nome', label: 'Evento' }, { key: 'status', label: 'Status' },
        { key: 'data', label: 'Data' }, { key: 'capacidade', label: 'Capacidade' },
        { key: 'vendidos', label: 'Vendidos' }, { key: 'ocupacao', label: 'Ocupação %' },
        { key: 'receita', label: 'Receita' }, { key: 'custo', label: 'Custo alocado' },
        { key: 'margem', label: 'Margem %' }, { key: 'roi', label: 'ROI %' },
      ]),
    };
  },

  async ingressos(organizationId) {
    const rows = await db.query(
      `SELECT t.code, t.holder_name, t.holder_email, t.price_paid, t.status, t.issued_at,
              b.name AS batch, e.name AS event
         FROM tickets t JOIN ticket_batches b ON b.id = t.batch_id
         JOIN events e ON e.id = t.event_id JOIN orders o ON o.id = t.order_id
        WHERE e.organization_id = ? AND o.status = 'paid'
        ORDER BY t.issued_at DESC`, [organizationId]
    );
    return {
      filename: 'ingressos',
      csv: toCSV(rows, [
        { key: 'code', label: 'Código' }, { key: 'event', label: 'Evento' },
        { key: 'batch', label: 'Lote' }, { key: 'holder_name', label: 'Nome' },
        { key: 'holder_email', label: 'E-mail' }, { key: 'price_paid', label: 'Valor' },
        { key: 'status', label: 'Status' }, { key: 'issued_at', label: 'Emitido em' },
      ]),
    };
  },

  async entradas(organizationId) {
    const rows = await db.query(
      `SELECT c.guest_name, c.method, c.checked_in_at, t.code, e.name AS event, u.name AS operator
         FROM checkins c JOIN events e ON e.id = c.event_id
    LEFT JOIN tickets t ON t.id = c.ticket_id LEFT JOIN users u ON u.id = c.checked_by_user_id
        WHERE e.organization_id = ? ORDER BY c.checked_in_at DESC`, [organizationId]
    );
    return {
      filename: 'entradas',
      csv: toCSV(rows, [
        { key: 'checked_in_at', label: 'Horário' }, { key: 'guest_name', label: 'Nome' },
        { key: 'event', label: 'Evento' }, { key: 'code', label: 'Código' },
        { key: 'method', label: 'Método' }, { key: 'operator', label: 'Operador' },
      ]),
    };
  },

  async financeiro(organizationId) {
    const rows = await finance.listExpenses(organizationId);
    return {
      filename: 'financeiro',
      csv: toCSV(rows.map(r => ({
        data: r.expense_date, categoria: `${r.category_icon || ''} ${r.category_name}`.trim(),
        descricao: r.description, evento: r.event_name || 'Geral',
        valor: Number(r.amount).toFixed(2), status: r.status,
      })), [
        { key: 'data', label: 'Data' }, { key: 'categoria', label: 'Categoria' },
        { key: 'descricao', label: 'Descrição' }, { key: 'evento', label: 'Evento' },
        { key: 'valor', label: 'Valor' }, { key: 'status', label: 'Status' },
      ]),
    };
  },

  async estoque(organizationId) {
    const rows = await inventory.list(organizationId);
    return {
      filename: 'estoque',
      csv: toCSV(rows.map(p => ({
        nome: p.name, categoria: p.category, estoque: p.stockQuantity,
        minimo: p.minStock, custo: p.unitCost.toFixed(2),
        valor: (p.unitCost * p.stockQuantity).toFixed(2), alerta: p.low ? 'BAIXO' : 'OK',
      })), [
        { key: 'nome', label: 'Item' }, { key: 'categoria', label: 'Categoria' },
        { key: 'estoque', label: 'Estoque' }, { key: 'minimo', label: 'Mínimo' },
        { key: 'custo', label: 'Custo unitário' }, { key: 'valor', label: 'Valor em estoque' },
        { key: 'alerta', label: 'Alerta' },
      ]),
    };
  },

  async participantes(organizationId) {
    const participantService = require('./participantService');
    const rows = await participantService.list(organizationId, { limit: 1000 });
    return {
      filename: 'participantes',
      csv: toCSV(rows.map(p => ({
        nome: p.name, email: p.email, cpf: p.cpf, telefone: p.phone,
        ingressos: p.tickets, gasto: p.totalSpent.toFixed(2),
        presencas: p.checkins, status: p.status,
      })), [
        { key: 'nome', label: 'Nome' }, { key: 'email', label: 'E-mail' },
        { key: 'cpf', label: 'CPF' }, { key: 'telefone', label: 'Telefone' },
        { key: 'ingressos', label: 'Ingressos' }, { key: 'gasto', label: 'Total gasto' },
        { key: 'presencas', label: 'Presenças' }, { key: 'status', label: 'Status' },
      ]),
    };
  },
};

async function exportCsv(organizationId, type) {
  const report = REPORTS[type];
  if (!report) {
    throw AppError.badRequest(
      `Relatório desconhecido. Disponíveis: ${Object.keys(REPORTS).join(', ')}.`
    );
  }
  return report(organizationId);
}

// Relatório executivo em texto (equivale ao exportRelatorioExecutivo antigo).
async function executive(organizationId, organizationName) {
  const [dash, goalsData, comp] = await Promise.all([
    analytics.dashboard(organizationId),
    analytics.goals(organizationId),
    analytics.comparison(organizationId),
  ]);
  const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const lines = [
    `RELATÓRIO EXECUTIVO — ${organizationName}`,
    `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    '',
    'VISÃO GERAL',
    `Eventos ativos.............: ${dash.kpis.activeEvents} de ${dash.kpis.totalEvents}`,
    `Ingressos vendidos.........: ${dash.kpis.ticketsSold}`,
    `Receita reconhecida........: ${brl(dash.kpis.revenue)}`,
    `Despesas...................: ${brl(dash.kpis.expenses)}`,
    `Saldo......................: ${brl(dash.kpis.balance)}`,
    `Ticket médio...............: ${brl(dash.kpis.averageTicket)}`,
    `ROI geral..................: ${dash.kpis.roi.toFixed(1)}%`,
    `Check-ins registrados......: ${dash.kpis.totalCheckins}`,
    '',
    'METAS',
    `Público....................: ${goalsData.summary.attendance} de ${goalsData.summary.goalAttendance} (${goalsData.summary.attendancePct.toFixed(1)}%)`,
    `Faturamento................: ${brl(goalsData.summary.revenue)} de ${brl(goalsData.summary.goalRevenue)} (${goalsData.summary.revenuePct.toFixed(1)}%)`,
    `Break-even.................: ${goalsData.summary.breakEven.toFixed(1)}%`,
    '',
    'RANKING DE EVENTOS',
    ...comp.ranking.map((e, i) =>
      `${i + 1}. ${e.name} — ${e.sold} ingressos | ${brl(e.revenue)} | margem ${e.margin.toFixed(1)}% | ROI ${e.roi.toFixed(1)}%`),
    '',
    'INSIGHTS',
    ...comp.insights.map(i => `- ${i.title}: ${i.text}`),
    '',
    'ALERTAS',
    ...(dash.alerts.length ? dash.alerts.map(a => `- [${a.level}] ${a.message}`) : ['- Nenhum alerta ativo.']),
  ];
  return { filename: 'relatorio-executivo', text: lines.join('\n') };
}

module.exports = { exportCsv, executive, toCSV };
