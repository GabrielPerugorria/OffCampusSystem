'use strict';

function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Converte para número finito; qualquer outra coisa vira o fallback.
   Garante que valores vindos da API/localStorage nunca carreguem texto
   para dentro de templates HTML, atributos ou estilos inline. */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* Lookup em mapa literal sem herdar chaves de Object.prototype
   (ex.: status === 'constructor'). */
function pick(map, key, fallback) {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;
}

function sanitizeURL(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/i.test(s) && !s.includes(':')) return s;
  return '';
}

/* Atualiza ícones Lucide no DOM dinamicamente */
function refreshIcons() {
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

/* Ícones vetoriais SVG corporativos (Substitutos profissionais de Emojis) */
const SVG_ICONS = {
  edit: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  alert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  emptyCalendar: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  emptyUsers: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
  emptyContacts: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  mail: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  phone: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  ticket: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7v13"/><path d="M16 7v13"/></svg>',
};

/* Preservação rigorosa da rolagem e scroll lock nos modais */
const ModalScrollLock = {
  savedY: 0,
  locks: 0,
  lock() {
    this.locks += 1;
    if (this.locks > 1) return;
    this.savedY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.savedY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
  },
  unlock() {
    if (this.locks <= 0) return;
    this.locks -= 1;
    if (this.locks > 0) return;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    window.scrollTo({ top: this.savedY, left: 0, behavior: 'instant' });
  }
};

/* ============================================================
   CAMADA DE DADOS
   Antes: todo o painel vivia em localStorage['evotech_admin'].
   Agora: os dados vêm da API. O objeto STATE mantém EXATAMENTE o
   mesmo formato de antes, então as funções de renderização abaixo
   (renderDashboard, renderEventos, renderBar, ...) não mudaram.
   ============================================================ */

/* Único uso restante do localStorage: preferências de tela do próprio
   operador (modo contingência e as premissas de unit economics).
   Nenhum dado de negócio é guardado no navegador. */
const UI = {
  get() {
    try { return JSON.parse(localStorage.getItem('evotech_ui')) || {}; } catch { return {}; }
  },
  set(v) { try { localStorage.setItem('evotech_ui', JSON.stringify(v)); } catch { } },
};

function fmt(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function sanitizeUnitEcon(ue) {
  const base = { cac: 850, churn: 4, take: 6 };
  if (!ue || typeof ue !== 'object') return base;
  return { cac: num(ue.cac, base.cac), churn: num(ue.churn, base.churn), take: num(ue.take, base.take) };
}

function estadoVazio() {
  const ui = UI.get();
  return {
    eventos: [], bar: [], despesas: [], entries: [],
    participantes: [], contatos: [], equipe: [], auditLog: [],
    sistema: {
      modoContingencia: !!ui.modoContingencia,
      ultimoBackup: num(ui.ultimoBackup, Date.now()) || Date.now(),
      uptimeStart: num(ui.uptimeStart, Date.now()) || Date.now(),
    },
    unitEcon: sanitizeUnitEcon(ui.unitEcon),
  };
}

let STATE = estadoVazio();
let selectedEventoIdx = null;
let selectedEventoId = null;   // id estável: sobrevive à reordenação vinda da API
let carregando = false;

/* ---------- Tradutores API -> formato usado pelas telas ---------- */
const PERFIL_LABEL = {
  owner: 'Admin', admin: 'Admin', finance: 'Financeiro',
  gate: 'Operador Portaria', bar: 'Operador Bar',
};
const PERFIL_ROLE = {
  'Admin': 'admin', 'Financeiro': 'finance',
  'Operador Portaria': 'gate', 'Operador Bar': 'bar', 'Visualizador': 'gate',
};

const STATUS_EVENTO_UI = { draft: 'em_breve', upcoming: 'em_breve', active: 'ativo', sold_out: 'esgotado', closed: 'encerrado' };

function mapEvento(e) {
  const dataISO = e.eventDate ? String(e.eventDate).slice(0, 10) : '';
  return {
    id: e.id,
    nome: String(e.name ?? ''),
    tipo: String(e.type || ''),
    data: /^\d{4}-\d{2}-\d{2}$/.test(dataISO) ? dataISO : '',
    local: String(e.venue || ''),
    capacidade: num(e.capacity),
    status: pick(STATUS_EVENTO_UI, e.status, 'ativo'),
    statusApi: e.status,
    desc: String(e.description || ''),
    regras: String(e.rules || ''),
    metaPublico: num(e.goalAttendance),
    metaFaturamento: num(e.goalRevenue),
    sold: num(e.sold),
    revenue: num(e.revenue),
    checkins: num(e.checkins),
    lotes: (e.batches || []).map(b => ({
      id: b.id, nome: String(b.name ?? ''), preco: num(b.price),
      disponivel: num(b.available), total: num(b.quantityTotal),
      sold: num(b.quantitySold),
    })),
  };
}

const STATUS_API = { ativo: 'active', em_breve: 'upcoming', esgotado: 'sold_out', encerrado: 'closed' };

async function carregarDados() {
  if (carregando) return;
  carregando = true;
  try {
    const [eventos, produtos, despesas, checkins, participantes, contatos, equipe, auditoria] =
      await Promise.all([
        EvoAPI.get('/events'),
        EvoAPI.get('/products'),
        // Só owner/admin/financeiro enxergam despesas; portaria e bar recebem 403.
        // Isso não pode derrubar o painel inteiro nem encerrar a sessão.
        EvoAPI.get('/expenses').catch(err => { if (err.status === 403) return []; throw err; }),
        EvoAPI.get('/checkins'),
        EvoAPI.get('/participants', { limit: 200 }),
        EvoAPI.get('/contacts'),
        EvoAPI.get('/team').catch(() => []),        // só owner/admin enxerga
        EvoAPI.get('/audit-logs', { limit: 200 }).catch(() => []),
      ]);

    const ui = UI.get();
    STATE = {
      eventos: eventos.map(mapEvento),
      bar: produtos.map(p => ({
        id: p.id, nome: String(p.name ?? ''), emoji: String(p.emoji || ''), cat: String(p.category ?? ''),
        custo: num(p.unitCost), estoque: num(p.stockQuantity), minimo: num(p.minStock),
      })),
      despesas: despesas.map(d => ({
        id: d.id,
        cat: `${d.category_icon || ''} ${d.category_name ?? ''}`.trim(),
        catId: d.category_id,
        desc: String(d.description || ''),
        valor: Number(d.amount),
        eventId: d.event_id,
      })),
      entries: (checkins.rows || []).map(c => ({
        id: c.id, nome: String(c.guest_name ?? ''), codigo: String(c.code || ''),
        evento: String(c.event_name ?? ''), hora: fmt(new Date(c.checked_in_at)),
      })),
      participantes: participantes.map(p => ({
        userId: p.id, nome: String(p.name ?? ''), email: String(p.email ?? ''),
        cpf: String(p.cpf || '—'), tel: String(p.phone || '—'),
        ingressos: num(p.tickets),
        status: p.status === 'blocked' ? 'bloqueado' : 'ativo',
        semCadastro: p.status === 'guest',
      })),
      contatos: contatos.map(c => ({
        id: c.id, nome: String(c.name ?? ''), cargo: String(c.roleTitle || ''), email: String(c.email || ''),
        tel: String(c.phone || ''), cat: String(c.category ?? ''), valor: num(c.fee), obs: String(c.notes || ''),
      })),
      equipe: equipe.map(m => ({
        id: m.id, nome: String(m.name ?? ''), email: String(m.email ?? ''),
        perfil: String(pick(PERFIL_LABEL, m.role, m.role ?? '')),
        role: m.role,
        status: m.status === 'active' ? 'ativo' : 'inativo',
      })),
      auditLog: auditoria.slice().reverse().map(l => ({
        hora: new Date(l.hora).toLocaleString('pt-BR'),
        usuario: String(l.usuario ?? ''), acao: String(l.acao ?? ''),
      })),
      sistema: {
        modoContingencia: !!ui.modoContingencia,
        ultimoBackup: num(ui.ultimoBackup, Date.now()) || Date.now(),
        uptimeStart: num(ui.uptimeStart, Date.now()) || Date.now(),
      },
      unitEcon: sanitizeUnitEcon(ui.unitEcon),
    };
  } catch (err) {
    // Só 401 (sessão inválida/expirada) encerra a sessão. 403 é falta de permissão
    // para algum recurso: mantém o painel aberto (com o botão Sair) e avisa.
    if (err.status === 401) {
      EvoAPI.store.clearAuth();
      window.location.replace('index.html');
      return;
    }
    toast(`Falha ao carregar os dados: ${err.message}`, 'error');
  } finally {
    carregando = false;
  }
}

// Recarrega do servidor e redesenha. É o que cada ação chama depois de salvar.
async function atualizar() {
  await carregarDados();
  renderAll();
}

// Envolve uma ação de escrita: trata o erro e recarrega os dados.
async function acao(fn, mensagemSucesso) {
  try {
    const resultado = await fn();
    await atualizar();
    if (mensagemSucesso) toast(mensagemSucesso, 'success');
    return resultado;
  } catch (err) {
    toast(err.message, 'error');
    return null;
  }
}

/* saveState/logAudit continuam existindo para não quebrar chamadas antigas.
   A persistência agora é da API e a auditoria é gravada pelo servidor,
   com o autor real de cada ação. */
function saveState() { /* a API é a fonte da verdade */ }
function logAudit() { /* auditoria registrada no servidor */ }

/* ===== SESSÃO / LOGOUT ===== */
function getSession() { return EvoAPI.session(); }

function initAdminInfo() {
  const session = getSession();
  if (!session) return;
  const initials = session.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  document.getElementById('admin-avatar').textContent = initials || 'A';
  document.getElementById('admin-name').textContent = session.nome;
}

async function adminLogout() {
  await EvoAPI.logout();
  window.location.href = 'index.html';
}

initAdminInfo();

/* ===== NAV ===== */
const panels = {
  dashboard: { title:'Dashboard', sub:'Visão geral em tempo real', action:'+ Novo Evento', fn:'openModalEvento' },
  eventos:   { title:'Eventos', sub:'Gerencie eventos e lotes de ingresso', action:'+ Novo Evento', fn:'openModalEvento' },
  pedidos:   { title:'Pedidos & Ingressos', sub:'Auditoria, confirmação manual e histórico transacional de compras', action:null },
  bar:       { title:'Open Bar', sub:'Controle de estoque e itens', action:'+ Adicionar Item', fn:'openModalBarItem' },
  portaria:  { title:'Portaria', sub:'Registro de entradas', action:null },
  financeiro:{ title:'Financeiro', sub:'Receitas e despesas', action:'+ Nova Despesa', fn:'openModalDespesa' },
  participantes:{ title:'Participantes', sub:'Todos os compradores', action:null },
  contatos:  { title:'Contatos', sub:'Fornecedores, artistas e equipe', action:'+ Novo Contato', fn:'openModalContato' },
  metas:     { title:'Metas & ROI', sub:'Objetivos de público e faturamento, ROI e break-even por evento', action:null },
  comparativo:{ title:'Comparativo & IA', sub:'Ranking de eventos, insights automáticos e heatmap de entradas', action:null },
  unitecon:  { title:'Unit Economics', sub:'CAC, LTV, Churn, ARPU, GMV e Take Rate', action:null },
  relatorios:{ title:'Relatórios', sub:'Central de exportação e relatório executivo', action:null },
  equipe:    { title:'Equipe & Permissões', sub:'Controle de acesso por perfil', action:'+ Novo Membro', fn:'openModalEquipe' },
  auditoria: { title:'Auditoria', sub:'Histórico de ações realizadas no sistema', action:null },
  sistema:   { title:'Sistema & Contingência', sub:'Estabilidade, modo offline e backups', action:null },
};

function goPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-'+id)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[onclick="goPanel('${id}')"]`)?.classList.add('active');

  const cfg = panels[id] || {};
  document.getElementById('topbar-title').textContent = cfg.title || id;
  document.getElementById('topbar-sub').textContent = cfg.sub || '';
  const btn = document.getElementById('topbar-action');
  if(cfg.action) { btn.textContent = cfg.action; btn.classList.remove('is-hidden'); btn.onclick = window[cfg.fn] || null; }
  else btn.classList.add('is-hidden');

  if (id === 'pedidos') {
    carregarPedidosAdmin();
  } else {
    atualizar();
  }
}

function openPrimaryAction() { /* handled per-panel */ }

/* ===== RENDER ALL ===== */
function renderAll() {
  // A API pode devolver os eventos em outra ordem; reencontra o selecionado.
  if (selectedEventoId !== null) {
    const novoIdx = STATE.eventos.findIndex(e => e.id === selectedEventoId);
    selectedEventoIdx = novoIdx >= 0 ? novoIdx : null;
    if (selectedEventoIdx === null) {
      selectedEventoId = null;
      const sec = document.getElementById('lotes-section');
      if (sec) sec.style.display = 'none';
    }
  }
  renderDashboard();
  renderEventos();
  renderBar();
  renderPortaria();
  renderFinanceiro();
  renderParticipantes();
  renderContatos();
  renderMetas();
  renderComparativo();
  renderUnitEconomics();
  renderEquipe();
  renderAuditoria();
  renderSistema();
  if (selectedEventoIdx !== null) renderLotes();
  refreshIcons();
}

/* ===== DASHBOARD ===== */
function renderDashboard() {
  renderCountdown();
  renderAlertasCentral();
  renderFunilDashboard();
  renderProjecaoDashboard();

  // === EMPTY STATE: organização sem eventos ===
  if (STATE.eventos.length === 0) {
    document.getElementById('kpi-grid').innerHTML = `
      <div class="kpi-cockpit">
        <div class="kpi-hero-billboard" style="text-align:center; padding:48px 24px;">
          <div style="margin-bottom:16px;"><i data-lucide="calendar-plus" style="width:48px;height:48px;color:var(--accent);opacity:.7"></i></div>
          <div style="font-size:20px; font-weight:700; color:var(--text1); margin-bottom:8px;">Você ainda não possui eventos cadastrados</div>
          <div style="font-size:14px; color:var(--text2); margin-bottom:20px; max-width:400px; margin-left:auto; margin-right:auto;">Crie seu primeiro evento para começar a acompanhar vendas, receita, portaria e todos os indicadores operacionais.</div>
          <button class="btn btn-primary" onclick="openModalEvento()" style="font-size:14px; padding:10px 28px;">
            <i data-lucide="plus" style="width:16px;height:16px;margin-right:6px"></i> Criar primeiro evento
          </button>
        </div>
        <div class="kpi-pulse-column">
          <div class="kpi-pulse-card">
            <div class="kpi-pulse-header">
              <div class="kpi-pulse-icon"><i data-lucide="ticket"></i></div>
              <div><span class="kpi-pulse-label">Ingressos Emitidos</span><div class="kpi-pulse-number">—</div></div>
            </div>
            <div class="kpi-pulse-footer"><span>Sem dados</span></div>
          </div>
          <div class="kpi-pulse-card">
            <div class="kpi-pulse-header">
              <div class="kpi-pulse-icon"><i data-lucide="scan-line"></i></div>
              <div><span class="kpi-pulse-label">Portaria &amp; Acesso</span><div class="kpi-pulse-number">—</div></div>
            </div>
            <div class="kpi-pulse-footer"><span>Sem dados</span></div>
          </div>
          <div class="kpi-pulse-card">
            <div class="kpi-pulse-header">
              <div class="kpi-pulse-icon"><i data-lucide="calendar"></i></div>
              <div><span class="kpi-pulse-label">Eventos Ativos</span><div class="kpi-pulse-number">0</div></div>
            </div>
            <div class="kpi-pulse-footer"><span>Nenhum evento cadastrado</span></div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('dash-events-bars').innerHTML = '<div style="color:var(--text3);font-size:12px;padding:10px">Nenhum evento para exibir ocupação.</div>';
    document.getElementById('dash-bar-levels').innerHTML = STATE.bar.length === 0
      ? '<div style="color:var(--text3);font-size:12px;padding:10px">Nenhum produto de bar cadastrado.</div>'
      : '';
    document.getElementById('dash-entries-label').textContent = '0 pessoa(s) registrada(s)';
    document.getElementById('dash-entry-log').innerHTML = '<div class="empty"><p style="color:var(--text2)">Nenhuma entrada registrada</p></div>';
    document.getElementById('dash-expenses').innerHTML = STATE.despesas.length === 0
      ? '<div style="color:var(--text3);font-size:12px;padding:10px">Nenhuma despesa registrada.</div>'
      : '';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    // Still render bar levels and expenses if they exist (org-level, not event-level)
    if (STATE.bar.length > 0) {
      document.getElementById('dash-bar-levels').innerHTML = STATE.bar.map(item => {
        const pct = item.minimo > 0 ? Math.round((item.estoque / (item.minimo * 4)) * 100) : 100;
        const pctClamped = Math.min(Math.max(pct, 5), 100);
        const col = item.estoque < item.minimo ? 'red' : item.estoque < item.minimo * 2 ? 'yellow' : 'green';
        return `<div class="progress-row">
          <div class="progress-label">${escapeHTML(item.nome.substring(0, 20))} <span style="font-size:10px; color:var(--text3)">[${escapeHTML(item.cat)}]</span></div>
          <div class="progress-track"><div class="progress-fill ${col}" style="width:${pctClamped}%"></div></div>
          <div class="progress-val">${item.estoque} un</div>
        </div>`;
      }).join('');
    }
    if (STATE.despesas.length > 0) {
      const max = Math.max(...STATE.despesas.map(x => x.valor), 1);
      document.getElementById('dash-expenses').innerHTML = STATE.despesas.map(d => {
        const pct = Math.round((d.valor / max) * 100);
        const catName = d.cat.replace(/[^\w\s\u00C0-\u00FF/]/g, '').trim();
        return `<div class="progress-row">
          <div class="progress-label">${escapeHTML(catName.substring(0, 20))}</div>
          <div class="progress-track"><div class="progress-fill purple" style="width:${pct}%"></div></div>
          <div class="progress-val">${fmt_brl(d.valor)}</div>
        </div>`;
      }).join('');
    }
    return;
  }

  // Dados reais consolidados da API
  const totalVendidos = STATE.eventos.reduce((acc, ev) => acc + (ev.sold !== undefined ? ev.sold : ev.lotes.reduce((a, l) => a + (l.sold || 0), 0)), 0);
  const totalReceita = STATE.eventos.reduce((acc, ev) => acc + (ev.revenue !== undefined ? ev.revenue : 0), 0);
  const totalDespesas = STATE.despesas.reduce((a, d) => a + d.valor, 0);
  const totalEntradas = STATE.entries.length;

  const ticketMedioGeral = totalVendidos > 0 ? totalReceita / totalVendidos : 0;
  const saldoOperacional = totalReceita - totalDespesas;
  const roiGeral = totalDespesas > 0 ? ((totalReceita - totalDespesas) / totalDespesas * 100) : 0;
  const margemGeral = totalReceita > 0 ? ((totalReceita - totalDespesas) / totalReceita * 100) : 0;

  const totalEventosAtivos = STATE.eventos.filter(e => e.status === 'ativo').length;
  const totalEventosCadastrados = STATE.eventos.length;

  const taxaCheckin = totalVendidos > 0 ? Math.round((totalEntradas / totalVendidos) * 100) : 0;
  const saldoClass = saldoOperacional >= 0 ? 'text-accent' : 'text-red';
  const saldoSinal = saldoOperacional >= 0 ? '+' : '';
  const custoPct = totalReceita > 0 ? Math.min(Math.round((totalDespesas / totalReceita) * 100), 100) : 0;
  const lucroPct = Math.max(0, 100 - custoPct);

  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi-cockpit">
      <!-- Bloco Primário: Faturamento & Performance Financeira -->
      <div class="kpi-hero-billboard">
        <div class="kpi-hero-header">
          <div class="kpi-hero-meta">
            <span class="kpi-badge-live"><i data-lucide="circle-dot"></i> Caixa Central</span>
            <span class="kpi-hero-title">Faturamento &amp; Resultado Líquido</span>
          </div>
          <div class="kpi-hero-status ${saldoOperacional >= 0 ? 'is-positive' : 'is-negative'}">
            ${saldoSinal}${margemGeral.toFixed(1)}% Margem
          </div>
        </div>
        
        <div class="kpi-hero-metrics">
          <div class="kpi-hero-main">
            <span class="kpi-metric-label">Receita Confirmada</span>
            <div class="kpi-metric-number">${fmt_brl(totalReceita)}</div>
            <span class="kpi-metric-sub">Vendas de ingressos e lotes integrados</span>
          </div>
          
          <div class="kpi-hero-subgrid">
            <div class="kpi-subitem">
              <span class="kpi-subitem-label">Saldo Operacional</span>
              <div class="kpi-subitem-val ${saldoClass}">${fmt_brl(saldoOperacional)}</div>
              <span class="kpi-subitem-desc">Receita líquida após deduções</span>
            </div>
            <div class="kpi-subitem">
              <span class="kpi-subitem-label">Despesas Totais</span>
              <div class="kpi-subitem-val text-yellow">${fmt_brl(totalDespesas)}</div>
              <span class="kpi-subitem-desc">Custos diretos, equipe e bar</span>
            </div>
            <div class="kpi-subitem">
              <span class="kpi-subitem-label">Retorno Operacional (ROI)</span>
              <div class="kpi-subitem-val ${roiGeral >= 0 ? 'text-accent' : 'text-red'}">${roiGeral.toFixed(1)}%</div>
              <span class="kpi-subitem-desc">Eficiência do capital investido</span>
            </div>
            <div class="kpi-subitem">
              <span class="kpi-subitem-label">Ticket Médio</span>
              <div class="kpi-subitem-val">${fmt_brl(ticketMedioGeral)}</div>
              <span class="kpi-subitem-desc">Consumo médio por ingresso</span>
            </div>
          </div>
        </div>

        <div class="kpi-composition-bar">
          <div class="kpi-comp-track">
            <div class="kpi-comp-fill is-revenue" style="width:${lucroPct}%" title="Lucro líquido: ${lucroPct}%"></div>
            <div class="kpi-comp-fill is-cost" style="width:${custoPct}%" title="Despesas: ${custoPct}%"></div>
          </div>
          <div class="kpi-comp-legend">
            <span><i class="dot is-green"></i> Lucro Líquido (${lucroPct}%)</span>
            <span><i class="dot is-yellow"></i> Despesas Operacionais (${custoPct}%)</span>
          </div>
        </div>
      </div>

      <!-- Bloco Secundário: Pulso Operacional & Campo -->
      <div class="kpi-pulse-column">
        <div class="kpi-pulse-card">
          <div class="kpi-pulse-header">
            <div class="kpi-pulse-icon"><i data-lucide="ticket"></i></div>
            <div>
              <span class="kpi-pulse-label">Ingressos Emitidos</span>
              <div class="kpi-pulse-number">${totalVendidos.toLocaleString('pt-BR')}</div>
            </div>
          </div>
          <div class="kpi-pulse-footer">
            <span>Vendas confirmadas</span>
            <span class="kpi-pill-accent">${totalEventosAtivos} ativo(s)</span>
          </div>
        </div>

        <div class="kpi-pulse-card">
          <div class="kpi-pulse-header">
            <div class="kpi-pulse-icon"><i data-lucide="scan-line"></i></div>
            <div>
              <span class="kpi-pulse-label">Portaria &amp; Acesso</span>
              <div class="kpi-pulse-number">${totalEntradas}</div>
            </div>
          </div>
          <div class="kpi-pulse-footer">
            <span>Taxa de entrada: ${taxaCheckin}%</span>
            <span class="kpi-pill-sub">${totalEntradas}/${totalVendidos} no local</span>
          </div>
        </div>

        <div class="kpi-pulse-card">
          <div class="kpi-pulse-header">
            <div class="kpi-pulse-icon"><i data-lucide="calendar"></i></div>
            <div>
              <span class="kpi-pulse-label">Eventos Ativos</span>
              <div class="kpi-pulse-number">${totalEventosAtivos}</div>
            </div>
          </div>
          <div class="kpi-pulse-footer">
            <span>${totalEventosCadastrados} edições no total</span>
            <span class="kpi-pill-sub">Status: Em operação</span>
          </div>
        </div>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Ocupação percentual por evento
  const evBars = document.getElementById('dash-events-bars');
  if (STATE.eventos.length === 0) {
    evBars.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:10px">Nenhum evento para exibir ocupação.</div>';
  } else {
    evBars.innerHTML = STATE.eventos.map(ev => {
    const vendidos = ev.sold !== undefined ? ev.sold : ev.lotes.reduce((a, l) => a + (l.sold || 0), 0);
    const pct = ev.capacidade > 0 ? Math.round((vendidos / ev.capacidade) * 100) : 0;
    const col = pct >= 90 ? 'red' : pct >= 50 ? 'yellow' : 'green';
    return `<div class="progress-row">
      <div class="progress-label" title="${escapeHTML(ev.nome)}">${escapeHTML(ev.nome.substring(0, 24))}${ev.nome.length > 24 ? '…' : ''}</div>
      <div class="progress-track"><div class="progress-fill ${col}" style="width:${Math.min(pct, 100)}%"></div></div>
      <div class="progress-val">${pct}% (${vendidos}/${ev.capacidade})</div>
    </div>`;
  }).join('');
  }

  // Nível de estoque do Bar (sem emojis)
  document.getElementById('dash-bar-levels').innerHTML = STATE.bar.map(item => {
    const pct = item.minimo > 0 ? Math.round((item.estoque / (item.minimo * 4)) * 100) : 100;
    const pctClamped = Math.min(Math.max(pct, 5), 100);
    const col = item.estoque < item.minimo ? 'red' : item.estoque < item.minimo * 2 ? 'yellow' : 'green';
    return `<div class="progress-row">
      <div class="progress-label">${escapeHTML(item.nome.substring(0, 20))} <span style="font-size:10px; color:var(--text3)">[${escapeHTML(item.cat)}]</span></div>
      <div class="progress-track"><div class="progress-fill ${col}" style="width:${pctClamped}%"></div></div>
      <div class="progress-val">${item.estoque} un</div>
    </div>`;
  }).join('');

  // Entradas da portaria (sem emojis)
  const log = document.getElementById('dash-entry-log');
  document.getElementById('dash-entries-label').textContent = `${STATE.entries.length} pessoa(s) registrada(s)`;
  if (STATE.entries.length === 0) {
    log.innerHTML = '<div class="empty"><p style="color:var(--text2)">Nenhuma entrada registrada até o momento</p></div>';
  } else {
    log.innerHTML = [...STATE.entries].reverse().slice(0, 5).map(e => `
      <div class="entry-row">
        <span class="time">${escapeHTML(e.hora)}</span>
        <span class="name">${escapeHTML(e.nome)}</span>
        <span class="badge badge-purple">${escapeHTML(e.evento.substring(0, 16))}</span>
      </div>`).join('');
  }

  // Despesas por categoria (sem emojis)
  document.getElementById('dash-expenses').innerHTML = STATE.despesas.map(d => {
    const max = Math.max(...STATE.despesas.map(x => x.valor), 1);
    const pct = Math.round((d.valor / max) * 100);
    const catName = d.cat.replace(/[^\w\s\u00C0-\u00FF/]/g, '').trim();
    return `<div class="progress-row">
      <div class="progress-label">${escapeHTML(catName.substring(0, 20))}</div>
      <div class="progress-track"><div class="progress-fill purple" style="width:${pct}%"></div></div>
      <div class="progress-val">${fmt_brl(d.valor)}</div>
    </div>`;
  }).join('');
}

/* ===== EVENTOS ===== */
function renderEventos(search='') {
  const q = search.toLowerCase();
  const tbody = document.getElementById('eventos-tbody');
  if (STATE.eventos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty"><div class="empty-icon"><i data-lucide="calendar-days"></i></div><p>Você ainda não possui eventos cadastrados.</p><button class="btn btn-primary btn-sm" onclick="openModalEvento()" style="margin-top:12px"><i data-lucide="plus" style="width:14px;height:14px;margin-right:4px"></i> Cadastrar primeiro evento</button></div></td></tr>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }
  const filtered = STATE.eventos.filter(e => !q || e.nome.toLowerCase().includes(q) || e.local.toLowerCase().includes(q));
  if(filtered.length===0) { tbody.innerHTML=`<tr><td colspan="8"><div class="empty"><div class="empty-icon"><i data-lucide="search-x"></i></div><p>Nenhum evento encontrado para a busca</p></div></td></tr>`; if (typeof lucide !== 'undefined') lucide.createIcons(); return; }

  tbody.innerHTML = filtered.map((ev,i) => {
    const vendidos = ev.lotes.reduce((a,l)=>a+(l.total-l.disponivel),0);
    const receita = ev.lotes.reduce((a,l)=>a+(l.total-l.disponivel)*l.preco,0);
    const idx = STATE.eventos.indexOf(ev);
    const stBadge = pick({ativo:'badge-green',em_breve:'badge-blue',esgotado:'badge-red',encerrado:'badge-yellow'}, ev.status, 'badge-yellow');
    const stLabel = pick({ativo:'Ativo',em_breve:'Em breve',esgotado:'Esgotado',encerrado:'Encerrado'}, ev.status, ev.status);
    return `<tr>
      <td><b>${escapeHTML(ev.nome)}</b><div style="font-size:10px;color:var(--text3)">${escapeHTML(ev.tipo)}</div></td>
      <td>${ev.data !== '' ? new Date(ev.data+'T12:00').toLocaleDateString('pt-BR') : 'A definir'}</td>
      <td>${escapeHTML(ev.local)}</td>
      <td>${ev.capacidade.toLocaleString('pt-BR')}</td>
      <td>${vendidos}</td>
      <td>${fmt_brl(receita)}</td>
      <td><span class="badge ${stBadge}">${escapeHTML(stLabel)}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="verLotes(${idx})" style="margin-right:4px">Lotes</button>
        <button class="btn btn-outline btn-sm" onclick="editEvento(${idx})" style="margin-right:4px"><i data-lucide="pencil"></i></button>
        <button class="btn btn-danger btn-sm" onclick="delEvento(${idx})"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openModalEvento() {
  document.getElementById('evento-edit-idx').value = -1;
  document.getElementById('modal-evento-title').textContent = 'Novo Evento';
  ['ev-nome','ev-data','ev-local','ev-desc','ev-regras'].forEach(id => document.getElementById(id).value='');
  document.getElementById('ev-capacidade').value = '';
  document.getElementById('ev-status').value = 'ativo';
  openModal('modal-evento');
}

function editEvento(idx) {
  const ev = STATE.eventos[idx];
  document.getElementById('evento-edit-idx').value = idx;
  document.getElementById('modal-evento-title').textContent = 'Editar Evento';
  document.getElementById('ev-nome').value = ev.nome;
  document.getElementById('ev-tipo').value = ev.tipo;
  document.getElementById('ev-data').value = ev.data;
  document.getElementById('ev-local').value = ev.local;
  document.getElementById('ev-capacidade').value = ev.capacidade;
  document.getElementById('ev-status').value = ev.status;
  document.getElementById('ev-desc').value = ev.desc;
  document.getElementById('ev-regras').value = ev.regras;
  openModal('modal-evento');
}

async function salvarEvento() {
  const idx = parseInt(document.getElementById('evento-edit-idx').value);
  const payload = {
    name: document.getElementById('ev-nome').value.trim(),
    type: document.getElementById('ev-tipo').value,
    eventDate: document.getElementById('ev-data').value || null,
    venue: document.getElementById('ev-local').value.trim(),
    capacity: parseInt(document.getElementById('ev-capacidade').value) || 0,
    status: STATUS_API[document.getElementById('ev-status').value] || 'active',
    description: document.getElementById('ev-desc').value.trim(),
    rules: document.getElementById('ev-regras').value.trim(),
  };
  if (!payload.name) { toast('Nome do evento obrigatório', 'error'); return; }

  const existente = idx >= 0 ? STATE.eventos[idx] : null;
  if (!existente) {
    // Metas iniciais sugeridas, editáveis depois no painel Metas & ROI.
    payload.goalAttendance = Math.round(payload.capacity * 0.85);
    payload.goalRevenue = Math.round(payload.capacity * 80);
  }

  const ok = await acao(
    () => existente
      ? EvoAPI.put(`/events/${existente.id}`, payload)
      : EvoAPI.post('/events', payload),
    existente ? 'Evento atualizado!' : 'Evento criado!'
  );
  if (ok) closeModal('modal-evento');
}

async function delEvento(idx) {
  const ev = STATE.eventos[idx];
  if (!confirm(`Remover "${ev.nome}"?`)) return;
  const ok = await acao(() => EvoAPI.del(`/events/${ev.id}`), 'Evento removido');
  if (ok && selectedEventoIdx === idx) {
    selectedEventoIdx = null;
    document.getElementById('lotes-section').style.display = 'none';
  }
}

/* ===== LOTES ===== */
function verLotes(idx) {
  selectedEventoIdx = idx;
  selectedEventoId = STATE.eventos[idx]?.id ?? null;
  const ev = STATE.eventos[idx];
  document.getElementById('lotes-title').textContent = `Lotes — ${ev.nome}`;
  document.getElementById('lotes-section').style.display = 'block';
  renderLotes();
  document.getElementById('lotes-section').scrollIntoView({behavior:'smooth'});
}

function renderLotes() {
  if(selectedEventoIdx===null) return;
  const ev = STATE.eventos[selectedEventoIdx];
  const tbody = document.getElementById('lotes-tbody');
  if(!ev.lotes.length) { tbody.innerHTML=`<tr><td colspan="6"><div class="empty"><p>Nenhum lote cadastrado</p></div></td></tr>`; return; }
  tbody.innerHTML = ev.lotes.map((l,i) => {
    const vendidos = l.total - l.disponivel;
    return `<tr>
      <td><b>${escapeHTML(l.nome)}</b></td>
      <td>R$ ${l.preco.toFixed(2).replace('.',',')}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="qty-btn" onclick="alterarDisp(${i},-1)">−</button>
          <span style="min-width:36px;text-align:center">${l.disponivel}</span>
          <button class="qty-btn" onclick="alterarDisp(${i},1)">+</button>
        </div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="qty-btn" onclick="alterarTotal(${i},-1)">−</button>
          <span style="min-width:36px;text-align:center">${l.total}</span>
          <button class="qty-btn" onclick="alterarTotal(${i},1)">+</button>
        </div>
      </td>
      <td>${vendidos} <span style="color:var(--text3);font-size:10px">(${l.total>0?Math.round(vendidos/l.total*100):0}%)</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="editLote(${i})" style="margin-right:4px"><i data-lucide="pencil"></i></button>
        <button class="btn btn-danger btn-sm" onclick="delLote(${i})"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Os botões ± agora conversam com o banco. "Disponível" é derivado
// (total - vendidos), então mexer nele altera a quantidade vendida.
async function alterarDisp(loteIdx, delta) {
  const lote = STATE.eventos[selectedEventoIdx].lotes[loteIdx];
  await acao(() => EvoAPI.patch(`/batches/${lote.id}/stock`, { soldDelta: -delta }));
}

async function alterarTotal(loteIdx, delta) {
  const lote = STATE.eventos[selectedEventoIdx].lotes[loteIdx];
  await acao(() => EvoAPI.patch(`/batches/${lote.id}/stock`, { totalDelta: delta }));
}

function openModalLote() {
  document.getElementById('lote-edit-idx').value = -1;
  document.getElementById('modal-lote-title').textContent = 'Adicionar Lote';
  ['lote-nome','lote-preco','lote-disp','lote-total'].forEach(id => document.getElementById(id).value='');
  openModal('modal-lote');
}

function editLote(idx) {
  const l = STATE.eventos[selectedEventoIdx].lotes[idx];
  document.getElementById('lote-edit-idx').value = idx;
  document.getElementById('modal-lote-title').textContent = 'Editar Lote';
  document.getElementById('lote-nome').value = l.nome;
  document.getElementById('lote-preco').value = l.preco;
  document.getElementById('lote-disp').value = l.disponivel;
  document.getElementById('lote-total').value = l.total;
  openModal('modal-lote');
}

async function salvarLote() {
  if (selectedEventoIdx === null) return;
  const idx = parseInt(document.getElementById('lote-edit-idx').value);
  const evento = STATE.eventos[selectedEventoIdx];
  const nome = document.getElementById('lote-nome').value.trim();
  const preco = parseFloat(document.getElementById('lote-preco').value) || 0;
  const disponivel = parseInt(document.getElementById('lote-disp').value) || 0;
  const total = parseInt(document.getElementById('lote-total').value) || 0;
  if (!nome) { toast('Nome do lote obrigatório', 'error'); return; }
  if (disponivel > total) { toast('Disponível não pode ser maior que o total', 'error'); return; }

  const existente = idx >= 0 ? evento.lotes[idx] : null;
  const payload = { name: nome, price: preco, quantityTotal: total };

  const ok = await acao(async () => {
    if (existente) {
      await EvoAPI.put(`/batches/${existente.id}`, payload);
      // Ajusta os vendidos para bater com o "disponível" informado.
      const vendidosDesejados = total - disponivel;
      const delta = vendidosDesejados - (existente.total - existente.disponivel);
      if (delta !== 0) await EvoAPI.patch(`/batches/${existente.id}/stock`, { soldDelta: delta });
      return true;
    }
    const lote = await EvoAPI.post(`/events/${evento.id}/batches`, {
      ...payload, quantitySold: Math.max(0, total - disponivel),
    });
    return lote;
  }, idx >= 0 ? 'Lote atualizado!' : 'Lote criado!');

  if (ok) { closeModal('modal-lote'); }
}

async function delLote(idx) {
  const lote = STATE.eventos[selectedEventoIdx].lotes[idx];
  if (!confirm(`Remover o lote "${lote.nome}"?`)) return;
  await acao(() => EvoAPI.del(`/batches/${lote.id}`), 'Lote removido');
}

/* ===== BAR ===== */
function renderBar(search='') {
  const q = search.toLowerCase();

  if (STATE.bar.length === 0) {
    document.getElementById('bar-alerts').innerHTML = '';
    document.getElementById('bar-stock-list').innerHTML = '<div style="color:var(--text3);font-size:12px;padding:12px">Nenhum produto cadastrado no estoque do bar.</div>';
    document.getElementById('bar-tbody').innerHTML = `<tr><td colspan="6"><div class="empty"><div class="empty-icon"><i data-lucide="wine"></i></div><p>Nenhum produto cadastrado no estoque do bar.</p><button class="btn btn-primary btn-sm" onclick="openModalBarItem()" style="margin-top:12px"><i data-lucide="plus" style="width:14px;height:14px;margin-right:4px"></i> Adicionar Primeiro Produto</button></div></td></tr>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const filtered = STATE.bar.filter(b => !q || b.nome.toLowerCase().includes(q) || b.cat.toLowerCase().includes(q));

  // Alerts
  const low = STATE.bar.filter(b => b.estoque < b.minimo);
  document.getElementById('bar-alerts').innerHTML = low.map(b =>
    `<div class="alert alert-warning"><i data-lucide="triangle-alert" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i> Estoque baixo: <b>${escapeHTML(b.emoji)} ${escapeHTML(b.nome)}</b> — ${b.estoque} un. (mín: ${b.minimo})</div>`
  ).join('');

  // Stock visual
  document.getElementById('bar-stock-list').innerHTML = filtered.map(item => {
    const pct = Math.min(100, Math.round((item.estoque/(item.minimo*5))*100));
    const col = item.estoque < item.minimo ? 'red' : item.estoque < item.minimo*2 ? 'yellow' : 'green';
    return `<div class="progress-row">
      <div class="progress-label">${escapeHTML(item.emoji)} ${escapeHTML(item.nome.substring(0,18))}</div>
      <div class="progress-track"><div class="progress-fill ${col}" style="width:${pct}%"></div></div>
      <div class="progress-val">${item.estoque}</div>
    </div>`;
  }).join('');

  // Table
  const tbody = document.getElementById('bar-tbody');
  if(!filtered.length) { tbody.innerHTML=`<tr><td colspan="6"><div class="empty"><p>Nenhum item encontrado</p></div></td></tr>`; return; }
  tbody.innerHTML = filtered.map((item) => {
    const idx = STATE.bar.indexOf(item);
    const low = item.estoque < item.minimo;
    return `<tr>
      <td><b>${escapeHTML(item.emoji)} ${escapeHTML(item.nome)}</b></td>
      <td>${escapeHTML(item.cat)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <button class="qty-btn" onclick="alterarBar(${idx},-5)">−5</button>
          <button class="qty-btn" onclick="alterarBar(${idx},-1)">−</button>
          <span style="min-width:36px;text-align:center;font-weight:600">${item.estoque}</span>
          <button class="qty-btn" onclick="alterarBar(${idx},1)">+</button>
          <button class="qty-btn" onclick="alterarBar(${idx},10)">+10</button>
        </div>
      </td>
      <td>R$ ${item.custo.toFixed(2).replace('.',',')}</td>
      <td><span class="badge ${low?'badge-red':'badge-green'}">${low?'Baixo':'OK'}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="editBarItem(${idx})" style="margin-right:4px"><i data-lucide="pencil"></i></button>
        <button class="btn btn-danger btn-sm" onclick="delBarItem(${idx})"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>`;
  }).join('');
}

// Cada ± vira uma movimentação de estoque registrada no banco,
// com autor e motivo — antes era só um número sobrescrito.
async function alterarBar(idx, delta) {
  const item = STATE.bar[idx];
  await acao(() => EvoAPI.post(`/products/${item.id}/movements`, {
    type: delta > 0 ? 'in' : 'out',
    quantity: Math.abs(delta),
    reason: delta > 0 ? 'Reposição pelo painel' : 'Baixa pelo painel',
  }));
}

function openModalBarItem() {
  document.getElementById('bar-edit-idx').value = -1;
  document.getElementById('modal-bar-title').textContent = 'Novo Item do Bar';
  ['bar-nome','bar-emoji','bar-custo','bar-estoque','bar-minimo'].forEach(id=>document.getElementById(id).value='');
  openModal('modal-bar');
}

function editBarItem(idx) {
  const b = STATE.bar[idx];
  document.getElementById('bar-edit-idx').value = idx;
  document.getElementById('modal-bar-title').textContent = 'Editar Item';
  document.getElementById('bar-nome').value = b.nome;
  document.getElementById('bar-emoji').value = b.emoji;
  document.getElementById('bar-cat').value = b.cat;
  document.getElementById('bar-custo').value = b.custo;
  document.getElementById('bar-estoque').value = b.estoque;
  document.getElementById('bar-minimo').value = b.minimo;
  openModal('modal-bar');
}

async function salvarBarItem() {
  const idx = parseInt(document.getElementById('bar-edit-idx').value);
  const payload = {
    name: document.getElementById('bar-nome').value.trim(),
    emoji: document.getElementById('bar-emoji').value.trim(),
    category: document.getElementById('bar-cat').value,
    unitCost: parseFloat(document.getElementById('bar-custo').value) || 0,
    stockQuantity: parseInt(document.getElementById('bar-estoque').value) || 0,
    minStock: parseInt(document.getElementById('bar-minimo').value) || 0,
  };
  if (!payload.name) { toast('Nome obrigatório', 'error'); return; }

  const existente = idx >= 0 ? STATE.bar[idx] : null;
  const ok = await acao(
    () => existente
      ? EvoAPI.put(`/products/${existente.id}`, payload)
      : EvoAPI.post('/products', payload),
    existente ? 'Item atualizado!' : 'Item adicionado!'
  );
  if (ok) closeModal('modal-bar');
}

async function delBarItem(idx) {
  const item = STATE.bar[idx];
  if (!confirm(`Remover "${item.nome}"?`)) return;
  // O item é arquivado, não apagado: as movimentações são histórico de custo.
  await acao(() => EvoAPI.del(`/products/${item.id}`), 'Item removido');
}

/* ===== PORTARIA ===== */
function renderPortaria() {
  // Empty state when no events exist
  if (STATE.eventos.length === 0) {
    const sel = document.getElementById('manual-evento');
    sel.replaceChildren();
    document.getElementById('portaria-total').textContent = '0 pessoa(s) registrada(s)';
    document.getElementById('entry-log').innerHTML = '<div class="empty"><div class="empty-icon"><i data-lucide="scan-line"></i></div><p>Cadastre um evento para utilizar a portaria.</p><button class="btn btn-primary btn-sm" onclick="openModalEvento()" style="margin-top:12px"><i data-lucide="plus" style="width:14px;height:14px;margin-right:4px"></i> Criar evento</button></div>';
    document.getElementById('portaria-count').innerHTML = '';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Populate evento select
  const sel = document.getElementById('manual-evento');
  sel.replaceChildren();
  const optPadrao = document.createElement('option');
  optPadrao.value = '';
  optPadrao.textContent = 'Selecionar evento…';
  sel.appendChild(optPadrao);
  STATE.eventos.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev.nome;
    opt.textContent = ev.nome;
    sel.appendChild(opt);
  });

  // Entry log
  const log = document.getElementById('entry-log');
  document.getElementById('portaria-total').textContent = `${STATE.entries.length} pessoa(s) registrada(s)`;

  if(!STATE.entries.length) {
    log.innerHTML='<div class="empty"><div class="empty-icon"><i data-lucide="scan-line"></i></div><p>Nenhuma entrada ainda</p></div>';
  } else {
    log.innerHTML = [...STATE.entries].reverse().map(e => {
      const codigoBadge = e.codigo ? `<span style="color:var(--text3);font-size:10px">${escapeHTML(e.codigo)}</span>` : '';
      return `
      <div class="entry-row">
        <span class="time">${escapeHTML(e.hora)}</span>
        <span class="name">${escapeHTML(e.nome)}</span>
        <span class="badge badge-purple" style="font-size:9px;max-width:100px;overflow:hidden;text-overflow:ellipsis">${escapeHTML(e.evento.substring(0,14))}</span>
        ${codigoBadge}
      </div>`;
    }).join('');
  }

  // Count per event
  const counts = Object.create(null);   // sem protótipo: nome de evento como chave é dado não confiável
  STATE.entries.forEach(e => { counts[e.evento] = (counts[e.evento]||0)+1; });
  document.getElementById('portaria-count').innerHTML = Object.entries(counts).map(([ev,cnt])=>`
    <div class="progress-row">
      <div class="progress-label" title="${escapeHTML(ev)}">${escapeHTML(ev.substring(0,20))}</div>
      <div class="progress-track"><div class="progress-fill purple" style="width:${Math.min(100,cnt*5)}%"></div></div>
      <div class="progress-val">${cnt}</div>
    </div>`).join('') || '<div style="color:var(--text3);font-size:12px;padding:8px">Sem entradas</div>';
}

// Check-in real: o código é validado contra os ingressos pagos e a
// reentrada é bloqueada pelo banco. Antes, qualquer texto era aceito.
async function registrarEntrada() {
  const codigo = document.getElementById('scan-input').value.trim().toUpperCase();
  if (!codigo) { toast('Digite um código', 'error'); return; }

  const box = document.getElementById('scan-box');
  try {
    const entrada = await EvoAPI.post('/checkins', { code: codigo });
    document.getElementById('scan-input').value = '';
    await atualizar();
    box.style.borderColor = 'var(--green)';
    setTimeout(() => box.style.borderColor = '', 1500);
    toast(`Check-in: ${entrada.guestName} — ${entrada.eventName}`, 'success');
  } catch (err) {
    box.style.borderColor = 'var(--red)';
    setTimeout(() => box.style.borderColor = '', 2500);
    toast(err.message, 'error');
  }
}

async function registrarManual() {
  const nome = document.getElementById('manual-nome').value.trim();
  const nomeEvento = document.getElementById('manual-evento').value;
  if (!nome) { toast('Informe o nome', 'error'); return; }
  if (!nomeEvento) { toast('Selecione o evento', 'error'); return; }

  const evento = STATE.eventos.find(e => e.nome === nomeEvento);
  if (!evento) { toast('Evento não encontrado', 'error'); return; }

  const ok = await acao(
    () => EvoAPI.post('/checkins', { eventId: evento.id, guestName: nome }),
    `${nome} registrado(a)!`
  );
  if (ok) document.getElementById('manual-nome').value = '';
}

document.getElementById('scan-input')?.addEventListener('keydown', e => {
  if(e.key==='Enter') registrarEntrada();
});

/* ===== FINANCEIRO ===== */
function renderFinanceiro() {
  // Show dash (—) for revenue metrics when no events exist
  const hasEvents = STATE.eventos.length > 0;
  const totalVendidos = hasEvents ? STATE.eventos.reduce((acc,ev) =>
    acc + ev.lotes.reduce((a,l)=>a+(l.total-l.disponivel),0), 0) : 0;
  const totalReceita = hasEvents ? STATE.eventos.reduce((acc,ev) =>
    acc + ev.lotes.reduce((a,l)=>a+(l.total-l.disponivel)*l.preco,0), 0) : 0;
  const totalDespesas = STATE.despesas.reduce((a,d)=>a+d.valor,0);

  const receitaDisplay = hasEvents ? fmt_brl(totalReceita) : '—';
  const saldoDisplay = hasEvents ? fmt_brl(totalReceita - totalDespesas) : '—';
  const margemDisplay = hasEvents && totalReceita > 0 ? Math.round(((totalReceita-totalDespesas)/totalReceita)*100) + '%' : '—';

  document.getElementById('fin-kpis').innerHTML = `
    <div class="kpi-card blue"><div class="kpi-label">Receita Total</div><div class="kpi-val">${receitaDisplay}</div><div class="kpi-sub">${hasEvents ? 'Ingressos vendidos' : 'Sem eventos cadastrados'}</div></div>
    <div class="kpi-card red"><div class="kpi-label">Total Despesas</div><div class="kpi-val">${fmt_brl(totalDespesas)}</div></div>
    <div class="kpi-card ${hasEvents && totalReceita-totalDespesas>=0?'green':''}"><div class="kpi-label">Saldo</div><div class="kpi-val" style="color:${!hasEvents ? 'var(--text2)' : totalReceita-totalDespesas>=0?'var(--green)':'var(--red)'}">${saldoDisplay}</div></div>
    <div class="kpi-card"><div class="kpi-label">Margem</div><div class="kpi-val">${margemDisplay}</div></div>
  `;

  const tbody = document.getElementById('fin-tbody');
  tbody.innerHTML = STATE.despesas.map((d,i)=>`<tr>
    <td>${escapeHTML(d.cat)}</td>
    <td>${escapeHTML(d.desc)}</td>
    <td>${fmt_brl(d.valor)}</td>
    <td style="white-space:nowrap">
      <button class="btn btn-outline btn-sm" onclick="editDespesa(${i})" style="margin-right:4px" title="Editar"><i data-lucide="pencil"></i></button>
      <button class="btn btn-danger btn-sm" onclick="delDespesa(${i})" title="Excluir"><i data-lucide="trash-2"></i></button>
    </td>
  </tr>`).join('');

  // Chart
  const max = Math.max(...STATE.despesas.map(d=>d.valor),1);
  document.getElementById('fin-expense-chart').innerHTML = STATE.despesas.map(d=>`
    <div class="progress-row">
      <div class="progress-label">${escapeHTML(d.cat.substring(0,16))}</div>
      <div class="progress-track"><div class="progress-fill purple" style="width:${Math.round((d.valor/max)*100)}%"></div></div>
      <div class="progress-val" style="font-size:10px">${fmt_brl(d.valor)}</div>
    </div>`).join('');
}

function openModalDespesa() {
  document.getElementById('desp-edit-idx').value = -1;
  document.getElementById('modal-despesa-title').textContent = 'Nova Despesa';
  document.getElementById('desp-valor').value='';
  document.getElementById('desp-desc').value='';
  openModal('modal-despesa');
}

function editDespesa(idx) {
  const d = STATE.despesas[idx];
  document.getElementById('desp-edit-idx').value = idx;
  document.getElementById('modal-despesa-title').textContent = 'Editar Despesa';
  document.getElementById('desp-cat').value = d.cat;
  document.getElementById('desp-valor').value = d.valor;
  document.getElementById('desp-desc').value = d.desc;
  openModal('modal-despesa');
}

async function salvarDespesa() {
  const idx = parseInt(document.getElementById('desp-edit-idx').value);
  const catTexto = document.getElementById('desp-cat').value;
  // O select traz "Segurança": separa ícone e nome para a tabela de categorias.
  const partes = catTexto.trim().split(' ');
  const temIcone = partes.length > 1 && !/^[a-zA-ZÀ-ú]/.test(partes[0]);
  const payload = {
    categoryIcon: temIcone ? partes[0] : undefined,
    categoryName: temIcone ? partes.slice(1).join(' ') : catTexto.trim(),
    amount: parseFloat(document.getElementById('desp-valor').value) || 0,
    description: document.getElementById('desp-desc').value.trim(),
  };
  if (!payload.amount) { toast('Informe o valor', 'error'); return; }

  const existente = idx >= 0 ? STATE.despesas[idx] : null;
  const ok = await acao(
    () => existente
      ? EvoAPI.put(`/expenses/${existente.id}`, payload)
      : EvoAPI.post('/expenses', payload),
    existente ? 'Despesa atualizada!' : 'Despesa adicionada!'
  );
  if (ok) closeModal('modal-despesa');
}

async function delDespesa(idx) {
  const despesa = STATE.despesas[idx];
  if (!confirm('Remover esta despesa?')) return;
  await acao(() => EvoAPI.del(`/expenses/${despesa.id}`), 'Despesa removida');
}

/* ===== PARTICIPANTES ===== */
function renderParticipantes(search='') {
  const q = search.toLowerCase();
  const tbody = document.getElementById('part-tbody');

  if (STATE.participantes.length === 0) {
    document.getElementById('part-count').textContent = '0 participante(s)';
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="empty-icon"><i data-lucide="users"></i></div><p>Nenhum participante registrado. As compras de ingressos alimentarão esta lista.</p></div></td></tr>`;
    refreshIcons();
    return;
  }

  const filtered = STATE.participantes.filter(p => !q ||
    p.nome.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.cpf.includes(q));

  document.getElementById('part-count').textContent = `${filtered.length} participante(s)`;
  if(!filtered.length) { tbody.innerHTML=`<tr><td colspan="7"><div class="empty"><div class="empty-icon"><i data-lucide="search-x"></i></div><p>Nenhum participante encontrado para a busca informada.</p></div></td></tr>`; refreshIcons(); return; }

  tbody.innerHTML = filtered.map((p)=>{
    const idx = STATE.participantes.indexOf(p);
    const stBadge = p.status==='ativo'?'badge-green':'badge-red';
    return `<tr>
      <td><b>${escapeHTML(p.nome)}</b></td>
      <td>${escapeHTML(p.email)}</td>
      <td>${escapeHTML(p.cpf)}</td>
      <td>${escapeHTML(p.tel)}</td>
      <td><span class="badge badge-blue">${p.ingressos}</span></td>
      <td><span class="badge ${stBadge}">${p.status==='ativo'?'Ativo':'Bloqueado'}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="togglePart(${idx})">${p.status==='ativo'?'Bloquear':'Ativar'}</button>
      </td>
    </tr>`;
  }).join('');
  refreshIcons();
}

async function togglePart(idx) {
  const p = STATE.participantes[idx];
  if (p.semCadastro) {
    toast('Este comprador não tem cadastro na plataforma (compra sem login).', 'error');
    return;
  }
  const novoStatus = p.status === 'ativo' ? 'blocked' : 'active';
  await acao(
    () => EvoAPI.patch(`/participants/${p.userId}/status`, { status: novoStatus }),
    novoStatus === 'blocked' ? 'Participante bloqueado' : 'Participante reativado'
  );
}

/* ===== CONTATOS ===== */
function renderContatos(search='') {
  const q = search.toLowerCase();
  const grid = document.getElementById('contatos-grid');

  if (STATE.contatos.length === 0) {
    grid.innerHTML = `<div class="empty"><div class="empty-icon"><i data-lucide="book-user"></i></div><p>Nenhum contato ou fornecedor cadastrado.</p><button class="btn btn-primary btn-sm" onclick="openModalContato()" style="margin-top:12px"><i data-lucide="plus" style="width:14px;height:14px;margin-right:4px"></i> Novo Contato</button></div>`;
    refreshIcons();
    return;
  }

  const filtered = STATE.contatos.filter(c=>!q||c.nome.toLowerCase().includes(q)||c.cargo.toLowerCase().includes(q)||c.cat.toLowerCase().includes(q));
  if(!filtered.length) { grid.innerHTML=`<div class="empty"><div class="empty-icon"><i data-lucide="search-x"></i></div><p>Nenhum contato encontrado para a busca</p></div>`; refreshIcons(); return; }

  const catColor = {
    'Artista / DJ':'badge-purple','Segurança':'badge-blue','Fornecedor':'badge-green',
    'Equipe Interna':'badge-yellow','Parceiro':'badge-blue','Outro':'badge-yellow'
  };

  grid.innerHTML = filtered.map(c=>{
    const idx = STATE.contatos.indexOf(c);
    const initials = c.nome.split(' ').filter(Boolean).map(n=>Array.from(n)[0]).slice(0,2).join('').toUpperCase();
    return `<div class="contact-card">
      <div class="contact-avatar">${escapeHTML(initials)}</div>
      <div class="contact-name">${escapeHTML(c.nome)}</div>
      <div class="contact-email" style="margin-bottom:4px"><span class="badge ${pick(catColor, c.cat, 'badge-yellow')}" style="font-size:9px">${escapeHTML(c.cat)}</span> ${escapeHTML(c.cargo)}</div>
      <div class="contact-email"><i data-lucide="mail" style="width:12px;height:12px;vertical-align:middle;margin-right:4px"></i>${escapeHTML(c.email)}</div>
      <div class="contact-tel"><i data-lucide="phone" style="width:12px;height:12px;vertical-align:middle;margin-right:4px"></i>${escapeHTML(c.tel)}</div>
      ${c.valor?`<div style="font-size:11px;color:var(--text3);margin-top:4px"><i data-lucide="wallet" style="width:12px;height:12px;vertical-align:middle;margin-right:4px"></i>${fmt_brl(c.valor)}</div>`:''}
      ${c.obs?`<div style="font-size:11px;color:var(--text3);margin-top:4px;font-style:italic">${escapeHTML(c.obs)}</div>`:''}
      <div class="contact-actions">
        <button class="btn btn-outline btn-sm" onclick="editContato(${idx})" style="display:inline-flex;align-items:center;gap:4px"><i data-lucide="pencil"></i> Editar</button>
        <button class="btn btn-danger btn-sm" onclick="delContato(${idx})" title="Excluir"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`;
  }).join('');
  refreshIcons();
}

function openModalContato() {
  document.getElementById('cont-edit-idx').value = -1;
  document.getElementById('modal-contato-title').textContent = 'Novo Contato';
  ['cont-nome','cont-cargo','cont-email','cont-tel','cont-valor','cont-obs'].forEach(id=>document.getElementById(id).value='');
  openModal('modal-contato');
}

function editContato(idx) {
  const c = STATE.contatos[idx];
  document.getElementById('cont-edit-idx').value = idx;
  document.getElementById('modal-contato-title').textContent = 'Editar Contato';
  document.getElementById('cont-nome').value = c.nome;
  document.getElementById('cont-cargo').value = c.cargo;
  document.getElementById('cont-email').value = c.email;
  document.getElementById('cont-tel').value = c.tel;
  document.getElementById('cont-cat').value = c.cat;
  document.getElementById('cont-valor').value = c.valor||'';
  document.getElementById('cont-obs').value = c.obs||'';
  openModal('modal-contato');
}

async function salvarContato() {
  const idx = parseInt(document.getElementById('cont-edit-idx').value);
  const payload = {
    name: document.getElementById('cont-nome').value.trim(),
    roleTitle: document.getElementById('cont-cargo').value.trim(),
    email: document.getElementById('cont-email').value.trim(),
    phone: document.getElementById('cont-tel').value.trim(),
    category: document.getElementById('cont-cat').value,
    fee: parseFloat(document.getElementById('cont-valor').value) || 0,
    notes: document.getElementById('cont-obs').value.trim(),
  };
  if (!payload.name) { toast('Nome obrigatório', 'error'); return; }

  const existente = idx >= 0 ? STATE.contatos[idx] : null;
  const ok = await acao(
    () => existente
      ? EvoAPI.put(`/contacts/${existente.id}`, payload)
      : EvoAPI.post('/contacts', payload),
    existente ? 'Contato atualizado!' : 'Contato adicionado!'
  );
  if (ok) closeModal('modal-contato');
}

async function delContato(idx) {
  const contato = STATE.contatos[idx];
  if (!confirm(`Remover "${contato.nome}"?`)) return;
  await acao(() => EvoAPI.del(`/contacts/${contato.id}`), 'Contato removido');
}

/* ===== HELPERS DE CÁLCULO (usados em vários painéis) ===== */
function eventoStats(ev) {
  const vendidos = ev.lotes.reduce((a,l)=>a+(l.total-l.disponivel),0);
  const receita = ev.lotes.reduce((a,l)=>a+(l.total-l.disponivel)*l.preco,0);
  const ocupacao = ev.capacidade > 0 ? (vendidos/ev.capacidade)*100 : 0;
  const ticketMedio = vendidos > 0 ? receita/vendidos : 0;
  return { vendidos, receita, ocupacao, ticketMedio };
}
function custoDespesasProporcional() {
  // Custos totais distribuídos proporcionalmente à receita de cada evento (aproximação)
  return STATE.despesas.reduce((a,d)=>a+d.valor,0);
}

/* ===== DASHBOARD: COUNTDOWN, ALERTAS, FUNIL, PROJEÇÃO (chamado dentro de renderDashboard) ===== */
function renderCountdown() {
  const el = document.getElementById('dash-countdown');
  if (!el) return;
  const hoje = new Date();
  const futuros = STATE.eventos
    .filter(ev => ev.data && new Date(ev.data+'T23:59') >= hoje && ev.status !== 'encerrado')
    .sort((a,b) => new Date(a.data) - new Date(b.data));
  if (!futuros.length) { el.innerHTML = ''; return; }
  const ev = futuros[0];
  const diff = Math.max(0, new Date(ev.data+'T23:59') - hoje);
  const dias = Math.floor(diff / 86400000);
  const horas = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const st = eventoStats(ev);
  el.innerHTML = `
    <div class="countdown-card">
      <div class="countdown-info">
        <div class="countdown-label">⏱ Próximo Evento</div>
        <div class="countdown-name">${escapeHTML(ev.nome)}</div>
        <div class="countdown-meta">${escapeHTML(ev.local)} · ${new Date(ev.data+'T12:00').toLocaleDateString('pt-BR')} · ${Math.round(st.ocupacao)}% da capacidade vendida</div>
      </div>
      <div class="countdown-units">
        <div class="countdown-unit"><div class="num">${dias}</div><div class="lbl">dias</div></div>
        <div class="countdown-unit"><div class="num">${horas}</div><div class="lbl">horas</div></div>
        <div class="countdown-unit"><div class="num">${mins}</div><div class="lbl">min</div></div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="goPanel('eventos')">Ver evento</button>
    </div>`;
}

function renderAlertasCentral() {
  const el = document.getElementById('dash-alerts-central');
  if (!el) return;
  const alerts = [];

  // Estoque de bar baixo
  STATE.bar.filter(b => b.estoque < b.minimo).forEach(b => {
    alerts.push({tipo:'warning', lucide:'triangle-alert', title:'Estoque baixo:', text:`${b.nome} está com ${b.estoque} un. (mínimo: ${b.minimo}).`});
  });

  // Orçamento estourado (despesas > receita)
  const totalReceita = STATE.eventos.reduce((a,ev)=>a+eventoStats(ev).receita,0);
  const totalDespesas = STATE.despesas.reduce((a,d)=>a+d.valor,0);
  if (totalDespesas > totalReceita && totalReceita > 0) {
    alerts.push({tipo:'danger', lucide:'alert-octagon', title:'Orçamento:', text:`As despesas (${fmt_brl(totalDespesas)}) já superam a receita registrada (${fmt_brl(totalReceita)}).`});
  } else if (totalReceita > 0 && totalDespesas > totalReceita*0.8) {
    alerts.push({tipo:'warning', lucide:'triangle-alert', title:'Orçamento:', text:`As despesas já consomem ${Math.round(totalDespesas/totalReceita*100)}% da receita registrada.`});
  }

  // Ritmo de vendas abaixo do esperado (eventos próximos com baixa ocupação)
  const hoje = new Date();
  STATE.eventos.forEach(ev => {
    if (!ev.data || ev.status === 'encerrado') return;
    const diasRestantes = Math.ceil((new Date(ev.data+'T23:59') - hoje) / 86400000);
    const st = eventoStats(ev);
    if (diasRestantes >= 0 && diasRestantes <= 14 && st.ocupacao < 50) {
      alerts.push({tipo:'warning', lucide:'trending-down', title:'Ritmo de vendas:', text:`"${ev.nome}" está a ${diasRestantes} dia(s) do evento com apenas ${Math.round(st.ocupacao)}% de ocupação vendida.`});
    }
    if (ev.metaFaturamento && st.receita < ev.metaFaturamento*0.5 && diasRestantes <= 14 && diasRestantes >= 0) {
      alerts.push({tipo:'warning', lucide:'target', title:'Meta em risco:', text:`"${ev.nome}" está a ${Math.round(st.receita/ev.metaFaturamento*100)}% da meta de faturamento faltando ${diasRestantes} dia(s).`});
    }
  });

  // Modo contingência ligado
  if (STATE.sistema?.modoContingencia) {
    alerts.push({tipo:'info', lucide:'radio', title:'Contingência ativa:', text:'O sistema está operando em modo offline/contingência. Dados serão sincronizados automaticamente.'});
  }

  if (!alerts.length) {
    el.innerHTML = `<div class="alert alert-ok"><span class="alert-icon"><i data-lucide="check-circle-2" style="color:var(--green)"></i></span><span><span class="alert-title">Tudo sob controle.</span>Nenhum alerta crítico no momento.</span></div>`;
    refreshIcons();
    return;
  }
  // Todos os campos do alerta são texto puro; o escape acontece aqui, uma única vez.
  const TIPOS_ALERTA = ['warning', 'danger', 'info', 'ok'];
  el.innerHTML = alerts.slice(0,6).map(a => {
    const tipo = TIPOS_ALERTA.includes(a.tipo) ? a.tipo : 'info';
    return `
    <div class="alert alert-${tipo}"><span class="alert-icon"><i data-lucide="${escapeHTML(a.lucide || 'info')}"></i></span><span><span class="alert-title">${escapeHTML(a.title)}</span>${escapeHTML(a.text)}</span></div>
  `;
  }).join('');
  refreshIcons();
}

function renderFunilDashboard() {
  const el = document.getElementById('dash-funnel');
  if (!el) return;
  if (STATE.eventos.length === 0) {
    el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:10px">Cadastre um evento para visualizar o funil de conversão.</div>';
    return;
  }
  const totalCapacidade = STATE.eventos.reduce((a,ev)=>a+ev.capacidade,0);
  const totalVendidos = STATE.eventos.reduce((a,ev)=>a+eventoStats(ev).vendidos,0);
  // Estimativa: descoberta ~ 3.2x da capacidade total; carrinho ~ 1.35x dos vendidos
  const descoberta = Math.round(totalCapacidade * 3.2) || 1;
  const carrinho = Math.round(totalVendidos * 1.35) || 1;
  const compra = totalVendidos;
  const steps = [
    {label:'Descobriram o evento', val: descoberta},
    {label:'Iniciaram compra', val: carrinho},
    {label:'Compraram', val: compra},
  ];
  const max = steps[0].val || 1;
  el.innerHTML = `<div class="funnel">` + steps.map(s => {
    const pct = Math.max(6, Math.round((s.val/max)*100));
    return `<div class="funnel-step">
      <div class="funnel-label">${s.label}</div>
      <div class="funnel-bar-wrap"><div class="funnel-bar" style="width:${pct}%">${s.val.toLocaleString('pt-BR')}</div></div>
      <div class="funnel-pct">${pct}%</div>
    </div>`;
  }).join('') + `</div><div style="font-size:10px;color:var(--text3);margin-top:10px">Estimativa baseada em capacidade e ritmo de vendas. Conecte pixels de marketing para dados reais de tráfego.</div>`;
}

function renderProjecaoDashboard() {
  const el = document.getElementById('dash-projecao');
  if (!el) return;
  const hoje = new Date();
  const ativos = STATE.eventos.filter(ev => ev.data && new Date(ev.data+'T23:59') > hoje && ev.status !== 'encerrado');
  if (!ativos.length) { el.innerHTML = `<div style="color:var(--text3);font-size:12px;padding:10px">Nenhum evento futuro para projetar.</div>`; return; }

  el.innerHTML = ativos.map(ev => {
    const st = eventoStats(ev);
    // Ritmo assumido: vendas começam ~60 dias antes; usamos dias decorridos vs faltantes para projetar linearmente com leve aceleração de última hora (+18%)
    const diasRestantes = Math.max(1, Math.ceil((new Date(ev.data+'T23:59') - hoje) / 86400000));
    const janelaTotal = 60;
    const diasDecorridos = Math.max(1, janelaTotal - diasRestantes);
    const ritmoDiario = st.receita / diasDecorridos;
    const projecao = st.receita + (ritmoDiario * diasRestantes * 1.18);
    const pctMeta = ev.metaFaturamento ? Math.min(999, Math.round(projecao/ev.metaFaturamento*100)) : null;
    return `<div class="progress-row" style="margin-bottom:14px">
      <div class="progress-label" style="width:150px" title="${escapeHTML(ev.nome)}">${escapeHTML(ev.nome.substring(0,20))}</div>
      <div class="progress-track"><div class="progress-fill ${pctMeta>=100?'green':pctMeta>=70?'yellow':'red'}" style="width:${Math.min(100,pctMeta||0)}%"></div></div>
      <div class="progress-val" style="width:auto;font-size:11px">${fmt_brl(projecao)}${pctMeta!=null?` <span style="color:var(--text3)">(${pctMeta}% da meta)</span>`:''}</div>
    </div>`;
  }).join('');
}

/* ===== METAS & ROI ===== */
function renderMetas() {
  const kpiEl = document.getElementById('metas-kpis');
  const cardsEl = document.getElementById('metas-cards');
  if (!kpiEl || !cardsEl) return;

  // Empty state when no events exist
  if (STATE.eventos.length === 0) {
    kpiEl.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Meta de Público</div><div class="kpi-val">—</div><div class="kpi-sub">Sem eventos cadastrados</div></div>
      <div class="kpi-card"><div class="kpi-label">Meta de Faturamento</div><div class="kpi-val">—</div><div class="kpi-sub">Sem eventos cadastrados</div></div>
      <div class="kpi-card"><div class="kpi-label">ROI Geral</div><div class="kpi-val">—</div><div class="kpi-sub">Sem dados suficientes</div></div>
      <div class="kpi-card"><div class="kpi-label">Break-even</div><div class="kpi-val">—</div><div class="kpi-sub">Sem dados suficientes</div></div>
    `;
    cardsEl.innerHTML = '<div class="empty"><div class="empty-icon"><i data-lucide="target"></i></div><p>Cadastre um evento para definir metas de público e faturamento.</p><button class="btn btn-primary btn-sm" onclick="openModalEvento()" style="margin-top:12px"><i data-lucide="plus" style="width:14px;height:14px;margin-right:4px"></i> Criar evento</button></div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const totalDespesas = STATE.despesas.reduce((a,d)=>a+d.valor,0);
  let somaMetaPublico=0, somaPublico=0, somaMetaFat=0, somaFat=0;
  STATE.eventos.forEach(ev => { const st=eventoStats(ev); somaMetaPublico+=ev.metaPublico||0; somaPublico+=st.vendidos; somaMetaFat+=ev.metaFaturamento||0; somaFat+=st.receita; });
  const roiGeral = totalDespesas>0 ? ((somaFat-totalDespesas)/totalDespesas*100) : 0;
  const breakEven = totalDespesas>0 && somaFat>0 ? Math.min(100, Math.round(somaFat/totalDespesas*100)) : 0;

  kpiEl.innerHTML = `
    <div class="kpi-card green"><div class="kpi-label">Meta de Público (geral)</div><div class="kpi-val">${somaMetaPublico?Math.round(somaPublico/somaMetaPublico*100):0}%</div><div class="kpi-sub">${somaPublico.toLocaleString('pt-BR')} de ${somaMetaPublico.toLocaleString('pt-BR')}</div></div>
    <div class="kpi-card blue"><div class="kpi-label">Meta de Faturamento (geral)</div><div class="kpi-val">${somaMetaFat?Math.round(somaFat/somaMetaFat*100):0}%</div><div class="kpi-sub">${fmt_brl(somaFat)} de ${fmt_brl(somaMetaFat)}</div></div>
    <div class="kpi-card ${roiGeral>=0?'purple':''}"><div class="kpi-label">ROI Geral</div><div class="kpi-val" style="color:${roiGeral>=0?'var(--green)':'var(--red)'}">${roiGeral.toFixed(1)}%</div><div class="kpi-sub">Receita vs. despesas totais</div></div>
    <div class="kpi-card ${breakEven>=100?'green':'yellow'}"><div class="kpi-label">Break-even</div><div class="kpi-val">${breakEven}%</div><div class="kpi-sub">${breakEven>=100?'Ponto de equilíbrio atingido':'do custo total coberto'}</div></div>
  `;

  cardsEl.innerHTML = STATE.eventos.map((ev,idx) => {
    const st = eventoStats(ev);
    const pctPub = ev.metaPublico ? Math.min(100, Math.round(st.vendidos/ev.metaPublico*100)) : 0;
    const pctFat = ev.metaFaturamento ? Math.min(100, Math.round(st.receita/ev.metaFaturamento*100)) : 0;
    return `<div class="meta-card">
      <div class="meta-card-title">${escapeHTML(ev.nome)} <span class="badge badge-purple" style="margin-left:6px">${escapeHTML(ev.status)}</span></div>
      <div class="progress-row">
        <div class="progress-label">Meta de público</div>
        <div class="progress-track"><div class="progress-fill ${pctPub>=100?'green':pctPub>=60?'yellow':'red'}" style="width:${pctPub}%"></div></div>
        <div class="progress-val">${pctPub}%</div>
      </div>
      <div class="progress-row" style="margin-bottom:0">
        <div class="progress-label">Meta de faturamento</div>
        <div class="progress-track"><div class="progress-fill ${pctFat>=100?'green':pctFat>=60?'yellow':'red'}" style="width:${pctFat}%"></div></div>
        <div class="progress-val">${pctFat}%</div>
      </div>
      <div class="meta-inline-form">
        <div class="form-group"><label>Meta de público</label><input type="number" value="${num(ev.metaPublico)}" onchange="atualizarMeta(${idx},'metaPublico',this.value)"></div>
        <div class="form-group"><label>Meta de faturamento (R$)</label><input type="number" value="${num(ev.metaFaturamento)}" onchange="atualizarMeta(${idx},'metaFaturamento',this.value)"></div>
      </div>
    </div>`;
  }).join('') || '<div class="empty"><p>Cadastre um evento para definir metas.</p></div>';
}

async function atualizarMeta(idx, campo, valor) {
  const evento = STATE.eventos[idx];
  const payload = campo === 'metaPublico'
    ? { goalAttendance: parseInt(valor) || 0 }
    : { goalRevenue: parseFloat(valor) || 0 };
  await acao(() => EvoAPI.patch(`/events/${evento.id}/goals`, payload), 'Meta atualizada!');
}

/* ===== COMPARATIVO & IA ===== */
function renderComparativo() {
  const tbody = document.getElementById('comp-tbody');
  const insightsEl = document.getElementById('comparativo-insights');
  const heatEl = document.getElementById('heatmap-grid');
  if (!tbody) return;

  // Empty state when no events
  if (STATE.eventos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty"><div class="empty-icon"><i data-lucide="bar-chart-3"></i></div><p>Cadastre eventos para visualizar o comparativo de performance.</p></div></td></tr>`;
    if (insightsEl) insightsEl.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:10px">Sem dados para gerar insights.</div>';
    if (heatEl) heatEl.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:10px">Sem entradas para exibir heatmap.</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const totalDespesas = STATE.despesas.reduce((a,d)=>a+d.valor,0);
  const rows = STATE.eventos.map(ev => {
    const st = eventoStats(ev);
    const custoAlocado = STATE.eventos.length ? totalDespesas/STATE.eventos.length : 0;
    const margem = st.receita>0 ? ((st.receita-custoAlocado)/st.receita*100) : 0;
    const roi = custoAlocado>0 ? ((st.receita-custoAlocado)/custoAlocado*100) : 0;
    return { ev, ...st, margem, roi };
  }).sort((a,b) => b.receita - a.receita);

  const medals = ['1º','2º','3º'];
  tbody.innerHTML = rows.map((r,i) => `<tr>
    <td>${i<3?`<span class="rank-badge rank-${i+1}">${medals[i]}</span>`:i+1}</td>
    <td><b>${escapeHTML(r.ev.nome)}</b></td>
    <td>${r.vendidos.toLocaleString('pt-BR')}</td>
    <td>${Math.round(r.ocupacao)}%</td>
    <td>${fmt_brl(r.receita)}</td>
    <td>${fmt_brl(r.ticketMedio)}</td>
    <td style="color:${r.margem>=0?'var(--green)':'var(--red)'}">${r.margem.toFixed(1)}%</td>
    <td style="color:${r.roi>=0?'var(--green)':'var(--red)'}">${r.roi.toFixed(1)}%</td>
  </tr>`).join('') || `<tr><td colspan="8"><div class="empty"><p>Nenhum evento cadastrado</p></div></td></tr>`;

  // IA comparativa (insights automáticos)
  if (insightsEl) {
    if (!rows.length) { insightsEl.innerHTML=''; }
    else {
      const melhorMargem = [...rows].sort((a,b)=>b.margem-a.margem)[0];
      const maiorPublico = [...rows].sort((a,b)=>b.vendidos-a.vendidos)[0];
      const melhorTicket = [...rows].sort((a,b)=>b.ticketMedio-a.ticketMedio)[0];
      const piorOcupacao = [...rows].sort((a,b)=>a.ocupacao-b.ocupacao)[0];
      insightsEl.innerHTML = `
        <div class="insight-box"><span class="ic"><i data-lucide="brain-circuit"></i></span><span><b>Melhor margem:</b> "${escapeHTML(melhorMargem.ev.nome)}" opera com margem estimada de ${melhorMargem.margem.toFixed(1)}%, o padrão mais saudável do portfólio atual.</span></div>
        <div class="insight-box"><span class="ic"><i data-lucide="users"></i></span><span><b>Maior público:</b> "${escapeHTML(maiorPublico.ev.nome)}" vendeu ${maiorPublico.vendidos.toLocaleString('pt-BR')} ingressos — use esse formato como referência para replicar em novos eventos.</span></div>
        <div class="insight-box"><span class="ic"><i data-lucide="ticket"></i></span><span><b>Melhor ticket médio:</b> "${escapeHTML(melhorTicket.ev.nome)}" com ${fmt_brl(melhorTicket.ticketMedio)} por ingresso, indicando forte aceitação de lotes premium.</span></div>
        ${piorOcupacao.ocupacao<60?`<div class="insight-box"><span class="ic"><i data-lucide="triangle-alert"></i></span><span><b>Atenção:</b> "${escapeHTML(piorOcupacao.ev.nome)}" está com apenas ${Math.round(piorOcupacao.ocupacao)}% de ocupação — considere reforçar marketing ou revisar preço dos lotes.</span></div>`:''}
      `;
    }
  }

  // Heatmap de entradas por horário
  if (heatEl) {
    const buckets = Array(24).fill(0);
    STATE.entries.forEach(e => {
      const h = parseInt((e.hora||'0:0').split(':')[0]);
      if (!isNaN(h)) buckets[h]++;
    });
    const max = Math.max(...buckets, 1);
    heatEl.innerHTML = buckets.map((v,h) => `
      <div class="heatmap-col">
        <div class="heatmap-fill" style="height:${Math.max(3,Math.round(v/max*80))}px" title="${v} entrada(s) às ${h}h"></div>
        <div class="heatmap-hour">${h}h</div>
      </div>`).join('');
  }
}

/* ===== UNIT ECONOMICS ===== */
function atualizarUnitEcon() {
  // CAC, churn e take rate são PREMISSAS do gestor, não dados medidos:
  // ficam salvos como preferência de tela deste navegador.
  STATE.unitEcon.cac = parseFloat(document.getElementById('ue-cac').value) || 0;
  STATE.unitEcon.churn = parseFloat(document.getElementById('ue-churn').value) || 0.1;
  STATE.unitEcon.take = parseFloat(document.getElementById('ue-take').value) || 0;
  UI.set({ ...UI.get(), unitEcon: STATE.unitEcon });
  renderUnitEconomics(false);
}

function renderUnitEconomics(resetInputs=true) {
  const kpiEl = document.getElementById('ue-kpis');
  if (!kpiEl) return;

  // Empty state when no events
  if (STATE.eventos.length === 0) {
    kpiEl.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">GMV</div><div class="kpi-val">—</div><div class="kpi-sub">Sem transações</div></div>
      <div class="kpi-card"><div class="kpi-label">ARPU</div><div class="kpi-val">—</div><div class="kpi-sub">Sem dados</div></div>
      <div class="kpi-card"><div class="kpi-label">Take Rate</div><div class="kpi-val">—</div><div class="kpi-sub">Sem dados</div></div>
      <div class="kpi-card"><div class="kpi-label">LTV estimado</div><div class="kpi-val">—</div><div class="kpi-sub">Sem dados</div></div>
      <div class="kpi-card"><div class="kpi-label">Payback do CAC</div><div class="kpi-val">—</div><div class="kpi-sub">Sem dados</div></div>
      <div class="kpi-card"><div class="kpi-label">LTV / CAC</div><div class="kpi-val">—</div><div class="kpi-sub">Sem dados</div></div>
    `;
    return;
  }

  const ue = sanitizeUnitEcon(STATE.unitEcon);
  if (resetInputs) {
    const cacEl = document.getElementById('ue-cac'), churnEl = document.getElementById('ue-churn'), takeEl = document.getElementById('ue-take');
    if (cacEl) cacEl.value = ue.cac;
    if (churnEl) churnEl.value = ue.churn;
    if (takeEl) takeEl.value = ue.take;
  }

  const gmv = STATE.eventos.reduce((a,ev)=>a+eventoStats(ev).receita,0);
  const nProdutores = STATE.eventos.length || 1;
  const arpu = gmv / nProdutores;
  const takeRateReceita = gmv * (ue.take/100);
  const churnFrac = Math.max(0.1, ue.churn) / 100;
  const margemContribuicao = 0.5; // premissa exposta no plano de negócios
  const ltv = arpu / churnFrac;
  const paybackMeses = (arpu*margemContribuicao) > 0 ? (ue.cac / (arpu*margemContribuicao)) : 0;

  kpiEl.innerHTML = `
    <div class="kpi-card blue"><div class="kpi-label">GMV</div><div class="kpi-val">${fmt_brl(gmv)}</div><div class="kpi-sub">Volume total transacionado</div></div>
    <div class="kpi-card"><div class="kpi-label">ARPU</div><div class="kpi-val">${fmt_brl(arpu)}</div><div class="kpi-sub">Receita média por produtor/evento</div></div>
    <div class="kpi-card green"><div class="kpi-label">Take Rate — Receita</div><div class="kpi-val">${fmt_brl(takeRateReceita)}</div><div class="kpi-sub">${ue.take}% do GMV</div></div>
    <div class="kpi-card purple"><div class="kpi-label">LTV estimado</div><div class="kpi-val">${fmt_brl(ltv)}</div><div class="kpi-sub">Churn mensal de ${ue.churn}%</div></div>
    <div class="kpi-card yellow"><div class="kpi-label">Payback do CAC</div><div class="kpi-val">${paybackMeses.toFixed(1)} meses</div><div class="kpi-sub">CAC de ${fmt_brl(ue.cac)}</div></div>
    <div class="kpi-card ${ltv/Math.max(1,ue.cac)>=3?'green':'yellow'}"><div class="kpi-label">LTV / CAC</div><div class="kpi-val">${(ltv/Math.max(1,ue.cac)).toFixed(1)}x</div><div class="kpi-sub">${ltv/Math.max(1,ue.cac)>=3?'Saudável (≥3x)':'Abaixo do ideal (3x)'}</div></div>
  `;
}

/* ===== RELATÓRIOS ===== */
// Os relatórios agora são gerados pelo servidor, sobre os dados completos
// do banco — não apenas sobre o que está carregado na tela.
const CSV_ENDPOINT = {
  eventos: 'eventos',
  participantes: 'participantes',
  despesas: 'financeiro',
  bar: 'estoque',
  ingressos: 'ingressos',
  entradas: 'entradas',
};

async function exportCSV(tipo) {
  const recurso = CSV_ENDPOINT[tipo];
  if (!recurso) { toast('Relatório desconhecido', 'error'); return; }
  const data = new Date().toISOString().slice(0, 10);
  try {
    await EvoAPI.download(`/reports/export/${recurso}`, `evotech-${recurso}-${data}.csv`);
    toast('CSV exportado!', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function exportRelatorioExecutivo() {
  const data = new Date().toISOString().slice(0, 10);
  try {
    await EvoAPI.download('/reports/executive', `evotech-relatorio-executivo-${data}.txt`);
    toast('Relatório executivo gerado!', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ===== EQUIPE & PERMISSÕES ===== */
function renderEquipe(search='') {
  const q = search.toLowerCase();
  const tbody = document.getElementById('equipe-tbody');
  const permTbody = document.getElementById('perm-tbody');
  if (!tbody) return;
  const filtered = (STATE.equipe||[]).filter(m => !q || m.nome.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  tbody.innerHTML = filtered.map(m => {
    const idx = STATE.equipe.indexOf(m);
    return `<tr>
      <td><b>${escapeHTML(m.nome)}</b></td>
      <td>${escapeHTML(m.email)}</td>
      <td><span class="badge badge-purple">${escapeHTML(m.perfil)}</span></td>
      <td><span class="badge ${m.status==='ativo'?'badge-green':'badge-red'}">${m.status==='ativo'?'Ativo':'Inativo'}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="editEquipe(${idx})" style="margin-right:4px" title="Editar"><i data-lucide="pencil"></i></button>
        <button class="btn btn-outline btn-sm" onclick="toggleEquipe(${idx})" style="margin-right:4px">${m.status==='ativo'?'Desativar':'Ativar'}</button>
        <button class="btn btn-danger btn-sm" onclick="delEquipe(${idx})" title="Excluir"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="5"><div class="empty"><p>Nenhum membro encontrado</p></div></td></tr>`;
  refreshIcons();

  if (permTbody) {
    const modulos = [
      ['Dashboard & Relatórios', [1,1,1,1,1]],
      ['Eventos & Lotes', [1,1,0,0,0]],
      ['Financeiro & Metas', [1,1,0,0,0]],
      ['Portaria (check-in)', [1,0,1,0,0]],
      ['Open Bar / Estoque', [1,0,0,1,0]],
      ['Equipe & Permissões', [1,0,0,0,0]],
      ['Auditoria & Sistema', [1,0,0,0,0]],
    ];
    permTbody.innerHTML = modulos.map(([nome, perms]) => `<tr>
      <td>${nome}</td>${perms.map(p=>`<td class="${p?'perm-yes':'perm-no'}">${p?'<i data-lucide="check" style="width:13px;height:13px;stroke-width:2.5"></i>':'—'}</td>`).join('')}
    </tr>`).join('');
  }
}

function openModalEquipe() {
  document.getElementById('eq-edit-idx').value = -1;
  document.getElementById('modal-equipe-title').textContent = 'Novo Membro da Equipe';
  document.getElementById('eq-nome').value=''; document.getElementById('eq-email').value='';
  document.getElementById('eq-perfil').value='Visualizador'; document.getElementById('eq-status').value='ativo';
  openModal('modal-equipe');
}
function editEquipe(idx) {
  const m = STATE.equipe[idx];
  document.getElementById('eq-edit-idx').value = idx;
  document.getElementById('modal-equipe-title').textContent = 'Editar Membro';
  document.getElementById('eq-nome').value = m.nome;
  document.getElementById('eq-email').value = m.email;
  document.getElementById('eq-perfil').value = m.perfil;
  document.getElementById('eq-status').value = m.status;
  openModal('modal-equipe');
}
async function salvarEquipe() {
  const idx = parseInt(document.getElementById('eq-edit-idx').value);
  const nome = document.getElementById('eq-nome').value.trim();
  const email = document.getElementById('eq-email').value.trim();
  const perfil = document.getElementById('eq-perfil').value;
  const status = document.getElementById('eq-status').value;
  if (!nome) { toast('Nome obrigatório', 'error'); return; }
  if (!email) { toast('E-mail obrigatório', 'error'); return; }

  const role = PERFIL_ROLE[perfil] || 'gate';
  const statusApi = status === 'ativo' ? 'active' : 'inactive';
  const existente = idx >= 0 ? STATE.equipe[idx] : null;

  const resultado = await acao(
    () => existente
      ? EvoAPI.patch(`/team/${existente.id}`, { role, status: statusApi })
      : EvoAPI.post('/team', { name: nome, email, role, status: statusApi }),
    existente ? 'Membro atualizado!' : 'Membro adicionado!'
  );

  if (resultado) {
    closeModal('modal-equipe');
    // Novo usuário: a senha provisória aparece uma única vez.
    if (!existente && resultado.temporaryPassword) {
      alert(
        `Acesso criado para ${nome}.\n\n` +
        `E-mail: ${email}\nSenha provisória: ${resultado.temporaryPassword}\n\n` +
        `Repasse com segurança. Peça para trocar a senha no primeiro acesso.`
      );
    }
  }
}

async function toggleEquipe(idx) {
  const membro = STATE.equipe[idx];
  const novo = membro.status === 'ativo' ? 'inactive' : 'active';
  await acao(() => EvoAPI.patch(`/team/${membro.id}`, { status: novo }), 'Status atualizado');
}

async function delEquipe(idx) {
  const membro = STATE.equipe[idx];
  if (!confirm(`Remover "${membro.nome}" da equipe?`)) return;
  // Remove só o acesso à organização; a conta do usuário permanece.
  await acao(() => EvoAPI.del(`/team/${membro.id}`), 'Membro removido');
}

/* ===== AUDITORIA ===== */
function renderAuditoria() {
  const el = document.getElementById('audit-log');
  const sub = document.getElementById('audit-sub');
  if (!el) return;
  const log = [...(STATE.auditLog||[])].reverse();
  if (sub) sub.textContent = `${log.length} registro(s)`;
  el.innerHTML = log.length ? log.map(l => `
    <div class="audit-row"><span class="time">${escapeHTML(l.hora)}</span><span class="who">${escapeHTML(l.usuario)}</span><span class="what">${escapeHTML(l.acao)}</span></div>
  `).join('') : '<div class="empty"><div class="empty-icon"><i data-lucide="shield-check"></i></div><p>Nenhuma ação registrada ainda</p></div>';
  refreshIcons();
}

/* ===== SISTEMA & CONTINGÊNCIA ===== */
function renderSistema() {
  const kpiEl = document.getElementById('sistema-kpis');
  const statusEl = document.getElementById('status-modulos');
  const toggle = document.getElementById('toggle-contingencia');
  if (!kpiEl) return;
  const sis = STATE.sistema || {};
  if (toggle) toggle.checked = !!sis.modoContingencia;

  const uptimeMs = Date.now() - (sis.uptimeStart || Date.now());
  const uptimeH = Math.floor(uptimeMs/3600000);
  const backupMinAtras = Math.round((Date.now() - (sis.ultimoBackup||Date.now()))/60000);

  kpiEl.innerHTML = `
    <div class="kpi-card ${sis.modoContingencia?'yellow':'green'}"><div class="kpi-label">Status Geral</div><div class="kpi-val">${sis.modoContingencia?'Contingência':'Online'}</div><div class="kpi-sub">${sis.modoContingencia?'Operando em modo offline':'Todos os sistemas normais'}</div></div>
    <div class="kpi-card blue"><div class="kpi-label">Uptime</div><div class="kpi-val">${uptimeH}h</div><div class="kpi-sub">Desde o último reinício</div></div>
    <div class="kpi-card"><div class="kpi-label">Último Backup</div><div class="kpi-val">${backupMinAtras<60?backupMinAtras+' min':Math.round(backupMinAtras/60)+' h'}</div><div class="kpi-sub">atrás</div></div>
    <div class="kpi-card purple"><div class="kpi-label">Registros na Auditoria</div><div class="kpi-val">${(STATE.auditLog||[]).length}</div><div class="kpi-sub">ações registradas</div></div>
  `;

  if (statusEl) {
    const modulos = sis.modoContingencia
      ? [['Ticketing','warn','Sincronização pendente'],['Check-in / Portaria','ok','Operando localmente'],['Pagamentos','warn','Fila de confirmação'],['PDV / Bar','ok','Operando localmente'],['Dashboard','ok','Atualizado']]
      : [['Ticketing','ok','Operacional'],['Check-in / Portaria','ok','Operacional'],['Pagamentos','ok','Operacional'],['PDV / Bar','ok','Operacional'],['Dashboard','ok','Atualizado']];
    statusEl.innerHTML = modulos.map(([nome,st,sub]) => `
      <div class="status-item"><span class="status-dot ${st==='ok'?'':'warn'}"></span>
        <div><div class="status-name">${nome}</div><div class="status-sub">${sub}</div></div>
      </div>`).join('');
  }
}

function toggleContingencia() {
  // Sinalizador operacional da equipe (indica que a casa está operando em
  // modo degradado). Fica salvo como preferência local deste navegador.
  STATE.sistema.modoContingencia = document.getElementById('toggle-contingencia').checked;
  UI.set({ ...UI.get(), modoContingencia: STATE.sistema.modoContingencia });
  renderSistema(); renderAlertasCentral();
  toast(STATE.sistema.modoContingencia ? 'Modo contingência ativado' : 'Modo contingência desativado',
    STATE.sistema.modoContingencia ? 'error' : 'success');
}

async function fazerBackupAgora() {
  // Backup do operador = exportação dos dados do servidor.
  // O backup do banco em si é responsabilidade da hospedagem do MySQL.
  STATE.sistema.ultimoBackup = Date.now();
  UI.set({ ...UI.get(), ultimoBackup: STATE.sistema.ultimoBackup });
  renderSistema();
  await exportData();
}

/* ===== MODAL ENGINE ===== */
let adminModalTrigger = null;
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  adminModalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  ModalScrollLock.lock();
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
  const first = el.querySelector('input, select, textarea, button.modal-close');
  window.setTimeout(() => first?.focus(), 120);
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.contains(document.activeElement)) document.activeElement.blur();
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
  ModalScrollLock.unlock();
  
  const trigger = adminModalTrigger;
  window.setTimeout(() => {
    if (trigger && document.body.contains(trigger)) {
      trigger.focus();
    } else {
      const fallback = document.querySelector('.panel.active .btn-primary') || 
                       document.getElementById('topbar-title') || 
                       document.body;
      fallback?.focus();
    }
  }, 50);
  
  adminModalTrigger = null;
}
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',e=>{ if(e.target===m) closeModal(m.id); });
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m=>{
      closeModal(m.id);
    });
  }
});

/* ===== TOAST ===== */
let toastTimer;
function toast(msg, type='success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.className='', 3000);
}

/* ===== UTILS ===== */
function fmt_brl(v) {
  return 'R$ ' + v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

async function exportData() {
  // Exporta o retrato atual dos dados carregados do servidor.
  await atualizar();
  const conteudo = JSON.stringify({
    exportadoEm: new Date().toISOString(),
    eventos: STATE.eventos, bar: STATE.bar, despesas: STATE.despesas,
    entradas: STATE.entries, participantes: STATE.participantes,
    contatos: STATE.contatos, equipe: STATE.equipe,
  }, null, 2);
  const blob = new Blob([conteudo], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `evotech-admin-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Dados exportados!', 'success');
}

/* Atualiza o dashboard automaticamente a cada minuto (countdown, uptime, etc.) */
setInterval(() => {
  // Recarrega do servidor: em operação, vários dispositivos alteram os
  // mesmos dados (portaria, bar, financeiro) ao mesmo tempo.
  if (document.querySelector('.panel.active')) atualizar();
}, 60000);

/* ===== GESTÃO DE PEDIDOS & INGRESSOS ===== */
let pedidosAdminCache = [];

async function carregarPedidosAdmin() {
  const tbody = document.getElementById('pedidos-tbody');
  const counter = document.getElementById('pedidos-counter');
  if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text2)">Carregando pedidos…</td></tr>`;

  try {
    const res = await EvoAPI.get('/orders', { limit: 100 });
    pedidosAdminCache = res.rows || res || [];
    if (counter) counter.textContent = `${pedidosAdminCache.length} pedido(s) registrado(s)`;
    filtrarPedidosAdmin();
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--red)">Erro ao carregar pedidos: ${escapeHTML(err.message)}</td></tr>`;
    toast('Falha ao carregar pedidos: ' + err.message, 'error');
  }
}

function filtrarPedidosAdmin() {
  const search = (document.getElementById('pedidos-search')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('pedidos-filter-status')?.value || '';
  const tbody = document.getElementById('pedidos-tbody');
  if (!tbody) return;

  const filtrados = pedidosAdminCache.filter(p => {
    const matchStatus = !statusFilter || p.status === statusFilter;
    const matchSearch = !search ||
      String(p.id).includes(search) ||
      (p.buyer_name && p.buyer_name.toLowerCase().includes(search)) ||
      (p.buyer_email && p.buyer_email.toLowerCase().includes(search)) ||
      (p.buyer_cpf && p.buyer_cpf.includes(search)) ||
      (p.event_name && p.event_name.toLowerCase().includes(search));
    return matchStatus && matchSearch;
  });

  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text2)">Nenhum pedido encontrado para os filtros selecionados.</td></tr>`;
    return;
  }

  const badgeMap = {
    paid: { label: 'Confirmado', bg: 'rgba(34,197,94,.15)', color: '#22c55e', border: 'rgba(34,197,94,.3)' },
    pending: { label: 'Pendente', bg: 'rgba(234,179,8,.15)', color: '#eab308', border: 'rgba(234,179,8,.3)' },
    cancelled: { label: 'Cancelado', bg: 'rgba(156,163,175,.15)', color: '#9ca3af', border: 'rgba(156,163,175,.3)' },
    refunded: { label: 'Estornado', bg: 'rgba(239,68,68,.15)', color: '#ef4444', border: 'rgba(239,68,68,.3)' },
  };

  tbody.innerHTML = filtrados.map(p => {
    const b = badgeMap[p.status] || { label: p.status, bg: 'rgba(255,255,255,.1)', color: '#fff', border: 'transparent' };
    const valor = Number(p.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dataCriacao = p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '—';
    
    // Informações de auditoria
    let auditInfo = '—';
    if (p.status === 'paid' && p.confirmed_by_name) {
      auditInfo = `<span style="font-size:12px; color:var(--accent)">Por ${escapeHTML(p.confirmed_by_name)} em ${p.confirmed_at ? new Date(p.confirmed_at).toLocaleDateString('pt-BR') : ''}</span>`;
    } else if (p.status === 'cancelled') {
      auditInfo = `<span style="font-size:12px; color:var(--text3)">Cancelado ${p.cancelled_by_name ? 'por ' + escapeHTML(p.cancelled_by_name) : ''}</span>`;
    } else if (p.status === 'paid' && p.payment_method === 'pix') {
      auditInfo = '<span style="font-size:12px; color:var(--text2)">Auto / PIX</span>';
    }

    const acoes = [];
    acoes.push(`<button class="btn btn-outline btn-xs" onclick="verDetalhesPedidoAdmin(${p.id})">Detalhes</button>`);
    if (p.status === 'pending') {
      acoes.push(`<button class="btn btn-primary btn-xs" onclick="confirmarPedidoAdmin(${p.id})">Confirmar</button>`);
      acoes.push(`<button class="btn btn-outline btn-xs" style="color:var(--red); border-color:rgba(239,68,68,.3)" onclick="cancelarPedidoAdmin(${p.id})">Cancelar</button>`);
    }

    return `
      <tr>
        <td style="font-weight:700">#${p.id}</td>
        <td>
          <div style="font-weight:600">${escapeHTML(p.buyer_name)}</div>
          <div style="font-size:12px; color:var(--text2)">${escapeHTML(p.buyer_email)}</div>
        </td>
        <td>${escapeHTML(p.event_name)}</td>
        <td style="font-weight:700">${escapeHTML(valor)}</td>
        <td><span style="display:inline-block; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:600; background:${b.bg}; color:${b.color}; border:1px solid ${b.border}">${escapeHTML(b.label)}</span></td>
        <td style="font-size:12px; color:var(--text2)">${escapeHTML(dataCriacao)}</td>
        <td>${auditInfo}</td>
        <td><div style="display:flex; gap:6px; flex-wrap:wrap;">${acoes.join('')}</div></td>
      </tr>
    `;
  }).join('');
}

async function confirmarPedidoAdmin(orderId) {
  if (!confirm(`Confirma a validação manual do pagamento para o Pedido #${orderId}?\nEsta ação emitirá os ingressos oficiais e dará baixa nos lotes correspondentes.`)) {
    return;
  }
  try {
    const res = await EvoAPI.post(`/orders/${orderId}/confirm`);
    toast(`Pedido #${orderId} confirmado com sucesso! ${res.tickets?.length || 0} ingresso(s) emitido(s).`, 'success');
    await carregarPedidosAdmin();
    atualizar();
  } catch (err) {
    toast(`Erro ao confirmar pedido: ${err.message}`, 'error');
  }
}

async function cancelarPedidoAdmin(orderId) {
  const motivo = prompt(`Informe o motivo do cancelamento do Pedido #${orderId}:`);
  if (motivo === null) return;

  try {
    await EvoAPI.post(`/orders/${orderId}/cancel`, { reason: motivo || undefined });
    toast(`Pedido #${orderId} cancelado.`, 'success');
    await carregarPedidosAdmin();
    atualizar();
  } catch (err) {
    toast(`Erro ao cancelar pedido: ${err.message}`, 'error');
  }
}

async function verDetalhesPedidoAdmin(orderId) {
  openModal('modal-pedido-detalhe');
  const title = document.getElementById('modal-pedido-title');
  const content = document.getElementById('modal-pedido-content');
  if (title) title.textContent = `Pedido #${orderId}`;
  if (content) content.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text2)">Carregando…</div>';

  try {
    const p = await EvoAPI.get(`/orders/${orderId}`);
    const valor = Number(p.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dataCriacao = p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '—';
    const dataPagamento = p.paid_at ? new Date(p.paid_at).toLocaleString('pt-BR') : '—';

    let itensHTML = '';
    if (p.items && p.items.length) {
      itensHTML = `
        <div style="margin-top:16px;">
          <div style="font-weight:700; margin-bottom:8px; font-size:13px; text-transform:uppercase; color:var(--accent)">Itens Contratados</div>
          <table style="width:100%; font-size:13px;">
            <thead><tr><th>Lote</th><th>Qtd</th><th>Valor Unitário</th><th>Subtotal</th></tr></thead>
            <tbody>
              ${p.items.map(it => `
                <tr>
                  <td>${escapeHTML(it.batch_name)}</td>
                  <td>${it.quantity}</td>
                  <td>R$ ${Number(it.unit_price).toFixed(2).replace('.', ',')}</td>
                  <td style="font-weight:600">R$ ${(Number(it.unit_price) * it.quantity).toFixed(2).replace('.', ',')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    let ticketsHTML = '';
    if (p.tickets && p.tickets.length) {
      ticketsHTML = `
        <div style="margin-top:16px;">
          <div style="font-weight:700; margin-bottom:8px; font-size:13px; text-transform:uppercase; color:var(--secondary)">Ingressos Oficiais Emitidos (${p.tickets.length})</div>
          <table style="width:100%; font-size:13px;">
            <thead><tr><th>Código</th><th>Titular</th><th>Lote</th><th>Status</th><th>Check-in</th></tr></thead>
            <tbody>
              ${p.tickets.map(t => `
                <tr>
                  <td style="font-family:monospace; font-weight:700; color:var(--accent)">#${escapeHTML(t.code)}</td>
                  <td>${escapeHTML(t.holder_name)}</td>
                  <td>${escapeHTML(t.batch_name)}</td>
                  <td><span style="font-size:11px; padding:2px 6px; border-radius:10px; background:${t.status==='used'?'rgba(59,130,246,.2)':'rgba(34,197,94,.2)'}; color:${t.status==='used'?'#60a5fa':'#4ade80'}">${t.status==='used'?'Utilizado':'Válido'}</span></td>
                  <td>${t.checked_in_at ? new Date(t.checked_in_at).toLocaleString('pt-BR') : 'Ainda não realizado'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    content.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:14px; background:var(--surface2); padding:16px; border-radius:var(--radius-sm); border:1px solid var(--border);">
        <div><span style="color:var(--text2); font-size:12px;">Comprador:</span> <div style="font-weight:600">${escapeHTML(p.buyer_name)}</div></div>
        <div><span style="color:var(--text2); font-size:12px;">E-mail:</span> <div style="font-weight:600">${escapeHTML(p.buyer_email)}</div></div>
        <div><span style="color:var(--text2); font-size:12px;">CPF:</span> <div style="font-weight:600">${escapeHTML(p.buyer_cpf || '—')}</div></div>
        <div><span style="color:var(--text2); font-size:12px;">Evento:</span> <div style="font-weight:600">${escapeHTML(p.event_name)}</div></div>
        <div><span style="color:var(--text2); font-size:12px;">Valor Total:</span> <div style="font-weight:700; color:var(--accent); font-size:15px">${escapeHTML(valor)}</div></div>
        <div><span style="color:var(--text2); font-size:12px;">Status:</span> <div style="font-weight:700; text-transform:uppercase">${escapeHTML(p.status)}</div></div>
        <div><span style="color:var(--text2); font-size:12px;">Data Criação:</span> <div>${escapeHTML(dataCriacao)}</div></div>
        <div><span style="color:var(--text2); font-size:12px;">Data Confirmação:</span> <div>${escapeHTML(dataPagamento)}</div></div>
      </div>
      ${itensHTML}
      ${ticketsHTML}
    `;
  } catch (err) {
    content.innerHTML = `<div style="text-align:center; padding:20px; color:var(--red)">Erro ao buscar detalhes: ${escapeHTML(err.message)}</div>`;
  }
}

/* ===== INIT ===== */
atualizar();
