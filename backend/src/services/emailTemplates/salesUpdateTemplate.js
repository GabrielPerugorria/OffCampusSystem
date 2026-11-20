'use strict';
const { renderBaseLayout, escapeHtml } = require('./baseTemplate');

/**
 * Template: Atualização de Vendas
 * Usado para resumos agrupados de vendas no período de agrupamento configurado.
 *
 * @param {object} opts
 * @param {string}  opts.eventName          - Nome do evento
 * @param {string}  opts.periodLabel        - Ex: "Últimos 5 minutos" | "Últimas 2 horas"
 * @param {number}  opts.ticketsSold        - Ingressos vendidos no período
 * @param {number}  opts.revenueConfirmed   - Receita confirmada (apenas pedidos paid)
 * @param {number}  opts.uniqueBuyers       - Compradores únicos no período
 * @param {string}  opts.currentBatchName   - Nome do lote atual
 * @param {number}  opts.batchFillPct       - % de ocupação do lote atual (0-100)
 * @param {number}  opts.eventFillPct       - % de ocupação total do evento (0-100)
 * @param {number}  opts.goalRevenue        - Meta de faturamento (0 = sem meta)
 * @param {number}  opts.goalProgress       - % atingido da meta (0-100)
 * @param {number}  opts.avgTicket          - Ticket médio do período
 * @param {number}  opts.prevPeriodTickets  - Ingressos no período anterior (para comparativo)
 * @param {string}  opts.dashboardUrl       - URL do dashboard
 */
function renderSalesUpdateTemplate({
  eventName,
  periodLabel = 'Últimos minutos',
  ticketsSold = 0,
  revenueConfirmed = 0,
  uniqueBuyers = 0,
  currentBatchName = '',
  batchFillPct = 0,
  eventFillPct = 0,
  goalRevenue = 0,
  goalProgress = 0,
  avgTicket = 0,
  prevPeriodTickets = 0,
  dashboardUrl = '',
}) {
  const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  const pct = (v) => `${Number(v).toFixed(1)}%`;
  const n = (v) => Number(v).toLocaleString('pt-BR');

  const delta = ticketsSold - prevPeriodTickets;
  const deltaSign = delta > 0 ? '+' : '';
  const deltaColor = delta >= 0 ? '#10b981' : '#ef4444';

  const batchBar = Math.max(0, Math.min(100, batchFillPct));
  const goalBar = goalRevenue > 0 ? Math.max(0, Math.min(100, goalProgress)) : 0;

  const contentHtml = `
    <!-- Título -->
    <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:800;color:#f1f5f9;line-height:1.2;">
      Atualização de Vendas
    </h1>
    <p style="margin:0 0 28px 0;font-size:14px;color:#64748b;">${escapeHtml(periodLabel)} · ${escapeHtml(eventName)}</p>

    <!-- Cards de métricas -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td width="50%" style="padding-right:8px;vertical-align:top;">
          <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:18px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Ingressos Vendidos</div>
            <div style="font-size:28px;font-weight:800;color:#f1f5f9;">${n(ticketsSold)}</div>
            <div style="font-size:12px;color:${deltaColor};margin-top:4px;">${deltaSign}${n(delta)} vs. período anterior</div>
          </div>
        </td>
        <td width="50%" style="padding-left:8px;vertical-align:top;">
          <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:18px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Receita Confirmada</div>
            <div style="font-size:22px;font-weight:800;color:#10b981;">${fmt(revenueConfirmed)}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Ticket médio: ${fmt(avgTicket)}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding-right:8px;vertical-align:top;">
          <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:18px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Compradores</div>
            <div style="font-size:28px;font-weight:800;color:#f1f5f9;">${n(uniqueBuyers)}</div>
          </div>
        </td>
        <td width="50%" style="padding-left:8px;vertical-align:top;">
          <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:18px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Ocupação do Evento</div>
            <div style="font-size:28px;font-weight:800;color:#f1f5f9;">${pct(eventFillPct)}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Lote atual -->
    ${currentBatchName ? `
    <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:18px;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">Lote Atual — ${escapeHtml(currentBatchName)}</div>
      <div style="background-color:#1e293b;border-radius:4px;height:8px;overflow:hidden;margin-bottom:8px;">
        <div style="height:100%;width:${batchBar}%;background:linear-gradient(90deg,#059669,#10b981);border-radius:4px;"></div>
      </div>
      <div style="font-size:12px;color:#94a3b8;">${pct(batchFillPct)} vendido</div>
    </div>` : ''}

    <!-- Meta de faturamento -->
    ${goalRevenue > 0 ? `
    <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:18px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">Progresso da Meta — ${fmt(goalRevenue)}</div>
      <div style="background-color:#1e293b;border-radius:4px;height:8px;overflow:hidden;margin-bottom:8px;">
        <div style="height:100%;width:${goalBar}%;background:linear-gradient(90deg,#0284c7,#38bdf8);border-radius:4px;"></div>
      </div>
      <div style="font-size:12px;color:#94a3b8;">${pct(goalProgress)} atingido</div>
    </div>` : ''}

    <!-- CTA -->
    ${dashboardUrl ? `
    <div style="text-align:center;margin-top:24px;">
      <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">
        Ver Dashboard Completo
      </a>
    </div>` : ''}
  `;

  const contentText = `
ATUALIZAÇÃO DE VENDAS — ${eventName.toUpperCase()}
${periodLabel}

INGRESSOS VENDIDOS: ${n(ticketsSold)} (${deltaSign}${n(delta)} vs. período anterior)
RECEITA CONFIRMADA: ${fmt(revenueConfirmed)}
TICKET MÉDIO: ${fmt(avgTicket)}
COMPRADORES: ${n(uniqueBuyers)}
OCUPAÇÃO DO EVENTO: ${pct(eventFillPct)}
${currentBatchName ? `LOTE ATUAL (${currentBatchName}): ${pct(batchFillPct)} vendido` : ''}
${goalRevenue > 0 ? `META DE FATURAMENTO (${fmt(goalRevenue)}): ${pct(goalProgress)} atingido` : ''}
${dashboardUrl ? `\nAcesse o dashboard: ${dashboardUrl}` : ''}
  `;

  return renderBaseLayout({
    title: `EvoTech Events | Atualização de Vendas — ${eventName}`,
    previewText: `${n(ticketsSold)} ingressos · ${fmt(revenueConfirmed)} · ${pct(eventFillPct)} de ocupação`,
    contentHtml,
    contentText,
  });
}

module.exports = renderSalesUpdateTemplate;
