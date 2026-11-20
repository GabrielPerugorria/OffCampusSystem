'use strict';
const { renderBaseLayout, escapeHtml } = require('./baseTemplate');

/**
 * Template: Atualização Financeira
 * Usado para alertas financeiros e resumos periódicos do evento.
 *
 * @param {object} opts
 * @param {string}  opts.eventName          - Nome do evento
 * @param {string}  opts.periodLabel        - Período de referência
 * @param {number}  opts.revenueConfirmed   - Receita total confirmada (pedidos paid)
 * @param {number}  opts.expensesTotal      - Total de despesas registradas
 * @param {number}  opts.expensesPaid       - Despesas pagas
 * @param {number}  opts.expensesPending    - Despesas pendentes
 * @param {number}  opts.operationalBalance - Receita - Despesas pagas
 * @param {number}  opts.roi                - ROI em % (pode ser negativo)
 * @param {string}  opts.alertMessage       - Mensagem de alerta específica (opcional)
 * @param {string}  opts.alertLevel         - 'info' | 'warning' | 'critical'
 * @param {string}  opts.dashboardUrl
 */
function renderFinanceUpdateTemplate({
  eventName,
  periodLabel = 'Situação atual',
  revenueConfirmed = 0,
  expensesTotal = 0,
  expensesPaid = 0,
  expensesPending = 0,
  operationalBalance = 0,
  roi = 0,
  alertMessage = '',
  alertLevel = 'info',
  dashboardUrl = '',
}) {
  const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  const pct = (v) => `${Number(v).toFixed(1)}%`;

  const balanceColor = operationalBalance >= 0 ? '#10b981' : '#ef4444';
  const roiColor = roi >= 0 ? '#10b981' : '#ef4444';

  const alertColors = {
    info:     { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)',  text: '#10b981'  },
    warning:  { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  text: '#f59e0b'  },
    critical: { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   text: '#ef4444'  },
  };
  const ac = alertColors[alertLevel] || alertColors.info;

  const contentHtml = `
    <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:800;color:#f1f5f9;">
      Atualização Financeira
    </h1>
    <p style="margin:0 0 28px 0;font-size:14px;color:#64748b;">${escapeHtml(periodLabel)} · ${escapeHtml(eventName)}</p>

    ${alertMessage ? `
    <div style="background-color:${ac.bg};border:1px solid ${ac.border};border-radius:8px;padding:14px 18px;margin-bottom:24px;">
      <div style="font-size:13px;color:${ac.text};font-weight:600;">${escapeHtml(alertMessage)}</div>
    </div>` : ''}

    <!-- Cards financeiros -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td width="50%" style="padding-right:8px;vertical-align:top;">
          <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:18px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Receita Confirmada</div>
            <div style="font-size:22px;font-weight:800;color:#10b981;">${fmt(revenueConfirmed)}</div>
          </div>
        </td>
        <td width="50%" style="padding-left:8px;vertical-align:top;">
          <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:18px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Saldo Operacional</div>
            <div style="font-size:22px;font-weight:800;color:${balanceColor};">${fmt(operationalBalance)}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding-right:8px;vertical-align:top;">
          <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:18px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Despesas Totais</div>
            <div style="font-size:20px;font-weight:800;color:#f1f5f9;">${fmt(expensesTotal)}</div>
            <div style="font-size:11px;color:#64748b;margin-top:6px;">Pagas: ${fmt(expensesPaid)}</div>
            <div style="font-size:11px;color:#f59e0b;">Pendentes: ${fmt(expensesPending)}</div>
          </div>
        </td>
        <td width="50%" style="padding-left:8px;vertical-align:top;">
          <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:18px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">ROI Atual</div>
            <div style="font-size:28px;font-weight:800;color:${roiColor};">${pct(roi)}</div>
          </div>
        </td>
      </tr>
    </table>

    ${dashboardUrl ? `
    <div style="text-align:center;margin-top:24px;">
      <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">
        Ver Painel Financeiro
      </a>
    </div>` : ''}
  `;

  const contentText = `
ATUALIZAÇÃO FINANCEIRA — ${eventName.toUpperCase()}
${periodLabel}

${alertMessage ? `AVISO: ${alertMessage}\n` : ''}

RECEITA CONFIRMADA: ${fmt(revenueConfirmed)}
DESPESAS TOTAIS: ${fmt(expensesTotal)}
  Pagas: ${fmt(expensesPaid)}
  Pendentes: ${fmt(expensesPending)}
SALDO OPERACIONAL: ${fmt(operationalBalance)}
ROI ATUAL: ${pct(roi)}

${dashboardUrl ? `Acesse o painel financeiro: ${dashboardUrl}` : ''}
  `;

  return renderBaseLayout({
    title: `EvoTech Events | Atualização Financeira — ${eventName}`,
    previewText: `Saldo operacional: ${fmt(operationalBalance)} · ROI: ${pct(roi)}`,
    contentHtml,
    contentText,
  });
}

module.exports = renderFinanceUpdateTemplate;
