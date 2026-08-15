'use strict';

/* ===== STATE (localStorage) ===== */
const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function loadState() {
  return LS.get('evotech_admin') || {
    eventos: [
      { nome:'OFFCampus na Copa', tipo:'Experiência Premium', data:'2026-12-31', local:'Curitiba, PR', capacidade:380, status:'em_breve',
        desc:'Música ao vivo, áreas VIP e networking com convidados especiais.', regras:'Documento obrigatório. +18.',
        metaPublico:340, metaFaturamento:60000,
        lotes:[
          {nome:'Lote Promocional', preco:49.90, disponivel:50, total:100},
          {nome:'1º Lote', preco:79.90, disponivel:200, total:300},
          {nome:'VIP', preco:149.90, disponivel:30, total:50},
          {nome:'Open Bar', preco:199.90, disponivel:20, total:30},
        ]},
      { nome:'Resenha do Portes', tipo:'Festival Eletrônico', data:'2026-11-15', local:'Curitiba, PR', capacidade:470, status:'ativo',
        desc:'Line-up exclusivo, produção premium.', regras:'Documento obrigatório.',
        metaPublico:420, metaFaturamento:45000,
        lotes:[
          {nome:'1º Lote', preco:69.90, disponivel:150, total:250},
          {nome:'2º Lote', preco:99.90, disponivel:100, total:200},
          {nome:'Camarote', preco:179.90, disponivel:15, total:20},
        ]},
      { nome:'Halloween OffCampus', tipo:'Ambiente VIP', data:'2026-10-31', local:'Curitiba, PR', capacidade:610, status:'ativo',
        desc:'A maior festa de Halloween universitária do sul do Brasil.', regras:'Estudantes com carteirinha têm 20% de desconto.',
        metaPublico:550, metaFaturamento:52000,
        lotes:[
          {nome:'Lote Estudante', preco:39.90, disponivel:80, total:150},
          {nome:'1º Lote', preco:59.90, disponivel:200, total:400},
          {nome:'VIP + Open Food', preco:129.90, disponivel:40, total:60},
        ]},
    ],
    bar: [
      {nome:'Cerveja Long Neck', emoji:'🍺', cat:'Cerveja', custo:4.50, estoque:240, minimo:40},
      {nome:'Vodka 1L', emoji:'🥃', cat:'Destilado', custo:28.00, estoque:42, minimo:10},
      {nome:'Gin Tônica Kit', emoji:'🍹', cat:'Destilado', custo:22.00, estoque:55, minimo:10},
      {nome:'Energético 473ml', emoji:'⚡', cat:'Energético', custo:8.00, estoque:18, minimo:20},
      {nome:'Refrigerante 2L', emoji:'🥤', cat:'Refrigerante', custo:6.00, estoque:90, minimo:15},
      {nome:'Água 500ml', emoji:'💧', cat:'Água', custo:1.50, estoque:200, minimo:50},
    ],
    despesas: [
      {cat:'🛡️ Segurança', desc:'Equipe de segurança para 3 eventos', valor:42000},
      {cat:'📣 Marketing', desc:'Redes sociais + panfletos', valor:28000},
      {cat:'🍺 Bebidas', desc:'Estoque para Open Bar', valor:38000},
      {cat:'🏗️ Estrutura', desc:'Palco, som, iluminação', valor:26000},
      {cat:'🎤 DJs/Atrações', desc:'Line-up confirmado', valor:49000},
    ],
    entries: [
      {nome:'João Cardoso', codigo:'RDP-VIP-7891', evento:'Resenha do Portes', hora: fmt(new Date(Date.now()-3600000*2))},
      {nome:'Ana Lima', codigo:'OFF-OPB-4521', evento:'OFFCampus na Copa', hora: fmt(new Date(Date.now()-3600000))},
      {nome:'Pedro Souza', codigo:'HAL-EST-9012', evento:'Halloween OffCampus', hora: fmt(new Date(Date.now()-1800000))},
    ],
    participantes: [
      {nome:'João Cardoso', email:'demo@evotech.com', cpf:'111.111.111-11', tel:'(41) 98888-8888', ingressos:2, status:'ativo'},
      {nome:'Ana Lima', email:'ana@exemplo.com', cpf:'222.222.222-22', tel:'(41) 97777-7777', ingressos:1, status:'ativo'},
      {nome:'Pedro Souza', email:'pedro@exemplo.com', cpf:'333.333.333-33', tel:'(41) 96666-6666', ingressos:3, status:'ativo'},
      {nome:'Maria Santos', email:'maria@exemplo.com', cpf:'444.444.444-44', tel:'(41) 95555-5555', ingressos:1, status:'bloqueado'},
    ],
    contatos: [
      {nome:'DJ KassiBeat', cargo:'DJ Residente', email:'dj@kassib.com', tel:'(41) 99111-2222', cat:'Artista / DJ', valor:3500, obs:'Disponível nas sextas.'},
      {nome:'Lucas Portaria', cargo:'Coordenador de Segurança', email:'lucas@sec.com', tel:'(41) 99333-4444', cat:'Segurança', valor:1200, obs:'Traz equipe de 10 pessoas.'},
      {nome:'BebidaTop Distribuidora', cargo:'Fornecedor de Bebidas', email:'vendas@bebidatop.com', tel:'(41) 3333-4444', cat:'Fornecedor', valor:0, obs:'Entrega 48h antes.'},
    ],
    equipe: [
      {nome:'Admin EvoTech', email:'admin@evotech.com', perfil:'Admin', status:'ativo'},
      {nome:'Carla Financeiro', email:'carla@evotech.com', perfil:'Financeiro', status:'ativo'},
      {nome:'Diego Portaria', email:'diego@evotech.com', perfil:'Operador Portaria', status:'ativo'},
      {nome:'Bia Bar', email:'bia@evotech.com', perfil:'Operador Bar', status:'ativo'},
    ],
    auditLog: [
      {hora: fmt(new Date(Date.now()-3600000*5)), usuario:'Admin EvoTech', acao:'Sistema inicializado — dados de demonstração carregados'},
    ],
    sistema: {
      modoContingencia: false,
      ultimoBackup: Date.now() - 3600000*3,
      uptimeStart: Date.now() - 3600000*72,
    },
    unitEcon: { cac: 850, churn: 4, take: 6 },
  };
}

function saveState() { LS.set('evotech_admin', STATE); }

/* ===== AUDITORIA ===== */
function logAudit(acao) {
  if (!STATE.auditLog) STATE.auditLog = [];
  const session = getSession();
  const usuario = session?.nome || 'Admin EvoTech';
  STATE.auditLog.push({ hora: new Date().toLocaleString('pt-BR'), usuario, acao });
  if (STATE.auditLog.length > 300) STATE.auditLog = STATE.auditLog.slice(-300);
  saveState();
}

function fmt(d) {
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  return `${h}:${m}`;
}

let STATE = loadState();
let selectedEventoIdx = null;

/* ===== MIGRAÇÃO / COMPATIBILIDADE (para quem já tinha dados salvos) ===== */
function migrateState() {
  if (!STATE.equipe) STATE.equipe = [
    {nome:'Admin EvoTech', email:'admin@evotech.com', perfil:'Admin', status:'ativo'},
  ];
  if (!STATE.auditLog) STATE.auditLog = [];
  if (!STATE.sistema) STATE.sistema = { modoContingencia:false, ultimoBackup:Date.now(), uptimeStart:Date.now() };
  if (!STATE.unitEcon) STATE.unitEcon = { cac:850, churn:4, take:6 };
  (STATE.eventos||[]).forEach(ev => {
    if (ev.metaPublico == null) ev.metaPublico = Math.round((ev.capacidade||0) * 0.85);
    if (ev.metaFaturamento == null) {
      const receitaAtual = (ev.lotes||[]).reduce((a,l)=>a+(l.total-l.disponivel)*l.preco,0);
      ev.metaFaturamento = Math.round((receitaAtual || (ev.capacidade||0)*80) * 1.15);
    }
  });
  saveState();
}
migrateState();

/* ===== SESSÃO / LOGOUT ===== */
function getSession() {
  try { return JSON.parse(localStorage.getItem('evo_session')); } catch (e) { return null; }
}

function initAdminInfo() {
  const session = getSession();
  if (!session) return;
  const initials = session.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  document.getElementById('admin-avatar').textContent = initials || 'A';
  document.getElementById('admin-name').textContent = session.nome;
}

function adminLogout() {
  localStorage.removeItem('evo_session');
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

  renderAll();
}

function openPrimaryAction() { /* handled per-panel */ }

/* ===== RENDER ALL ===== */
function renderAll() {
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

function salvarEvento() {
  const idx = parseInt(document.getElementById('evento-edit-idx').value);
  const ev = {
    nome: document.getElementById('ev-nome').value.trim(),
    tipo: document.getElementById('ev-tipo').value,
    data: document.getElementById('ev-data').value,
    local: document.getElementById('ev-local').value.trim(),
    capacidade: parseInt(document.getElementById('ev-capacidade').value)||0,
    status: document.getElementById('ev-status').value,
    desc: document.getElementById('ev-desc').value.trim(),
    regras: document.getElementById('ev-regras').value.trim(),
    lotes: idx >= 0 ? STATE.eventos[idx].lotes : [],
  };
  if(!ev.nome) { toast('Nome do evento obrigatório','error'); return; }
  if(idx >= 0) STATE.eventos[idx] = ev; else { ev.metaPublico = Math.round(ev.capacidade*0.85); ev.metaFaturamento = Math.round(ev.capacidade*80); STATE.eventos.push(ev); }
  saveState(); closeModal('modal-evento'); renderAll();
  logAudit(idx>=0 ? `Editou o evento "${ev.nome}"` : `Criou o evento "${ev.nome}"`);
  toast(idx>=0 ? 'Evento atualizado!' : 'Evento criado!','success');
}

function delEvento(idx) {
  const nome = STATE.eventos[idx].nome;
  if(!confirm(`Remover "${nome}"?`)) return;
  STATE.eventos.splice(idx,1);
  if(selectedEventoIdx===idx) { selectedEventoIdx=null; document.getElementById('lotes-section').style.display='none'; }
  saveState(); renderAll();
  logAudit(`Removeu o evento "${nome}"`);
  toast('Evento removido','success');
}

/* ===== LOTES ===== */
function verLotes(idx) {
  selectedEventoIdx = idx;
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

function alterarDisp(loteIdx, delta) {
  const lote = STATE.eventos[selectedEventoIdx].lotes[loteIdx];
  lote.disponivel = Math.max(0, Math.min(lote.total, lote.disponivel + delta));
  saveState(); renderLotes(); renderDashboard();
}

function alterarTotal(loteIdx, delta) {
  const lote = STATE.eventos[selectedEventoIdx].lotes[loteIdx];
  lote.total = Math.max(lote.total - lote.disponivel, lote.total + delta);
  if(lote.disponivel > lote.total) lote.disponivel = lote.total;
  saveState(); renderLotes(); renderDashboard();
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

function salvarLote() {
  if(selectedEventoIdx===null) return;
  const idx = parseInt(document.getElementById('lote-edit-idx').value);
  const lote = {
    nome: document.getElementById('lote-nome').value.trim(),
    preco: parseFloat(document.getElementById('lote-preco').value)||0,
    disponivel: parseInt(document.getElementById('lote-disp').value)||0,
    total: parseInt(document.getElementById('lote-total').value)||0,
  };
  if(!lote.nome) { toast('Nome do lote obrigatório','error'); return; }
  const lotes = STATE.eventos[selectedEventoIdx].lotes;
  if(idx>=0) lotes[idx]=lote; else lotes.push(lote);
  saveState(); closeModal('modal-lote'); renderLotes(); renderDashboard();
  toast(idx>=0?'Lote atualizado!':'Lote criado!','success');
}

function delLote(idx) {
  STATE.eventos[selectedEventoIdx].lotes.splice(idx,1);
  saveState(); renderLotes(); toast('Lote removido','success');
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

function alterarBar(idx, delta) {
  STATE.bar[idx].estoque = Math.max(0, STATE.bar[idx].estoque + delta);
  saveState(); renderBar(); renderDashboard();
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

function salvarBarItem() {
  const idx = parseInt(document.getElementById('bar-edit-idx').value);
  const item = {
    nome: document.getElementById('bar-nome').value.trim(),
    emoji: document.getElementById('bar-emoji').value.trim() || '🍶',
    cat: document.getElementById('bar-cat').value,
    custo: parseFloat(document.getElementById('bar-custo').value)||0,
    estoque: parseInt(document.getElementById('bar-estoque').value)||0,
    minimo: parseInt(document.getElementById('bar-minimo').value)||0,
  };
  if(!item.nome) { toast('Nome obrigatório','error'); return; }
  if(idx>=0) STATE.bar[idx]=item; else STATE.bar.push(item);
  saveState(); closeModal('modal-bar'); renderBar(); renderDashboard();
  logAudit(`${idx>=0?'Editou':'Adicionou'} item do bar "${item.nome}"`);
  toast(idx>=0?'Item atualizado!':'Item adicionado!','success');
}

function delBarItem(idx) {
  if(!confirm(`Remover "${STATE.bar[idx].nome}"?`)) return;
  STATE.bar.splice(idx,1);
  saveState(); renderBar(); toast('Item removido','success');
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

function registrarEntrada() {
  const codigo = document.getElementById('scan-input').value.trim().toUpperCase();
  if(!codigo) { toast('Digite um código','error'); return; }
  const ev = STATE.eventos.find(e => e.lotes.some(l => l.nome.toUpperCase().includes(codigo.slice(0,3))));
  const entry = {
    nome: 'Portador do ingresso',
    codigo,
    evento: ev ? ev.nome : 'Evento desconhecido',
    hora: fmt(new Date()),
  };
  STATE.entries.push(entry);
  document.getElementById('scan-input').value = '';
  saveState(); renderPortaria(); renderDashboard(); renderComparativo();
  logAudit(`Check-in via QR/código "${codigo}" — ${entry.evento}`);

  const box = document.getElementById('scan-box');
  box.style.borderColor='var(--green)';
  setTimeout(()=>box.style.borderColor='',1500);
  toast('✓ Entrada registrada!','success');
}

function registrarManual() {
  const nome = document.getElementById('manual-nome').value.trim();
  const evento = document.getElementById('manual-evento').value;
  if(!nome) { toast('Informe o nome','error'); return; }
  if(!evento) { toast('Selecione o evento','error'); return; }
  STATE.entries.push({nome, codigo:'', evento, hora: fmt(new Date())});
  document.getElementById('manual-nome').value = '';
  saveState(); renderPortaria(); renderDashboard(); renderComparativo();
  logAudit(`Check-in manual de "${nome}" — ${evento}`);
  toast(`${nome} registrado(a)!`,'success');
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

function salvarDespesa() {
  const idx = parseInt(document.getElementById('desp-edit-idx').value);
  const d = {
    cat: document.getElementById('desp-cat').value,
    valor: parseFloat(document.getElementById('desp-valor').value)||0,
    desc: document.getElementById('desp-desc').value.trim(),
  };
  if(!d.valor) { toast('Informe o valor','error'); return; }
  if(idx>=0) STATE.despesas[idx]=d; else STATE.despesas.push(d);
  saveState(); closeModal('modal-despesa'); renderFinanceiro(); renderDashboard();
  logAudit(`${idx>=0?'Editou':'Registrou'} despesa "${d.cat}" — ${fmt_brl(d.valor)}`);
  toast(idx>=0?'Despesa atualizada!':'Despesa adicionada!','success');
}

function delDespesa(idx) {
  STATE.despesas.splice(idx,1);
  saveState(); renderFinanceiro(); renderDashboard(); toast('Despesa removida','success');
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
        <button class="btn btn-danger btn-sm" onclick="delPart(${idx})" style="margin-left:4px">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function togglePart(idx) {
  STATE.participantes[idx].status = STATE.participantes[idx].status==='ativo'?'bloqueado':'ativo';
  saveState(); renderParticipantes(); toast('Status atualizado','success');
}

function delPart(idx) {
  if(!confirm('Remover participante?')) return;
  STATE.participantes.splice(idx,1);
  saveState(); renderParticipantes(); toast('Participante removido','success');
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

function salvarContato() {
  const idx = parseInt(document.getElementById('cont-edit-idx').value);
  const c = {
    nome: document.getElementById('cont-nome').value.trim(),
    cargo: document.getElementById('cont-cargo').value.trim(),
    email: document.getElementById('cont-email').value.trim(),
    tel: document.getElementById('cont-tel').value.trim(),
    cat: document.getElementById('cont-cat').value,
    valor: parseFloat(document.getElementById('cont-valor').value)||0,
    obs: document.getElementById('cont-obs').value.trim(),
  };
  if(!c.nome) { toast('Nome obrigatório','error'); return; }
  if(idx>=0) STATE.contatos[idx]=c; else STATE.contatos.push(c);
  saveState(); closeModal('modal-contato'); renderContatos();
  toast(idx>=0?'Contato atualizado!':'Contato adicionado!','success');
}

function delContato(idx) {
  if(!confirm('Remover contato?')) return;
  STATE.contatos.splice(idx,1);
  saveState(); renderContatos(); toast('Contato removido','success');
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

function atualizarMeta(idx, campo, valor) {
  STATE.eventos[idx][campo] = parseFloat(valor)||0;
  saveState(); renderMetas(); renderDashboard();
  logAudit(`Ajustou ${campo==='metaPublico'?'meta de público':'meta de faturamento'} de "${STATE.eventos[idx].nome}"`);
  toast('Meta atualizada!','success');
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
  STATE.unitEcon.cac = parseFloat(document.getElementById('ue-cac').value)||0;
  STATE.unitEcon.churn = parseFloat(document.getElementById('ue-churn').value)||0.1;
  STATE.unitEcon.take = parseFloat(document.getElementById('ue-take').value)||0;
  saveState(); renderUnitEconomics(false);
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
function downloadFile(filename, content, mime='text/plain') {
  const blob = new Blob([content],{type:mime});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function toCSV(rows, headers) {
  const esc = v => `"${String(v??'').replace(/"/g,'""')}"`;
  return [headers.join(','), ...rows.map(r => headers.map(h=>esc(r[h])).join(','))].join('\n');
}

function exportCSV(tipo) {
  let csv='', filename='';
  if (tipo==='eventos') {
    const rows = STATE.eventos.map(ev => { const st=eventoStats(ev); return {
      nome:ev.nome, data:ev.data, local:ev.local, capacidade:ev.capacidade, vendidos:st.vendidos,
      ocupacao_pct:Math.round(st.ocupacao), receita:st.receita.toFixed(2), ticket_medio:st.ticketMedio.toFixed(2), status:ev.status };
    });
    csv = toCSV(rows, ['nome','data','local','capacidade','vendidos','ocupacao_pct','receita','ticket_medio','status']);
    filename = 'evotech-eventos.csv';
  } else if (tipo==='participantes') {
    csv = toCSV(STATE.participantes, ['nome','email','cpf','tel','ingressos','status']);
    filename = 'evotech-participantes.csv';
  } else if (tipo==='despesas') {
    csv = toCSV(STATE.despesas.map(d=>({...d, valor:d.valor.toFixed(2)})), ['cat','desc','valor']);
    filename = 'evotech-despesas.csv';
  } else if (tipo==='bar') {
    csv = toCSV(STATE.bar.map(b=>({...b, custo:b.custo.toFixed(2)})), ['nome','cat','estoque','minimo','custo']);
    filename = 'evotech-estoque-bar.csv';
  }
  downloadFile(filename, csv, 'text/csv');
  logAudit(`Exportou relatório CSV: ${tipo}`);
  toast('CSV exportado!','success');
}

function exportRelatorioExecutivo() {
  const totalReceita = STATE.eventos.reduce((a,ev)=>a+eventoStats(ev).receita,0);
  const totalDespesas = STATE.despesas.reduce((a,d)=>a+d.valor,0);
  const totalVendidos = STATE.eventos.reduce((a,ev)=>a+eventoStats(ev).vendidos,0);
  let txt = `EVOTECH EVENTS — RELATÓRIO EXECUTIVO\nGerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
  txt += `RESUMO GERAL\n------------\nEventos cadastrados: ${STATE.eventos.length}\nIngressos vendidos: ${totalVendidos}\nReceita total: ${fmt_brl(totalReceita)}\nDespesas totais: ${fmt_brl(totalDespesas)}\nSaldo: ${fmt_brl(totalReceita-totalDespesas)}\n\n`;
  txt += `EVENTOS\n-------\n`;
  STATE.eventos.forEach(ev => {
    const st = eventoStats(ev);
    txt += `- ${ev.nome} | ${ev.local} | ${ev.data||'a definir'} | Ocupação: ${Math.round(st.ocupacao)}% | Receita: ${fmt_brl(st.receita)} | Ticket médio: ${fmt_brl(st.ticketMedio)} | Meta público: ${ev.metaPublico} | Meta faturamento: ${fmt_brl(ev.metaFaturamento||0)}\n`;
  });
  txt += `\nDESPESAS POR CATEGORIA\n-----------------------\n`;
  STATE.despesas.forEach(d => { txt += `- ${d.cat}: ${fmt_brl(d.valor)} (${d.desc})\n`; });
  txt += `\nESTE RELATÓRIO FOI GERADO AUTOMATICAMENTE PELA PLATAFORMA EVOTECH EVENTS.\n`;
  downloadFile(`evotech-relatorio-executivo-${new Date().toISOString().slice(0,10)}.txt`, txt);
  logAudit('Gerou o relatório executivo');
  toast('Relatório executivo gerado!','success');
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
function salvarEquipe() {
  const idx = parseInt(document.getElementById('eq-edit-idx').value);
  const m = {
    nome: document.getElementById('eq-nome').value.trim(),
    email: document.getElementById('eq-email').value.trim(),
    perfil: document.getElementById('eq-perfil').value,
    status: document.getElementById('eq-status').value,
  };
  if (!m.nome) { toast('Nome obrigatório','error'); return; }
  if (idx>=0) STATE.equipe[idx]=m; else STATE.equipe.push(m);
  saveState(); closeModal('modal-equipe'); renderEquipe();
  logAudit(`${idx>=0?'Editou':'Adicionou'} membro da equipe "${m.nome}" (${m.perfil})`);
  toast(idx>=0?'Membro atualizado!':'Membro adicionado!','success');
}
function toggleEquipe(idx) {
  STATE.equipe[idx].status = STATE.equipe[idx].status==='ativo'?'inativo':'ativo';
  saveState(); renderEquipe();
  logAudit(`Alterou status de "${STATE.equipe[idx].nome}" para ${STATE.equipe[idx].status}`);
  toast('Status atualizado','success');
}
function delEquipe(idx) {
  const nome = STATE.equipe[idx].nome;
  if(!confirm(`Remover "${nome}" da equipe?`)) return;
  STATE.equipe.splice(idx,1);
  saveState(); renderEquipe();
  logAudit(`Removeu "${nome}" da equipe`);
  toast('Membro removido','success');
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
  STATE.sistema.modoContingencia = document.getElementById('toggle-contingencia').checked;
  saveState(); renderSistema(); renderAlertasCentral();
  logAudit(`${STATE.sistema.modoContingencia?'Ativou':'Desativou'} o modo contingência/offline`);
  toast(STATE.sistema.modoContingencia?'Modo contingência ativado':'Modo contingência desativado', STATE.sistema.modoContingencia?'error':'success');
}

function fazerBackupAgora() {
  STATE.sistema.ultimoBackup = Date.now();
  saveState(); renderSistema();
  logAudit('Executou backup manual dos dados');
  exportData();
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

function exportData() {
  const data = JSON.stringify(STATE, null, 2);
  const blob = new Blob([data],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `evotech-admin-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  toast('Dados exportados!','success');
}

/* Atualiza o dashboard automaticamente a cada minuto (countdown, uptime, etc.) */
setInterval(() => {
  if (document.getElementById('panel-dashboard')?.classList.contains('active')) renderDashboard();
  if (document.getElementById('panel-sistema')?.classList.contains('active')) renderSistema();
}, 60000);

/* ===== INIT ===== */
renderAll();
