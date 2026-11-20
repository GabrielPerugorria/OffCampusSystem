'use strict';
const { renderBaseLayout, escapeHtml } = require('./baseTemplate');

/**
 * Template: Meta Atingida
 * Usado para notificações imediatas quando uma meta é atingida.
 *
 * @param {object} opts
 * @param {string}  opts.eventName       - Nome do evento
 * @param {string}  opts.goalType        - 'revenue' | 'sales' | 'attendance' | 'breakeven'
 * @param {string}  opts.goalLabel       - Descrição da meta ("Meta de Faturamento", etc.)
 * @param {number}  opts.goalValue       - Valor alvo da meta
 * @param {number}  opts.currentValue    - Valor atual atingido
 * @param {number}  opts.progressPct     - % atingido (pode passar de 100%)
 * @param {string}  opts.valuePrefix     - Prefixo do valor ('R$' para receita, '' para qtd)
 * @param {string}  opts.dashboardUrl
 */
function renderGoalReachedTemplate({
  eventName,
  goalType = 'revenue',
  goalLabel = 'Meta Atingida',
  goalValue = 0,
  currentValue = 0,
  progressPct = 100,
  valuePrefix = 'R$',
  dashboardUrl = '',
}) {
  const fmt = (v) => Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: goalType === 'revenue' ? 2 : 0,
    maximumFractionDigits: goalType === 'revenue' ? 2 : 0,
  });
  const pct = (v) => `${Number(v).toFixed(1)}%`;

  const excessPct = Math.max(0, progressPct - 100);

  const contentHtml = `
    <!-- Celebração -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;line-height:1;margin-bottom:12px;">🎯</div>
      <div style="display:inline-block;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.15));border:1px solid rgba(16,185,129,0.4);border-radius:50px;padding:10px 24px;">
        <span style="font-size:13px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:1px;">Meta Atingida!</span>
      </div>
    </div>

    <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:800;color:#f1f5f9;text-align:center;">
      ${escapeHtml(goalLabel)}
    </h1>
    <p style="margin:0 0 32px 0;font-size:14px;color:#64748b;text-align:center;">${escapeHtml(eventName)}</p>

    <!-- Resultado principal -->
    <div style="background:linear-gradient(135deg,rgba(16,185,129,0.08),rgba(5,150,105,0.05));border:2px solid rgba(16,185,129,0.3);border-radius:12px;padding:28px;margin-bottom:20px;text-align:center;">
      <div style="font-size:11px;font-weight:600;color:#10b981;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Resultado Atual</div>
      <div style="font-size:40px;font-weight:900;color:#10b981;line-height:1;">${valuePrefix}${fmt(currentValue)}</div>
      <div style="font-size:14px;color:#64748b;margin-top:8px;">Meta: ${valuePrefix}${fmt(goalValue)}</div>
    </div>

    <!-- % atingido -->
    <div style="background-color:#0a0e18;border:1px solid #1e293b;border-radius:10px;padding:18px;margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:12px;color:#64748b;">Progresso</span>
        <span style="font-size:14px;font-weight:700;color:#10b981;">${pct(progressPct)}</span>
      </div>
      <div style="background-color:#1e293b;border-radius:4px;height:10px;overflow:hidden;">
        <div style="height:100%;width:${Math.min(100, progressPct)}%;background:linear-gradient(90deg,#059669,#10b981);border-radius:4px;"></div>
      </div>
      ${excessPct > 0 ? `<div style="font-size:12px;color:#34d399;margin-top:8px;">🚀 Superou a meta em ${pct(excessPct)}!</div>` : ''}
    </div>

    ${dashboardUrl ? `
    <div style="text-align:center;">
      <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">
        Ver Resultados Completos
      </a>
    </div>` : ''}
  `;

  const contentText = `
🎯 META ATINGIDA — ${eventName.toUpperCase()}

${goalLabel.toUpperCase()}

RESULTADO ATUAL: ${valuePrefix}${fmt(currentValue)}
META: ${valuePrefix}${fmt(goalValue)}
PROGRESSO: ${pct(progressPct)}
${excessPct > 0 ? `Superou a meta em ${pct(excessPct)}!` : ''}

${dashboardUrl ? `Ver resultados completos: ${dashboardUrl}` : ''}
  `;

  return renderBaseLayout({
    title: `EvoTech Events | Meta Atingida — ${eventName}`,
    previewText: `🎯 ${goalLabel}: ${pct(progressPct)} atingido (${valuePrefix}${fmt(currentValue)})`,
    contentHtml,
    contentText,
  });
}

module.exports = renderGoalReachedTemplate;
