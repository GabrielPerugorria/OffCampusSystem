'use strict';
const { renderBaseLayout, escapeHtml } = require('./baseTemplate');

/**
 * Template: Alerta de Estoque
 * Usado para notificações imediatas de estoque crítico.
 *
 * @param {object} opts
 * @param {string}  opts.eventName       - Nome do evento relacionado
 * @param {string}  opts.productName     - Nome do produto
 * @param {string}  opts.productEmoji    - Emoji do produto (opcional)
 * @param {number}  opts.stockQuantity   - Quantidade atual em estoque
 * @param {number}  opts.minStock        - Estoque mínimo configurado
 * @param {string}  opts.criticality     - 'low' | 'critical' | 'out'
 * @param {string}  opts.dashboardUrl
 */
function renderStockAlertTemplate({
  eventName,
  productName,
  productEmoji = '',
  stockQuantity = 0,
  minStock = 0,
  criticality = 'low',
  dashboardUrl = '',
}) {
  const n = (v) => Number(v).toLocaleString('pt-BR');

  const levels = {
    low:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)',  label: 'Estoque Baixo',    icon: '⚠️' },
    critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',   label: 'Estoque Crítico',  icon: '🔴' },
    out:      { color: '#dc2626', bg: 'rgba(220,38,38,0.12)',   border: 'rgba(220,38,38,0.4)',   label: 'SEM ESTOQUE',      icon: '🚨' },
  };
  const lv = levels[criticality] || levels.low;

  const contentHtml = `
    <!-- Badge de criticidade -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background-color:${lv.bg};border:1px solid ${lv.border};border-radius:50px;padding:10px 24px;">
        <span style="font-size:16px;">${lv.icon}</span>
        <span style="font-size:13px;font-weight:700;color:${lv.color};text-transform:uppercase;letter-spacing:1px;margin-left:8px;">${lv.label}</span>
      </div>
    </div>

    <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:800;color:#f1f5f9;text-align:center;">
      ${productEmoji ? escapeHtml(productEmoji) + ' ' : ''}${escapeHtml(productName)}
    </h1>
    <p style="margin:0 0 32px 0;font-size:14px;color:#64748b;text-align:center;">${escapeHtml(eventName)}</p>

    <!-- Indicador de estoque -->
    <div style="background-color:#0a0e18;border:2px solid ${lv.border};border-radius:12px;padding:28px;margin-bottom:24px;text-align:center;">
      <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">Quantidade Disponível</div>
      <div style="font-size:48px;font-weight:900;color:${lv.color};line-height:1;">${n(stockQuantity)}</div>
      <div style="font-size:13px;color:#64748b;margin-top:8px;">Estoque mínimo configurado: ${n(minStock)}</div>
    </div>

    <!-- Orientação -->
    <div style="background-color:#0f1523;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:12px;color:#94a3b8;line-height:1.6;">
        ${criticality === 'out'
          ? '🚨 Este produto está esgotado. Acesse o painel administrativo para registrar uma nova entrada ou arquivar o produto.'
          : '⚠️ O estoque está abaixo do nível mínimo. Avalie a necessidade de reposição antes do evento.'}
      </div>
    </div>

    ${dashboardUrl ? `
    <div style="text-align:center;">
      <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:12px 28px;background-color:${lv.color};color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;">
        Gerenciar Estoque
      </a>
    </div>` : ''}
  `;

  const contentText = `
⚠️ ${lv.label.toUpperCase()} — ${productName}
Evento: ${eventName}

QUANTIDADE DISPONÍVEL: ${n(stockQuantity)}
ESTOQUE MÍNIMO: ${n(minStock)}
CRITICIDADE: ${lv.label}

${criticality === 'out'
    ? 'Este produto está esgotado. Acesse o painel para registrar entrada ou arquivar o produto.'
    : 'O estoque está abaixo do nível mínimo. Avalie a necessidade de reposição.'}

${dashboardUrl ? `Gerenciar estoque: ${dashboardUrl}` : ''}
  `;

  return renderBaseLayout({
    title: `EvoTech Events | Atenção ao Estoque — ${eventName}`,
    previewText: `${lv.icon} ${productName}: ${n(stockQuantity)} unidades disponíveis (mín: ${n(minStock)})`,
    contentHtml,
    contentText,
  });
}

module.exports = renderStockAlertTemplate;
