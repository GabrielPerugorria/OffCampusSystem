'use strict';
const { renderBaseLayout, escapeHtml } = require('./baseTemplate');

/**
 * Template: Resumo Consolidado (Comercial / Executivo)
 * Enviado periodicamente para o Owner ou gestores de evento com seus dados consolidados.
 *
 * @param {object} opts
 * @param {string}   opts.organizationName  - Nome da organização
 * @param {string}   opts.periodLabel       - Ex: "Resumo Semanal" | "Resumo Diário"
 * @param {number}   opts.totalRevenue      - Receita confirmada total (pedidos paid)
 * @param {number}   opts.totalTicketsSold  - Ingressos vendidos totais
 * @param {number}   opts.expensesPaid      - Despesas pagas
 * @param {number}   opts.expensesPending   - Despesas pendentes
 * @param {number}   opts.operationalBalance- Saldo operacional líquido
 * @param {Array}    opts.eventsSummary     - Lista de eventos [{ name, sold, revenue, occupancy }]
 * @param {string}   opts.dashboardUrl      - Link para o painel de controle
 */
function renderSummaryTemplate({
  organizationName = 'Organização',
  periodLabel = 'Resumo Executivo',
  totalRevenue = 0,
  totalTicketsSold = 0,
  expensesPaid = 0,
  expensesPending = 0,
  operationalBalance = 0,
  eventsSummary = [],
  dashboardUrl = '',
}) {
  const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  const pct = (v) => `${Number(v).toFixed(1)}%`;
  const n = (v) => Number(v).toLocaleString('pt-BR');

  const balanceColor = operationalBalance >= 0 ? '#10b981' : '#ef4444';

  const eventsTableRows = eventsSummary.length > 0
    ? eventsSummary.map(ev => `
      <tr style="border-bottom:1px solid #1e293b;">
        <td style="padding:10px 8px;font-size:13px;color:#f1f5f9;font-weight:600;">${escapeHtml(ev.name)}</td>
        <td style="padding:10px 8px;font-size:13px;color:#94a3b8;text-align:center;">${n(ev.sold || 0)}</td>
        <td style="padding:10px 8px;font-size:13px;color:#10b981;font-weight:700;text-align:right;">${fmt(ev.revenue || 0)}</td>
        <td style="padding:10px 8px;font-size:12px;color:#cbd5e1;text-align:right;">${pct(ev.occupancy || 0)}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="4" style="padding:16px;text-align:center;color:#64748b;font-size:13px;">Nenhum evento com movimentação no período.</td></tr>`;

  const contentHtml = `
    <!-- Título -->
    <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:800;color:#f1f5f9;line-height:1.2;">
      ${escapeHtml(periodLabel)}
    </h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">
      ${escapeHtml(organizationName)} · Visão Consolidada de Desempenho
    </p>

    <!-- Cards Principais -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
      <tr>
        <td width="50%" style="padding-right:8px;vertical-align:top;">
          <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:16px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Receita Total</div>
            <div style="font-size:22px;font-weight:800;color:#10b981;">${fmt(totalRevenue)}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${n(totalTicketsSold)} ingressos vendidos</div>
          </div>
        </td>
        <td width="50%" style="padding-left:8px;vertical-align:top;">
          <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:16px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Saldo Operacional</div>
            <div style="font-size:22px;font-weight:800;color:${balanceColor};">${fmt(operationalBalance)}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Despesas pagas: ${fmt(expensesPaid)}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Tabela de Eventos -->
    <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:16px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:700;color:#cbd5e1;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">
        Desempenho por Evento
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid #334155;text-align:left;">
            <th style="padding:6px 8px;font-size:11px;color:#64748b;text-transform:uppercase;">Evento</th>
            <th style="padding:6px 8px;font-size:11px;color:#64748b;text-transform:uppercase;text-align:center;">Vendas</th>
            <th style="padding:6px 8px;font-size:11px;color:#64748b;text-transform:uppercase;text-align:right;">Receita</th>
            <th style="padding:6px 8px;font-size:11px;color:#64748b;text-transform:uppercase;text-align:right;">Ocupação</th>
          </tr>
        </thead>
        <tbody>
          ${eventsTableRows}
        </tbody>
      </table>
    </div>

    <!-- CTA Botão -->
    ${dashboardUrl ? `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:20px;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(dashboardUrl)}"
             style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;box-shadow:0 4px 15px rgba(16,185,129,0.3);letter-spacing:0.3px;">
            Acessar Painel de Controle &rarr;
          </a>
        </td>
      </tr>
    </table>` : ''}
  `;

  const contentText = `
${periodLabel.toUpperCase()} — ${organizationName.toUpperCase()}
Receita Confirmada: ${fmt(totalRevenue)}
Ingressos Vendidos: ${n(totalTicketsSold)}
Saldo Operacional: ${fmt(operationalBalance)}
Despesas Pagas: ${fmt(expensesPaid)}
Despesas Pendentes: ${fmt(expensesPending)}

DESEMPENHO POR EVENTO:
${eventsSummary.map(e => `- ${e.name}: ${e.sold} ingressos | ${fmt(e.revenue)} (${pct(e.occupancy)} ocupação)`).join('\n')}

Acesse o painel: ${dashboardUrl}
  `;

  return renderBaseLayout({
    title: `EvoTech Events | ${periodLabel} — ${organizationName}`,
    previewText: `${periodLabel}: Receita ${fmt(totalRevenue)} · Saldo ${fmt(operationalBalance)}`,
    contentHtml,
    contentText,
  });
}

module.exports = renderSummaryTemplate;
