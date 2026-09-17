'use strict';

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

function estadoVazio() {
  const ui = UI.get();
  return {
    eventos: [], bar: [], despesas: [], entries: [],
    participantes: [], contatos: [], equipe: [], auditLog: [],
    sistema: {
      modoContingencia: !!ui.modoContingencia,
      ultimoBackup: ui.ultimoBackup || Date.now(),
      uptimeStart: ui.uptimeStart || Date.now(),
    },
    unitEcon: ui.unitEcon || { cac: 850, churn: 4, take: 6 },
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

function mapEvento(e) {
  return {
    id: e.id,
    nome: e.name,
    tipo: e.type || '',
    data: e.eventDate ? String(e.eventDate).slice(0, 10) : '',
    local: e.venue || '',
    capacidade: e.capacity,
    status: { draft: 'em_breve', upcoming: 'em_breve', active: 'ativo', sold_out: 'esgotado', closed: 'encerrado' }[e.status] || 'ativo',
    statusApi: e.status,
    desc: e.description || '',
    regras: e.rules || '',
    metaPublico: e.goalAttendance,
    metaFaturamento: e.goalRevenue,
    lotes: (e.batches || []).map(b => ({
      id: b.id, nome: b.name, preco: Number(b.price),
      disponivel: b.available, total: b.quantityTotal,
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
        EvoAPI.get('/expenses'),
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
        id: p.id, nome: p.name, emoji: p.emoji || '🍶', cat: p.category,
        custo: p.unitCost, estoque: p.stockQuantity, minimo: p.minStock,
      })),
      despesas: despesas.map(d => ({
        id: d.id,
        cat: `${d.category_icon || ''} ${d.category_name}`.trim(),
        catId: d.category_id,
        desc: d.description || '',
        valor: Number(d.amount),
        eventId: d.event_id,
      })),
      entries: (checkins.rows || []).map(c => ({
        id: c.id, nome: c.guest_name, codigo: c.code || '',
        evento: c.event_name, hora: fmt(new Date(c.checked_in_at)),
      })),
      participantes: participantes.map(p => ({
        userId: p.id, nome: p.name, email: p.email,
        cpf: p.cpf || '—', tel: p.phone || '—',
        ingressos: p.tickets,
        status: p.status === 'blocked' ? 'bloqueado' : 'ativo',
        semCadastro: p.status === 'guest',
      })),
      contatos: contatos.map(c => ({
        id: c.id, nome: c.name, cargo: c.roleTitle || '', email: c.email || '',
        tel: c.phone || '', cat: c.category, valor: c.fee, obs: c.notes || '',
      })),
      equipe: equipe.map(m => ({
        id: m.id, nome: m.name, email: m.email,
        perfil: PERFIL_LABEL[m.role] || m.role,
        role: m.role,
        status: m.status === 'active' ? 'ativo' : 'inativo',
      })),
      auditLog: auditoria.slice().reverse().map(l => ({
        hora: new Date(l.hora).toLocaleString('pt-BR'),
        usuario: l.usuario, acao: l.acao,
      })),
      sistema: {
        modoContingencia: !!ui.modoContingencia,
        ultimoBackup: ui.ultimoBackup || Date.now(),
        uptimeStart: ui.uptimeStart || Date.now(),
      },
      unitEcon: ui.unitEcon || { cac: 850, churn: 4, take: 6 },
    };
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
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
  document.getElementById('panel-'+id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[onclick="goPanel('${id}')"]`)?.classList.add('active');

  const cfg = panels[id] || {};
  document.getElementById('topbar-title').textContent = cfg.title || id;
  document.getElementById('topbar-sub').textContent = cfg.sub || '';
  const btn = document.getElementById('topbar-action');
  if(cfg.action) { btn.textContent = cfg.action; btn.classList.remove('is-hidden'); btn.onclick = window[cfg.fn] || null; }
  else btn.classList.add('is-hidden');

  atualizar();
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
}

/* ===== DASHBOARD ===== */
function renderDashboard() {
  renderCountdown();
  renderAlertasCentral();
  renderFunilDashboard();
  renderProjecaoDashboard();
  const totalVendidos = STATE.eventos.reduce((acc,ev) =>
    acc + ev.lotes.reduce((a,l) => a + (l.total - l.disponivel), 0), 0);
  const totalReceita = STATE.eventos.reduce((acc,ev) =>
    acc + ev.lotes.reduce((a,l) => a + (l.total - l.disponivel)*l.preco, 0), 0);
  const totalDespesas = STATE.despesas.reduce((a,d) => a + d.valor, 0);
  const totalEntradas = STATE.entries.length;

  const ticketMedioGeral = totalVendidos>0 ? totalReceita/totalVendidos : 0;
  const roiGeral = totalDespesas>0 ? ((totalReceita-totalDespesas)/totalDespesas*100) : 0;

  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi-card purple"><div class="kpi-label">Eventos Ativos</div><div class="kpi-val">${STATE.eventos.filter(e=>e.status==='ativo').length}</div><div class="kpi-sub">${STATE.eventos.length} no total</div></div>
    <div class="kpi-card green"><div class="kpi-label">Ingressos Vendidos</div><div class="kpi-val">${totalVendidos.toLocaleString('pt-BR')}</div><div class="kpi-sub">Todos os eventos</div></div>
    <div class="kpi-card blue"><div class="kpi-label">Receita Total</div><div class="kpi-val">R$ ${(totalReceita/1000).toFixed(0)}k</div><div class="kpi-sub">${fmt_brl(totalReceita)}</div></div>
    <div class="kpi-card yellow"><div class="kpi-label">Despesas</div><div class="kpi-val">R$ ${(totalDespesas/1000).toFixed(0)}k</div><div class="kpi-sub">${fmt_brl(totalDespesas)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Saldo</div><div class="kpi-val" style="color:${totalReceita-totalDespesas>0?'var(--green)':'var(--red)'}">${fmt_brl(totalReceita-totalDespesas)}</div><div class="kpi-sub">Receita - Despesas</div></div>
    <div class="kpi-card"><div class="kpi-label">Ticket Médio Geral</div><div class="kpi-val">${fmt_brl(ticketMedioGeral)}</div><div class="kpi-sub">Receita ÷ ingressos vendidos</div></div>
    <div class="kpi-card ${roiGeral>=0?'green':''}"><div class="kpi-label">ROI Geral</div><div class="kpi-val" style="color:${roiGeral>=0?'var(--green)':'var(--red)'}">${roiGeral.toFixed(1)}%</div><div class="kpi-sub">Retorno sobre despesas</div></div>
    <div class="kpi-card"><div class="kpi-label">Entradas Hoje</div><div class="kpi-val">${totalEntradas}</div><div class="kpi-sub">pessoas registradas</div></div>
  `;

  // Events bars
  document.getElementById('dash-events-bars').innerHTML = STATE.eventos.map(ev => {
    const vendidos = ev.lotes.reduce((a,l)=>a+(l.total-l.disponivel),0);
    const pct = ev.capacidade > 0 ? Math.round((vendidos/ev.capacidade)*100) : 0;
    const col = pct > 80 ? 'red' : pct > 50 ? 'yellow' : 'green';
    return `<div class="progress-row">
      <div class="progress-label" title="${ev.nome}">${ev.nome.substring(0,22)}${ev.nome.length>22?'…':''}</div>
      <div class="progress-track"><div class="progress-fill ${col}" style="width:${pct}%"></div></div>
      <div class="progress-val">${pct}%</div>
    </div>`;
  }).join('');

  // Bar levels
  document.getElementById('dash-bar-levels').innerHTML = STATE.bar.map(item => {
    const pct = Math.round((item.estoque / (item.minimo * 5)) * 100);
    const pctClamped = Math.min(pct, 100);
    const col = item.estoque < item.minimo ? 'red' : item.estoque < item.minimo*2 ? 'yellow' : 'green';
    return `<div class="progress-row">
      <div class="progress-label">${item.emoji} ${item.nome.substring(0,16)}</div>
      <div class="progress-track"><div class="progress-fill ${col}" style="width:${pctClamped}%"></div></div>
      <div class="progress-val">${item.estoque} un</div>
    </div>`;
  }).join('');

  // Entry log preview
  const log = document.getElementById('dash-entry-log');
  document.getElementById('dash-entries-label').textContent = `${STATE.entries.length} pessoa(s) registrada(s)`;
  if(STATE.entries.length === 0) {
    log.innerHTML = '<div class="empty"><div class="empty-icon">🚪</div><p>Nenhuma entrada registrada</p></div>';
  } else {
    log.innerHTML = [...STATE.entries].reverse().slice(0,5).map(e => `
      <div class="entry-row">
        <span class="time">${e.hora}</span>
        <span class="name">${e.nome}</span>
        <span class="badge badge-purple">${e.evento.substring(0,12)}</span>
      </div>`).join('');
  }

  // Expenses
  document.getElementById('dash-expenses').innerHTML = STATE.despesas.map(d => {
    const max = Math.max(...STATE.despesas.map(x=>x.valor));
    const pct = Math.round((d.valor/max)*100);
    return `<div class="progress-row">
      <div class="progress-label">${d.cat.substring(0,18)}</div>
      <div class="progress-track"><div class="progress-fill purple" style="width:${pct}%"></div></div>
      <div class="progress-val">${fmt_brl(d.valor)}</div>
    </div>`;
  }).join('');
}

/* ===== EVENTOS ===== */
function renderEventos(search='') {
  const q = search.toLowerCase();
  const filtered = STATE.eventos.filter(e => !q || e.nome.toLowerCase().includes(q) || e.local.toLowerCase().includes(q));
  const tbody = document.getElementById('eventos-tbody');
  if(filtered.length===0) { tbody.innerHTML=`<tr><td colspan="8"><div class="empty"><div class="empty-icon">📅</div><p>Nenhum evento encontrado</p></div></td></tr>`; return; }

  tbody.innerHTML = filtered.map((ev,i) => {
    const vendidos = ev.lotes.reduce((a,l)=>a+(l.total-l.disponivel),0);
    const receita = ev.lotes.reduce((a,l)=>a+(l.total-l.disponivel)*l.preco,0);
    const idx = STATE.eventos.indexOf(ev);
    const stBadge = {ativo:'badge-green',em_breve:'badge-blue',esgotado:'badge-red',encerrado:'badge-yellow'}[ev.status]||'badge-yellow';
    const stLabel = {ativo:'Ativo',em_breve:'Em breve',esgotado:'Esgotado',encerrado:'Encerrado'}[ev.status]||ev.status;
    return `<tr>
      <td><b>${ev.nome}</b><div style="font-size:10px;color:var(--text3)">${ev.tipo}</div></td>
      <td>${ev.data !== '' ? new Date(ev.data+'T12:00').toLocaleDateString('pt-BR') : 'A definir'}</td>
      <td>${ev.local}</td>
      <td>${ev.capacidade.toLocaleString('pt-BR')}</td>
      <td>${vendidos}</td>
      <td>${fmt_brl(receita)}</td>
      <td><span class="badge ${stBadge}">${stLabel}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="verLotes(${idx})" style="margin-right:4px">Lotes</button>
        <button class="btn btn-outline btn-sm" onclick="editEvento(${idx})" style="margin-right:4px">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="delEvento(${idx})">🗑</button>
      </td>
    </tr>`;
  }).join('');
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
      <td><b>${l.nome}</b></td>
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
        <button class="btn btn-outline btn-sm" onclick="editLote(${i})" style="margin-right:4px">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="delLote(${i})">🗑</button>
      </td>
    </tr>`;
  }).join('');
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
  const filtered = STATE.bar.filter(b => !q || b.nome.toLowerCase().includes(q) || b.cat.toLowerCase().includes(q));

  // Alerts
  const low = STATE.bar.filter(b => b.estoque < b.minimo);
  document.getElementById('bar-alerts').innerHTML = low.map(b =>
    `<div class="alert alert-warning">⚠️ Estoque baixo: <b>${b.emoji} ${b.nome}</b> — ${b.estoque} un. (mín: ${b.minimo})</div>`
  ).join('');

  // Stock visual
  document.getElementById('bar-stock-list').innerHTML = filtered.map(item => {
    const pct = Math.min(100, Math.round((item.estoque/(item.minimo*5))*100));
    const col = item.estoque < item.minimo ? 'red' : item.estoque < item.minimo*2 ? 'yellow' : 'green';
    return `<div class="progress-row">
      <div class="progress-label">${item.emoji} ${item.nome.substring(0,18)}</div>
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
      <td><b>${item.emoji} ${item.nome}</b></td>
      <td>${item.cat}</td>
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
      <td><span class="badge ${low?'badge-red':'badge-green'}">${low?'⚠ Baixo':'OK'}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="editBarItem(${idx})" style="margin-right:4px">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="delBarItem(${idx})">🗑</button>
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
    emoji: document.getElementById('bar-emoji').value.trim() || '🍶',
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
  // Populate evento select
  const sel = document.getElementById('manual-evento');
  sel.innerHTML = '<option value="">Selecionar evento…</option>' +
    STATE.eventos.map(ev=>`<option>${ev.nome}</option>`).join('');

  // Entry log
  const log = document.getElementById('entry-log');
  document.getElementById('portaria-total').textContent = `${STATE.entries.length} pessoa(s) registrada(s)`;

  if(!STATE.entries.length) {
    log.innerHTML='<div class="empty"><div class="empty-icon">🚪</div><p>Nenhuma entrada ainda</p></div>';
  } else {
    log.innerHTML = [...STATE.entries].reverse().map(e=>`
      <div class="entry-row">
        <span class="time">${e.hora}</span>
        <span class="name">${e.nome}</span>
        <span class="badge badge-purple" style="font-size:9px;max-width:100px;overflow:hidden;text-overflow:ellipsis">${e.evento.substring(0,14)}</span>
        ${e.codigo ? `<span style="color:var(--text3);font-size:10px">${e.codigo}</span>` : ''}
      </div>`).join('');
  }

  // Count per event
  const counts = {};
  STATE.entries.forEach(e => { counts[e.evento] = (counts[e.evento]||0)+1; });
  document.getElementById('portaria-count').innerHTML = Object.entries(counts).map(([ev,cnt])=>`
    <div class="progress-row">
      <div class="progress-label" title="${ev}">${ev.substring(0,20)}</div>
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
    toast(`✓ ${entrada.guestName} — ${entrada.eventName}`, 'success');
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
  const totalVendidos = STATE.eventos.reduce((acc,ev) =>
    acc + ev.lotes.reduce((a,l)=>a+(l.total-l.disponivel),0), 0);
  const totalReceita = STATE.eventos.reduce((acc,ev) =>
    acc + ev.lotes.reduce((a,l)=>a+(l.total-l.disponivel)*l.preco,0), 0);
  const totalDespesas = STATE.despesas.reduce((a,d)=>a+d.valor,0);

  document.getElementById('fin-kpis').innerHTML = `
    <div class="kpi-card blue"><div class="kpi-label">Receita Total</div><div class="kpi-val">${fmt_brl(totalReceita)}</div><div class="kpi-sub">Ingressos vendidos</div></div>
    <div class="kpi-card red"><div class="kpi-label">Total Despesas</div><div class="kpi-val">${fmt_brl(totalDespesas)}</div></div>
    <div class="kpi-card ${totalReceita-totalDespesas>=0?'green':''}"><div class="kpi-label">Saldo</div><div class="kpi-val" style="color:${totalReceita-totalDespesas>=0?'var(--green)':'var(--red)'}">${fmt_brl(totalReceita-totalDespesas)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Margem</div><div class="kpi-val">${totalReceita>0?Math.round(((totalReceita-totalDespesas)/totalReceita)*100):0}%</div></div>
  `;

  const tbody = document.getElementById('fin-tbody');
  tbody.innerHTML = STATE.despesas.map((d,i)=>`<tr>
    <td>${d.cat}</td>
    <td>${d.desc}</td>
    <td>${fmt_brl(d.valor)}</td>
    <td style="white-space:nowrap">
      <button class="btn btn-outline btn-sm" onclick="editDespesa(${i})" style="margin-right:4px">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="delDespesa(${i})">🗑</button>
    </td>
  </tr>`).join('');

  // Chart
  const max = Math.max(...STATE.despesas.map(d=>d.valor),1);
  document.getElementById('fin-expense-chart').innerHTML = STATE.despesas.map(d=>`
    <div class="progress-row">
      <div class="progress-label">${d.cat.substring(0,16)}</div>
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
  // O select traz "🛡️ Segurança": separa ícone e nome para a tabela de categorias.
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
  const filtered = STATE.participantes.filter(p => !q ||
    p.nome.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.cpf.includes(q));

  document.getElementById('part-count').textContent = `${filtered.length} participante(s)`;
  const tbody = document.getElementById('part-tbody');
  if(!filtered.length) { tbody.innerHTML=`<tr><td colspan="7"><div class="empty"><div class="empty-icon">👥</div><p>Nenhum participante encontrado</p></div></td></tr>`; return; }

  tbody.innerHTML = filtered.map((p)=>{
    const idx = STATE.participantes.indexOf(p);
    const stBadge = p.status==='ativo'?'badge-green':'badge-red';
    return `<tr>
      <td><b>${p.nome}</b></td>
      <td>${p.email}</td>
      <td>${p.cpf}</td>
      <td>${p.tel}</td>
      <td><span class="badge badge-blue">${p.ingressos}</span></td>
      <td><span class="badge ${stBadge}">${p.status==='ativo'?'Ativo':'Bloqueado'}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="togglePart(${idx})">${p.status==='ativo'?'Bloquear':'Ativar'}</button>
      </td>
    </tr>`;
  }).join('');
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
  const filtered = STATE.contatos.filter(c=>!q||c.nome.toLowerCase().includes(q)||c.cargo.toLowerCase().includes(q)||c.cat.toLowerCase().includes(q));
  const grid = document.getElementById('contatos-grid');
  if(!filtered.length) { grid.innerHTML=`<div class="empty"><div class="empty-icon">📇</div><p>Nenhum contato encontrado</p></div>`; return; }

  const catColor = {
    'Artista / DJ':'badge-purple','Segurança':'badge-blue','Fornecedor':'badge-green',
    'Equipe Interna':'badge-yellow','Parceiro':'badge-blue','Outro':'badge-yellow'
  };

  grid.innerHTML = filtered.map(c=>{
    const idx = STATE.contatos.indexOf(c);
    const initials = c.nome.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase();
    return `<div class="contact-card">
      <div class="contact-avatar">${initials}</div>
      <div class="contact-name">${c.nome}</div>
      <div class="contact-email" style="margin-bottom:4px"><span class="badge ${catColor[c.cat]||'badge-yellow'}" style="font-size:9px">${c.cat}</span> ${c.cargo}</div>
      <div class="contact-email">✉ ${c.email}</div>
      <div class="contact-tel">📞 ${c.tel}</div>
      ${c.valor?`<div style="font-size:11px;color:var(--text3);margin-top:4px">💰 ${fmt_brl(c.valor)}</div>`:''}
      ${c.obs?`<div style="font-size:11px;color:var(--text3);margin-top:4px;font-style:italic">${c.obs}</div>`:''}
      <div class="contact-actions">
        <button class="btn btn-outline btn-sm" onclick="editContato(${idx})">✏️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="delContato(${idx})">🗑</button>
      </div>
    </div>`;
  }).join('');
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
        <div class="countdown-name">${ev.nome}</div>
        <div class="countdown-meta">${ev.local} · ${new Date(ev.data+'T12:00').toLocaleDateString('pt-BR')} · ${Math.round(st.ocupacao)}% da capacidade vendida</div>
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
    alerts.push({tipo:'warning', icon:'⚠️', title:'Estoque baixo:', text:`${b.emoji} ${b.nome} está com ${b.estoque} un. (mínimo: ${b.minimo}).`});
  });

  // Orçamento estourado (despesas > receita)
  const totalReceita = STATE.eventos.reduce((a,ev)=>a+eventoStats(ev).receita,0);
  const totalDespesas = STATE.despesas.reduce((a,d)=>a+d.valor,0);
  if (totalDespesas > totalReceita && totalReceita > 0) {
    alerts.push({tipo:'danger', icon:'🚨', title:'Orçamento:', text:`As despesas (${fmt_brl(totalDespesas)}) já superam a receita registrada (${fmt_brl(totalReceita)}).`});
  } else if (totalReceita > 0 && totalDespesas > totalReceita*0.8) {
    alerts.push({tipo:'warning', icon:'⚠️', title:'Orçamento:', text:`As despesas já consomem ${Math.round(totalDespesas/totalReceita*100)}% da receita registrada.`});
  }

  // Ritmo de vendas abaixo do esperado (eventos próximos com baixa ocupação)
  const hoje = new Date();
  STATE.eventos.forEach(ev => {
    if (!ev.data || ev.status === 'encerrado') return;
    const diasRestantes = Math.ceil((new Date(ev.data+'T23:59') - hoje) / 86400000);
    const st = eventoStats(ev);
    if (diasRestantes >= 0 && diasRestantes <= 14 && st.ocupacao < 50) {
      alerts.push({tipo:'warning', icon:'📉', title:'Ritmo de vendas:', text:`"${ev.nome}" está a ${diasRestantes} dia(s) do evento com apenas ${Math.round(st.ocupacao)}% de ocupação vendida.`});
    }
    if (ev.metaFaturamento && st.receita < ev.metaFaturamento*0.5 && diasRestantes <= 14 && diasRestantes >= 0) {
      alerts.push({tipo:'warning', icon:'🎯', title:'Meta em risco:', text:`"${ev.nome}" está a ${Math.round(st.receita/ev.metaFaturamento*100)}% da meta de faturamento faltando ${diasRestantes} dia(s).`});
    }
  });

  // Modo contingência ligado
  if (STATE.sistema?.modoContingencia) {
    alerts.push({tipo:'info', icon:'🛰️', title:'Contingência ativa:', text:'O sistema está operando em modo offline/contingência. Dados serão sincronizados automaticamente.'});
  }

  if (!alerts.length) {
    el.innerHTML = `<div class="alert alert-ok"><span class="alert-icon">✅</span><span><span class="alert-title">Tudo sob controle.</span>Nenhum alerta crítico no momento.</span></div>`;
    return;
  }
  el.innerHTML = alerts.slice(0,6).map(a => `
    <div class="alert alert-${a.tipo}"><span class="alert-icon">${a.icon}</span><span><span class="alert-title">${a.title}</span>${a.text}</span></div>
  `).join('');
}

function renderFunilDashboard() {
  const el = document.getElementById('dash-funnel');
  if (!el) return;
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
      <div class="progress-label" style="width:150px" title="${ev.nome}">${ev.nome.substring(0,20)}</div>
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
      <div class="meta-card-title">${ev.nome} <span class="badge badge-purple" style="margin-left:6px">${ev.status}</span></div>
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
        <div class="form-group"><label>Meta de público</label><input type="number" value="${ev.metaPublico||0}" onchange="atualizarMeta(${idx},'metaPublico',this.value)"></div>
        <div class="form-group"><label>Meta de faturamento (R$)</label><input type="number" value="${ev.metaFaturamento||0}" onchange="atualizarMeta(${idx},'metaFaturamento',this.value)"></div>
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

  const totalDespesas = STATE.despesas.reduce((a,d)=>a+d.valor,0);
  const rows = STATE.eventos.map(ev => {
    const st = eventoStats(ev);
    const custoAlocado = STATE.eventos.length ? totalDespesas/STATE.eventos.length : 0;
    const margem = st.receita>0 ? ((st.receita-custoAlocado)/st.receita*100) : 0;
    const roi = custoAlocado>0 ? ((st.receita-custoAlocado)/custoAlocado*100) : 0;
    return { ev, ...st, margem, roi };
  }).sort((a,b) => b.receita - a.receita);

  const medals = ['🥇','🥈','🥉'];
  tbody.innerHTML = rows.map((r,i) => `<tr>
    <td>${i<3?`<span class="rank-badge">${medals[i]}</span>`:i+1}</td>
    <td><b>${r.ev.nome}</b></td>
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
        <div class="insight-box"><span class="ic">🧠</span><span><b>Melhor margem:</b> "${melhorMargem.ev.nome}" opera com margem estimada de ${melhorMargem.margem.toFixed(1)}%, o padrão mais saudável do portfólio atual.</span></div>
        <div class="insight-box"><span class="ic">👥</span><span><b>Maior público:</b> "${maiorPublico.ev.nome}" vendeu ${maiorPublico.vendidos.toLocaleString('pt-BR')} ingressos — use esse formato como referência para replicar em novos eventos.</span></div>
        <div class="insight-box"><span class="ic">🎟️</span><span><b>Melhor ticket médio:</b> "${melhorTicket.ev.nome}" com ${fmt_brl(melhorTicket.ticketMedio)} por ingresso, indicando forte aceitação de lotes premium.</span></div>
        ${piorOcupacao.ocupacao<60?`<div class="insight-box"><span class="ic">⚠️</span><span><b>Atenção:</b> "${piorOcupacao.ev.nome}" está com apenas ${Math.round(piorOcupacao.ocupacao)}% de ocupação — considere reforçar marketing ou revisar preço dos lotes.</span></div>`:''}
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
  const ue = STATE.unitEcon || {cac:850, churn:4, take:6};
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
      <td><b>${m.nome}</b></td>
      <td>${m.email}</td>
      <td><span class="badge badge-purple">${m.perfil}</span></td>
      <td><span class="badge ${m.status==='ativo'?'badge-green':'badge-red'}">${m.status==='ativo'?'Ativo':'Inativo'}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="editEquipe(${idx})" style="margin-right:4px">✏️</button>
        <button class="btn btn-outline btn-sm" onclick="toggleEquipe(${idx})" style="margin-right:4px">${m.status==='ativo'?'Desativar':'Ativar'}</button>
        <button class="btn btn-danger btn-sm" onclick="delEquipe(${idx})">🗑</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="5"><div class="empty"><p>Nenhum membro encontrado</p></div></td></tr>`;

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
      <td>${nome}</td>${perms.map(p=>`<td class="${p?'perm-yes':'perm-no'}">${p?'✓':'—'}</td>`).join('')}
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
    <div class="audit-row"><span class="time">${l.hora}</span><span class="who">${l.usuario}</span><span class="what">${l.acao}</span></div>
  `).join('') : '<div class="empty"><div class="empty-icon">🧾</div><p>Nenhuma ação registrada ainda</p></div>';
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

/* ===== INIT ===== */
atualizar();
