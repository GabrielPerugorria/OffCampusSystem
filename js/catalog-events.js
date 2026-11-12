/**
 * EVOTECH EVENTS — CATÁLOGO EXCLUSIVO & PLATAFORMA DE DESCOBERTA DE EVENTOS
 * Motor completo de pesquisa, filtros combinados, drawer avançado,
 * sincronização com URL, modal de detalhes e integração com a API.
 */

(function () {
  'use strict';

  // ── Mapeamento Dinâmico de Cidades por UF ──
  const CIDADES_POR_UF = {
    PR: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'Foz do Iguaçu'],
    SP: ['São Paulo', 'Campinas', 'Santos', 'Ribeirão Preto', 'Sorocaba', 'São José dos Campos', 'Ilhabela'],
    RJ: ['Rio de Janeiro', 'Niterói', 'Búzios', 'Angra dos Reis', 'Petrópolis', 'Cabo Frio'],
    SC: ['Florianópolis', 'Balneário Camboriú', 'Joinville', 'Blumenau', 'Itajaí', 'Criciúma'],
    RS: ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Santa Maria', 'Gramado', 'Passo Fundo'],
    MG: ['Belo Horizonte', 'Uberlândia', 'Juiz de Fora', 'Ouro Preto', 'Tiradentes', 'Contagem'],
    BA: ['Salvador', 'Porto Seguro', 'Trancoso', 'Feira de Santana', 'Vitória da Conquista'],
    DF: ['Brasília', 'Taguatinga', 'Águas Claras'],
    GO: ['Goiânia', 'Anápolis', 'Pirenópolis', 'Rio Verde']
  };

  // ── Base de Eventos do Sistema (com metadados completos de filtragem) ──
  const EVENTOS_CATALOGO_DEFAULT = [
    {
      id: 1,
      slug: 'offcampus-na-copa',
      nome: 'OFFCampus na Copa?',
      tipo: 'Experiência Premium',
      categoria: 'Festa universitária',
      estiloMusical: 'Eletrônica',
      data: '2026-12-31 22:00:00',
      dataExibicao: '31 de Dezembro de 2026',
      local: 'Sunset Lounge',
      cidade: 'Curitiba',
      uf: 'PR',
      faixaEtaria: 18,
      faixaEtariaRotulo: '18 anos',
      openBar: true,
      openFood: false,
      areaVip: true,
      camarote: false,
      emDestaque: true,
      statusIngressos: 'Próximo',
      img: 'imagens/offcampushexa.png',
      desc: 'Música ao vivo, áreas VIP, open bar completo e networking com convidados especiais rumo ao hexa.',
      regras: 'Documento oficial com foto obrigatório. Classificação +18 anos.',
      lotes: [
        { id: 101, nome: 'Lote Promocional', preco: 49.90, disponivel: 50, total: 100 },
        { id: 102, nome: '1º Lote', preco: 79.90, disponivel: 200, total: 300 },
        { id: 103, nome: 'Área VIP', preco: 149.90, disponivel: 30, total: 50 },
        { id: 104, nome: 'Open Bar Prime', preco: 199.90, disponivel: 20, total: 30 }
      ]
    },
    {
      id: 2,
      slug: 'resenha-do-portes',
      nome: 'Resenha do Portes',
      tipo: 'Festival Eletrônico',
      categoria: 'Festival',
      estiloMusical: 'Eletrônica',
      data: '2026-11-15 23:00:00',
      dataExibicao: '15 de Novembro de 2026',
      local: 'Arena Music Park',
      cidade: 'Curitiba',
      uf: 'PR',
      faixaEtaria: 18,
      faixaEtariaRotulo: '18 anos',
      openBar: false,
      openFood: false,
      areaVip: true,
      camarote: true,
      emDestaque: true,
      statusIngressos: 'Eletrônico',
      img: 'imagens/resenhadoportes.png',
      desc: 'Line-up exclusivo com DJs renomados, som de alta precisão e produção premium para uma noite histórica.',
      regras: 'Classificação 18 anos. Proibida a entrada com bebidas externas.',
      lotes: [
        { id: 201, nome: '1º Lote', preco: 69.90, disponivel: 150, total: 250 },
        { id: 202, nome: '2º Lote', preco: 99.90, disponivel: 100, total: 200 },
        { id: 203, nome: 'Camarote', preco: 179.90, disponivel: 15, total: 20 }
      ]
    },
    {
      id: 3,
      slug: 'halloween-offcampus',
      nome: 'Halloween OffCampus',
      tipo: 'Ambiente VIP',
      categoria: 'Festa temática',
      estiloMusical: 'Pop',
      data: '2026-10-31 22:00:00',
      dataExibicao: '31 de Outubro de 2026',
      local: 'Mansão Boulevard',
      cidade: 'Curitiba',
      uf: 'PR',
      faixaEtaria: 18,
      faixaEtariaRotulo: '18 anos',
      openBar: false,
      openFood: true,
      areaVip: true,
      camarote: false,
      emDestaque: true,
      statusIngressos: 'Destaque',
      img: 'imagens/halloween.png',
      desc: 'A maior festa temática universitária com open food gourmet, decoração cenográfica imersiva e concurso de fantasias.',
      regras: 'Estudantes com comprovante possuem benefícios. Fantasia recomendada. +18.',
      lotes: [
        { id: 301, nome: 'Lote Estudante', preco: 39.90, disponivel: 80, total: 150 },
        { id: 302, nome: '1º Lote Geral', preco: 59.90, disponivel: 200, total: 400 },
        { id: 303, nome: 'VIP + Open Food', preco: 129.90, disponivel: 40, total: 60 }
      ]
    },
    {
      id: 4,
      slug: 'sunset-eletronico-ilhabela',
      nome: 'Sunset Eletrônico Ilhabela',
      tipo: 'Sunset & Balada',
      categoria: 'Sunset',
      estiloMusical: 'Eletrônica',
      data: '2026-11-28 16:00:00',
      dataExibicao: '28 de Novembro de 2026',
      local: 'Beach Club Paradise',
      cidade: 'Ilhabela',
      uf: 'SP',
      faixaEtaria: 18,
      faixaEtariaRotulo: '18 anos',
      openBar: true,
      openFood: false,
      areaVip: true,
      camarote: true,
      emDestaque: false,
      statusIngressos: 'Últimos ingressos',
      img: 'imagens/offcampushexa.png',
      desc: 'Pôr do sol à beira-mar com DJs do cenário nacional de Deep House e Melodic Techno.',
      regras: 'Evento para maiores de 18 anos com documento oficial.',
      lotes: [
        { id: 401, nome: 'Ingresso Sunset Pista', preco: 85.00, disponivel: 35, total: 120 },
        { id: 402, nome: 'Backstage Open Bar', preco: 180.00, disponivel: 12, total: 50 }
      ]
    },
    {
      id: 5,
      slug: 'baile-das-atleticas-sp',
      nome: 'Baile das Atléticas SP',
      tipo: 'Festa de Atlética',
      categoria: 'Festa universitária',
      estiloMusical: 'Funk',
      data: '2026-11-21 21:00:00',
      dataExibicao: '21 de Novembro de 2026',
      local: 'Espaço Barra Funda',
      cidade: 'São Paulo',
      uf: 'SP',
      faixaEtaria: 18,
      faixaEtariaRotulo: '18 anos',
      openBar: true,
      openFood: false,
      areaVip: false,
      camarote: true,
      emDestaque: false,
      statusIngressos: '1º Lote',
      img: 'imagens/resenhadoportes.png',
      desc: 'A união das maiores atléticas acadêmicas de São Paulo em um mega open bar universitário com funk e trap.',
      regras: 'Classificação 18 anos. Obrigatório documento com foto.',
      lotes: [
        { id: 501, nome: 'Pista Open Bar Aluno', preco: 45.00, disponivel: 120, total: 200 },
        { id: 502, nome: 'Pista Open Bar Não-Aluno', preco: 65.00, disponivel: 90, total: 150 }
      ]
    },
    {
      id: 6,
      slug: 'pagode-no-parque-rio',
      nome: 'Pagode no Parque Rio',
      tipo: 'Show ao Vivo',
      categoria: 'Show',
      estiloMusical: 'Pagode',
      data: '2026-12-05 15:00:00',
      dataExibicao: '05 de Dezembro de 2026',
      local: 'Marina da Glória',
      cidade: 'Rio de Janeiro',
      uf: 'RJ',
      faixaEtaria: 0,
      faixaEtariaRotulo: 'Livre',
      openBar: false,
      openFood: false,
      areaVip: true,
      camarote: false,
      emDestaque: false,
      statusIngressos: 'Disponível',
      img: 'imagens/halloween.png',
      desc: 'Tardezinha de samba e pagode com roda ao vivo, gastronomia e vista deslumbrante para o Pão de Açúcar.',
      regras: 'Classificação Livre. Menores de 16 acompanhados dos responsáveis.',
      lotes: [
        { id: 601, nome: 'Entrada Geral', preco: 50.00, disponivel: 150, total: 300 },
        { id: 602, nome: 'Frontstage Premium', preco: 110.00, disponivel: 40, total: 80 }
      ]
    },
    {
      id: 7,
      slug: 'festival-som-sol-florianopolis',
      nome: 'Festival Som & Sol Floripa',
      tipo: 'Festival Multicultural',
      categoria: 'Festival',
      estiloMusical: 'Multigênero',
      data: '2026-12-12 14:00:00',
      dataExibicao: '12 de Dezembro de 2026',
      local: 'Jurerê Internacional Open Air',
      cidade: 'Florianópolis',
      uf: 'SC',
      faixaEtaria: 16,
      faixaEtariaRotulo: '16 anos',
      openBar: false,
      openFood: false,
      areaVip: true,
      camarote: true,
      emDestaque: false,
      statusIngressos: 'Pré-venda',
      img: 'imagens/offcampushexa.png',
      desc: 'Festival com mais de 10 atrações entre rock alternativo, pop nacional e eletrônica em Jurerê.',
      regras: 'Classificação 16 anos. Menores de 16 anos apenas com termo assinado pelos pais.',
      lotes: [
        { id: 701, nome: 'Passaporte Geral', preco: 95.00, disponivel: 80, total: 200 },
        { id: 702, nome: 'Camarote Open Air', preco: 185.00, disponivel: 25, total: 60 }
      ]
    },
    {
      id: 8,
      slug: 'sertanejo-vip-exclusive-bh',
      nome: 'Sertanejo VIP Exclusive',
      tipo: 'Balada Sertaneja',
      categoria: 'Balada',
      estiloMusical: 'Sertanejo',
      data: '2026-11-20 22:30:00',
      dataExibicao: '20 de Novembro de 2026',
      local: 'Clube Chalezinho',
      cidade: 'Belo Horizonte',
      uf: 'MG',
      faixaEtaria: 18,
      faixaEtariaRotulo: '18 anos',
      openBar: false,
      openFood: false,
      areaVip: true,
      camarote: true,
      emDestaque: false,
      statusIngressos: 'Disponível',
      img: 'imagens/resenhadoportes.png',
      desc: 'A melhor noite sertaneja de BH com duplas consagradas, camarotes exclusivos e ambiente climatizado.',
      regras: 'Entrada proibida com bermuda ou chinelo. Classificação 18 anos.',
      lotes: [
        { id: 801, nome: 'Feminino 1º Lote', preco: 40.00, disponivel: 60, total: 100 },
        { id: 802, nome: 'Masculino 1º Lote', preco: 60.00, disponivel: 70, total: 120 }
      ]
    },
    {
      id: 9,
      slug: 'noite-eletronica-club-porto-alegre',
      nome: 'Noite Eletrônica Club POA',
      tipo: 'Club Noturno',
      categoria: 'Balada',
      estiloMusical: 'Eletrônica',
      data: '2026-11-14 23:00:00',
      dataExibicao: '14 de Novembro de 2026',
      local: 'Club 88 Sunset Room',
      cidade: 'Porto Alegre',
      uf: 'RS',
      faixaEtaria: 18,
      faixaEtariaRotulo: '18 anos',
      openBar: false,
      openFood: false,
      areaVip: true,
      camarote: true,
      emDestaque: false,
      statusIngressos: '1º Lote',
      img: 'imagens/halloween.png',
      desc: 'Noite de Tech House e Techno no coração de Porto Alegre com sistema de som Funktion-One.',
      regras: 'Classificação 18 anos com documento original.',
      lotes: [
        { id: 901, nome: 'Lote Antecipado', preco: 55.00, disponivel: 45, total: 90 },
        { id: 902, nome: 'VIP Backstage', preco: 120.00, disponivel: 10, total: 30 }
      ]
    }
  ];

  let todosEventos = [];
  let eventosFiltrados = [];

  // Estado dos Filtros
  const filtros = {
    q: '',
    uf: '',
    cidade: '',
    periodo: '',
    dataEspecifica: '',
    estilos: [], // array de estilos musicais
    tipos: [],   // array de categorias/tipos de evento
    faixasEtarias: [], // [0, 16, 18]
    precoMax: 300,
    apenasGratuito: false,
    openBar: false,
    openFood: false,
    areaVip: false,
    camarote: false,
    ingressosDisponiveis: false,
    ordenacao: 'relevantes'
  };

  // ── Elementos do DOM ──
  const searchInput = document.getElementById('catalogSearchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const stateSelect = document.getElementById('catalogStateSelect');
  const citySelect = document.getElementById('catalogCitySelect');
  const dateSelect = document.getElementById('catalogDateSelect');
  const sortSelect = document.getElementById('catalogSortSelect');
  const btnSearchSubmit = document.getElementById('btnSearchSubmit');
  const btnOpenFilters = document.getElementById('btnOpenFiltersModal');
  const btnCloseDrawer = document.getElementById('btnCloseFiltersDrawer');
  const drawerOverlay = document.getElementById('filtersDrawerOverlay');
  const activeFiltersBadge = document.getElementById('activeFiltersBadge');
  const activeChipsContainer = document.getElementById('catalogActiveChips');
  const resultsCountEl = document.getElementById('catalogResultsCount');
  const gridContainer = document.getElementById('catalogEventsGrid');
  const btnDrawerApply = document.getElementById('btnDrawerApply');
  const btnDrawerClear = document.getElementById('btnDrawerClear');
  const priceSlider = document.getElementById('filterPriceSlider');
  const priceDisplay = document.getElementById('filterPriceValDisplay');

  // ── Inicialização ──
  async function init() {
    setupEventListeners();
    popularCidades();
    lerParametrosURL();
    await carregarEventos();
    aplicarFiltros();
  }

  // ── Carregamento de Eventos (API + Fallback com Metadados) ──
  async function carregarEventos() {
    gridContainer.innerHTML = Array(6).fill('<div class="catalog-skeleton-card"></div>').join('');
    try {
      if (typeof window.EvoAPI !== 'undefined') {
        const data = await window.EvoAPI.get('/public/events');
        if (Array.isArray(data) && data.length > 0) {
          // Mescla com eventos da API mantendo metadados ricos
          const apiMapped = data.map((ev, index) => {
            const fallback = EVENTOS_CATALOGO_DEFAULT.find(f => f.nome.toLowerCase() === (ev.name || '').toLowerCase()) ||
                             EVENTOS_CATALOGO_DEFAULT[index % EVENTOS_CATALOGO_DEFAULT.length];
            return {
              id: ev.id,
              slug: ev.slug || fallback.slug,
              nome: ev.name || fallback.nome,
              tipo: ev.type || fallback.tipo,
              categoria: fallback.categoria,
              estiloMusical: fallback.estiloMusical,
              data: ev.eventDate || fallback.data,
              dataExibicao: fallback.dataExibicao,
              local: ev.venue || fallback.local,
              cidade: fallback.cidade,
              uf: fallback.uf,
              faixaEtaria: fallback.faixaEtaria,
              faixaEtariaRotulo: fallback.faixaEtariaRotulo,
              openBar: fallback.openBar,
              openFood: fallback.openFood,
              areaVip: fallback.areaVip,
              camarote: fallback.camarote,
              emDestaque: fallback.emDestaque,
              statusIngressos: fallback.statusIngressos,
              img: ev.bannerUrl || fallback.img,
              desc: ev.description || fallback.desc,
              regras: ev.rules || fallback.regras,
              lotes: (ev.batches || []).length > 0 ? ev.batches.map(b => ({
                id: b.id,
                nome: b.name,
                preco: Number(b.price || 0),
                disponivel: Number(b.available || 0),
                total: Number(b.quantityTotal || 0)
              })) : fallback.lotes
            };
          });
          todosEventos = apiMapped;
        } else {
          todosEventos = [...EVENTOS_CATALOGO_DEFAULT];
        }
      } else {
        todosEventos = [...EVENTOS_CATALOGO_DEFAULT];
      }
    } catch (e) {
      console.warn('API de eventos offline. Usando catálogo integrado de demonstração:', e.message);
      todosEventos = [...EVENTOS_CATALOGO_DEFAULT];
    }

    // Calcula preço mínimo de cada evento
    todosEventos.forEach(ev => {
      if (Array.isArray(ev.lotes) && ev.lotes.length > 0) {
        ev.menorPreco = Math.min(...ev.lotes.map(l => l.preco));
      } else {
        ev.menorPreco = 0;
      }
    });
  }

  // ── Atualização do Dropdown de Cidades por UF ──
  function popularCidades(cidadePreSelecionada = '') {
    const uf = stateSelect.value;
    citySelect.innerHTML = '<option value="">Todas as Cidades</option>';

    if (uf && CIDADES_POR_UF[uf]) {
      CIDADES_POR_UF[uf].forEach(cid => {
        const opt = document.createElement('option');
        opt.value = cid;
        opt.textContent = cid;
        if (cid.toLowerCase() === cidadePreSelecionada.toLowerCase()) opt.selected = true;
        citySelect.appendChild(opt);
      });
      citySelect.disabled = false;
    } else {
      // Se nenhuma UF selecionada, pode listar cidades principais ou desabilitar
      citySelect.disabled = false;
    }
  }

  // ── Configuração de Listeners ──
  function setupEventListeners() {
    // Busca por texto
    searchInput.addEventListener('input', () => {
      searchClearBtn.style.display = searchInput.value ? 'block' : 'none';
      filtros.q = searchInput.value.trim();
      aplicarFiltros();
    });

    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchClearBtn.style.display = 'none';
      filtros.q = '';
      aplicarFiltros();
      searchInput.focus();
    });

    // Mudança de Estado
    stateSelect.addEventListener('change', () => {
      filtros.uf = stateSelect.value;
      filtros.cidade = '';
      popularCidades();
      aplicarFiltros();
    });

    // Mudança de Cidade
    citySelect.addEventListener('change', () => {
      filtros.cidade = citySelect.value;
      aplicarFiltros();
    });

    // Mudança de Período Rápido
    dateSelect.addEventListener('change', () => {
      filtros.periodo = dateSelect.value;
      aplicarFiltros();
    });

    // Ordenação
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        filtros.ordenacao = sortSelect.value;
        aplicarFiltros();
      });
    }

    // Botão Buscar
    btnSearchSubmit.addEventListener('click', () => {
      filtros.q = searchInput.value.trim();
      filtros.uf = stateSelect.value;
      filtros.cidade = citySelect.value;
      filtros.periodo = dateSelect.value;
      aplicarFiltros();
    });

    // Abertura e Fechamento do Drawer
    btnOpenFilters.addEventListener('click', () => {
      drawerOverlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });

    const closeDrawer = () => {
      drawerOverlay.classList.remove('is-open');
      document.body.style.overflow = '';
    };

    btnCloseDrawer.addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', e => {
      if (e.target === drawerOverlay) closeDrawer();
    });

    // Slider de Preço
    if (priceSlider && priceDisplay) {
      priceSlider.addEventListener('input', () => {
        const val = Number(priceSlider.value);
        filtros.precoMax = val;
        priceDisplay.textContent = val >= 300 ? 'Até R$ 300+ (Todos os preços)' : `Até R$ ${val.toFixed(2).replace('.', ',')}`;
      });
    }

    // Botão Aplicar no Drawer
    btnDrawerApply.addEventListener('click', () => {
      coletarFiltrosDoDrawer();
      closeDrawer();
      aplicarFiltros();
    });

    // Botão Limpar no Drawer
    btnDrawerClear.addEventListener('click', () => {
      resetarFiltros();
      closeDrawer();
      aplicarFiltros();
    });

    // Tecla Enter no campo de busca
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        filtros.q = searchInput.value.trim();
        aplicarFiltros();
      }
    });
  }

  // ── Coleta os Filtros do Drawer Modal ──
  function coletarFiltrosDoDrawer() {
    // Estilos Musicais
    const estilosCheck = document.querySelectorAll('input[name="filterEstilo"]:checked');
    filtros.estilos = Array.from(estilosCheck).map(c => c.value);

    // Tipos de Evento
    const tiposCheck = document.querySelectorAll('input[name="filterTipo"]:checked');
    filtros.tipos = Array.from(tiposCheck).map(c => c.value);

    // Faixas Etárias
    const idadesCheck = document.querySelectorAll('input[name="filterIdade"]:checked');
    filtros.faixasEtarias = Array.from(idadesCheck).map(c => Number(c.value));

    // Experiência e Estrutura
    filtros.openBar = document.getElementById('filterOpenBar')?.checked || false;
    filtros.openFood = document.getElementById('filterOpenFood')?.checked || false;
    filtros.areaVip = document.getElementById('filterAreaVip')?.checked || false;
    filtros.camarote = document.getElementById('filterCamarote')?.checked || false;
    filtros.ingressosDisponiveis = document.getElementById('filterDisponivel')?.checked || false;

    // Data Específica
    const dataEspInput = document.getElementById('filterDataEspecifica');
    filtros.dataEspecifica = dataEspInput ? dataEspInput.value : '';
  }

  // ── Aplicação e Lógica de Filtragem ──
  function aplicarFiltros() {
    eventosFiltrados = todosEventos.filter(ev => {
      // 1. Pesquisa Textual
      if (filtros.q) {
        const query = filtros.q.toLowerCase();
        const matchNome = (ev.nome || '').toLowerCase().includes(query);
        const matchLocal = (ev.local || '').toLowerCase().includes(query);
        const matchCidade = (ev.cidade || '').toLowerCase().includes(query);
        const matchDesc = (ev.desc || '').toLowerCase().includes(query);
        const matchEstilo = (ev.estiloMusical || '').toLowerCase().includes(query);
        const matchTipo = (ev.tipo || '').toLowerCase().includes(query);
        if (!matchNome && !matchLocal && !matchCidade && !matchDesc && !matchEstilo && !matchTipo) {
          return false;
        }
      }

      // 2. Estado (UF)
      if (filtros.uf && ev.uf !== filtros.uf) {
        return false;
      }

      // 3. Cidade
      if (filtros.cidade && ev.cidade.toLowerCase() !== filtros.cidade.toLowerCase()) {
        return false;
      }

      // 4. Período
      if (filtros.periodo) {
        const evDate = new Date(ev.data);
        const hoje = new Date();
        const diasDiff = (evDate - hoje) / (1000 * 60 * 60 * 24);

        if (filtros.periodo === 'hoje' && evDate.toDateString() !== hoje.toDateString()) return false;
        if (filtros.periodo === '7dias' && (diasDiff < -1 || diasDiff > 7)) return false;
        if (filtros.periodo === '30dias' && (diasDiff < -1 || diasDiff > 30)) return false;
        if (filtros.periodo === 'fds') {
          const diaSemana = evDate.getDay(); // 5 = Sex, 6 = Sáb, 0 = Dom
          if (diaSemana !== 5 && diaSemana !== 6 && diaSemana !== 0) return false;
        }
      }

      // 5. Data Específica
      if (filtros.dataEspecifica) {
        const evDateStr = ev.data.slice(0, 10);
        if (evDateStr !== filtros.dataEspecifica) return false;
      }

      // 6. Estilos Musicais (Se selecionou algum, o evento deve bater com um deles)
      if (filtros.estilos.length > 0) {
        const match = filtros.estilos.some(estilo =>
          (ev.estiloMusical || '').toLowerCase() === estilo.toLowerCase() ||
          (ev.tipo || '').toLowerCase().includes(estilo.toLowerCase()) ||
          (ev.desc || '').toLowerCase().includes(estilo.toLowerCase())
        );
        if (!match) return false;
      }

      // 7. Tipos de Evento
      if (filtros.tipos.length > 0) {
        const match = filtros.tipos.some(t =>
          (ev.categoria || '').toLowerCase().includes(t.toLowerCase()) ||
          (ev.tipo || '').toLowerCase().includes(t.toLowerCase())
        );
        if (!match) return false;
      }

      // 8. Faixa Etária
      if (filtros.faixasEtarias.length > 0) {
        const match = filtros.faixasEtarias.some(f => ev.faixaEtaria === f);
        if (!match) return false;
      }

      // 9. Preço Máximo
      if (filtros.precoMax < 300 && ev.menorPreco > filtros.precoMax) {
        return false;
      }

      // 10. Estrutura e Experiência
      if (filtros.openBar && !ev.openBar) return false;
      if (filtros.openFood && !ev.openFood) return false;
      if (filtros.areaVip && !ev.areaVip) return false;
      if (filtros.camarote && !ev.camarote) return false;

      return true;
    });

    // Ordenação
    ordenarEventos();

    // Renderiza resultados e chips
    renderizarChipsAtivos();
    renderizarGradeEventos();
    sincronizarURL();
  }

  // ── Ordenação de Resultados ──
  function ordenarEventos() {
    switch (filtros.ordenacao) {
      case 'preco_asc':
        eventosFiltrados.sort((a, b) => a.menorPreco - b.menorPreco);
        break;
      case 'preco_desc':
        eventosFiltrados.sort((a, b) => b.menorPreco - a.menorPreco);
        break;
      case 'data':
        eventosFiltrados.sort((a, b) => new Date(a.data) - new Date(b.data));
        break;
      case 'nome':
        eventosFiltrados.sort((a, b) => a.nome.localeCompare(b.nome));
        break;
      case 'relevantes':
      default:
        eventosFiltrados.sort((a, b) => (b.emDestaque ? 1 : 0) - (a.emDestaque ? 1 : 0));
        break;
    }
  }

  // ── Renderização da Grade de Eventos ──
  function renderizarGradeEventos() {
    resultsCountEl.textContent = `${eventosFiltrados.length} evento${eventosFiltrados.length === 1 ? '' : 's'} encontrado${eventosFiltrados.length === 1 ? '' : 's'}`;

    if (eventosFiltrados.length === 0) {
      gridContainer.innerHTML = `
        <div class="catalog-state-box">
          <span class="catalog-state-icon"><i data-lucide="search"></i></span>
          <h3 class="catalog-state-title">Nenhum evento encontrado</h3>
          <p class="catalog-state-desc">
            Não encontramos eventos com os critérios selecionados. Tente ajustar os termos de pesquisa, mudar a localidade ou limpar alguns filtros.
          </p>
          <button type="button" class="catalog-state-action" id="btnEmptyReset">
            Limpar todos os filtros
          </button>
        </div>
      `;
      if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: gridContainer });
      }
      document.getElementById('btnEmptyReset')?.addEventListener('click', () => {
        resetarFiltros();
        aplicarFiltros();
      });
      return;
    }

    gridContainer.innerHTML = eventosFiltrados.map(ev => {
      const precoFmt = ev.menorPreco > 0
        ? `R$ ${ev.menorPreco.toFixed(2).replace('.', ',')}`
        : 'Gratuito';

      return `
        <article class="catalog-card" data-id="${ev.id}">
          <div class="catalog-card-media">
            <img src="${escapeHTML(ev.img)}" alt="Banner de ${escapeHTML(ev.nome)}" class="catalog-card-img" loading="lazy">
            <div class="catalog-card-badges">
              <span class="catalog-badge-status">${escapeHTML(ev.statusIngressos || ev.tipo)}</span>
              <span class="catalog-badge-rating">${ev.faixaEtaria > 0 ? `+${ev.faixaEtaria}` : 'Livre'}</span>
            </div>
          </div>
          <div class="catalog-card-body">
            <div class="catalog-card-meta-top">
              <span>${escapeHTML(ev.estiloMusical)}</span>
              <span>&bull;</span>
              <span>${escapeHTML(ev.categoria || ev.tipo)}</span>
            </div>
            <h3 class="catalog-card-title">${escapeHTML(ev.nome)}</h3>
            <div class="catalog-card-info-row">
              <div class="catalog-info-item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>${escapeHTML(ev.dataExibicao)}</span>
              </div>
              <div class="catalog-info-item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <span>${escapeHTML(ev.local)} &bull; ${escapeHTML(ev.cidade)}/${escapeHTML(ev.uf)}</span>
              </div>
            </div>
            <div class="catalog-card-footer">
              <div class="catalog-card-price-block">
                <span class="catalog-price-label">A partir de</span>
                <span class="catalog-price-val">${precoFmt}</span>
              </div>
              <button type="button" class="catalog-card-btn btn-open-event-detail" data-id="${ev.id}">
                Ver Detalhes
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Adiciona listener para abrir detalhes do evento
    gridContainer.querySelectorAll('.btn-open-event-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        abrirDetalhesDoEvento(id);
      });
    });
  }

  // ── Abertura do Modal de Detalhes do Evento ──
  function abrirDetalhesDoEvento(id) {
    const ev = todosEventos.find(e => e.id === id);
    if (!ev) return;

    if (typeof window.openEvento === 'function') {
      // Se openEvento aceita índice de EVENTOS, sincronizamos ou abrimos diretamente
      const idxGlobal = (window.EVENTOS || []).findIndex(e => e.id === ev.id || e.nome === ev.nome);
      if (idxGlobal >= 0) {
        window.openEvento(idxGlobal);
        return;
      }
    }

    // Modal Fallback direto pelo DOM se necessário
    const cont = document.getElementById('eventoDetailContent');
    const modal = document.getElementById('modalEvento');
    if (cont && modal) {
      cont.innerHTML = `
        <div class="ev-ribbon">${escapeHTML(ev.tipo)}</div>
        <h2 class="ev-title">${escapeHTML(ev.nome)}</h2>
        <div class="ev-meta">
          <span><i data-lucide="calendar"></i> ${escapeHTML(ev.dataExibicao)}</span>
          <span><i data-lucide="map-pin"></i> ${escapeHTML(ev.local)} - ${escapeHTML(ev.cidade)}/${escapeHTML(ev.uf)}</span>
        </div>
        <p class="ev-desc">${escapeHTML(ev.desc)}</p>
        <p class="ev-desc" style="font-size:.82rem;font-style:italic"><i data-lucide="alert-triangle"></i> ${escapeHTML(ev.regras)}</p>
        <div class="ev-lotes-title">Ingressos Disponíveis</div>
        <div class="ev-lotes">
          ${ev.lotes.map((l, i) => `
            <div class="ev-lote">
              <div>
                <div class="ev-lote-nome">${escapeHTML(l.nome)}</div>
                <div class="ev-lote-disp">${l.disponivel} disponíveis de ${l.total}</div>
              </div>
              <div class="ev-lote-right">
                <div class="ev-lote-preco">R$ ${l.preco.toFixed(2).replace('.', ',')}</div>
                <button class="ev-lote-btn btn-comprar-ingresso" data-id="${ev.id}" data-lote="${i}">Comprar</button>
              </div>
            </div>`).join('')}
        </div>
      `;

      if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: cont });
      }

      const banner = document.createElement('img');
      banner.className = 'ev-banner';
      banner.alt = ev.nome;
      banner.src = ev.img;
      cont.prepend(banner);

      cont.querySelectorAll('.btn-comprar-ingresso').forEach(btn => {
        btn.addEventListener('click', () => {
          if (typeof window.openCompra === 'function') {
            window.openCompra(0, parseInt(btn.dataset.lote, 10));
          } else {
            alert(`Iniciando compra para ${ev.nome} - Lote selecionado.`);
          }
        });
      });

      modal.classList.add('active');
    }
  }

  // ── Renderização dos Chips de Filtros Ativos ──
  function renderizarChipsAtivos() {
    const chips = [];

    if (filtros.q) {
      chips.push({ label: `Busca: "${filtros.q}"`, key: 'q' });
    }
    if (filtros.uf) {
      chips.push({ label: `UF: ${filtros.uf}`, key: 'uf' });
    }
    if (filtros.cidade) {
      chips.push({ label: `Cidade: ${filtros.cidade}`, key: 'cidade' });
    }
    if (filtros.periodo) {
      const labelMap = { hoje: 'Hoje', amanha: 'Amanhã', fds: 'Fim de semana', '7dias': 'Próx. 7 dias', '30dias': 'Próx. 30 dias' };
      chips.push({ label: labelMap[filtros.periodo] || filtros.periodo, key: 'periodo' });
    }
    if (filtros.dataEspecifica) {
      chips.push({ label: `Data: ${filtros.dataEspecifica}`, key: 'dataEspecifica' });
    }
    filtros.estilos.forEach(est => chips.push({ label: `Estilo: ${est}`, key: 'estilo', val: est }));
    filtros.tipos.forEach(tip => chips.push({ label: `Tipo: ${tip}`, key: 'tipo', val: tip }));
    filtros.faixasEtarias.forEach(id => chips.push({ label: `Faixa: ${id > 0 ? `+${id}` : 'Livre'}`, key: 'idade', val: id }));

    if (filtros.precoMax < 300) {
      chips.push({ label: `Até R$ ${filtros.precoMax}`, key: 'preco' });
    }
    if (filtros.openBar) chips.push({ label: 'Open Bar', key: 'openBar' });
    if (filtros.openFood) chips.push({ label: 'Open Food', key: 'openFood' });
    if (filtros.areaVip) chips.push({ label: 'Área VIP', key: 'areaVip' });
    if (filtros.camarote) chips.push({ label: 'Camarote', key: 'camarote' });

    // Atualiza o contador de filtros ativos
    const totalFiltros = chips.length;
    if (activeFiltersBadge) {
      activeFiltersBadge.textContent = String(totalFiltros);
      activeFiltersBadge.style.display = totalFiltros > 0 ? 'inline-block' : 'none';
    }

    if (chips.length === 0) {
      activeChipsContainer.innerHTML = '';
      return;
    }

    activeChipsContainer.innerHTML = chips.map(c => `
      <span class="filter-chip">
        <span>${escapeHTML(c.label)}</span>
        <button type="button" class="filter-chip-remove" data-key="${c.key}" data-val="${escapeHTML(c.val || '')}" title="Remover filtro">&times;</button>
      </span>
    `).join('') + `
      <button type="button" class="btn-clear-all-chips" id="btnClearAllChips">Limpar filtros</button>
    `;

    // Listeners para remover chip
    activeChipsContainer.querySelectorAll('.filter-chip-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        removerFiltro(btn.dataset.key, btn.dataset.val);
      });
    });

    document.getElementById('btnClearAllChips')?.addEventListener('click', () => {
      resetarFiltros();
      aplicarFiltros();
    });
  }

  // ── Remoção de Filtro Individual ──
  function removerFiltro(key, val) {
    if (key === 'q') {
      filtros.q = '';
      searchInput.value = '';
      searchClearBtn.style.display = 'none';
    } else if (key === 'uf') {
      filtros.uf = '';
      stateSelect.value = '';
      popularCidades();
    } else if (key === 'cidade') {
      filtros.cidade = '';
      citySelect.value = '';
    } else if (key === 'periodo') {
      filtros.periodo = '';
      dateSelect.value = '';
    } else if (key === 'dataEspecifica') {
      filtros.dataEspecifica = '';
      const input = document.getElementById('filterDataEspecifica');
      if (input) input.value = '';
    } else if (key === 'estilo') {
      filtros.estilos = filtros.estilos.filter(e => e !== val);
      const chk = document.querySelector(`input[name="filterEstilo"][value="${val}"]`);
      if (chk) chk.checked = false;
    } else if (key === 'tipo') {
      filtros.tipos = filtros.tipos.filter(t => t !== val);
      const chk = document.querySelector(`input[name="filterTipo"][value="${val}"]`);
      if (chk) chk.checked = false;
    } else if (key === 'idade') {
      filtros.faixasEtarias = filtros.faixasEtarias.filter(i => i !== Number(val));
      const chk = document.querySelector(`input[name="filterIdade"][value="${val}"]`);
      if (chk) chk.checked = false;
    } else if (key === 'preco') {
      filtros.precoMax = 300;
      if (priceSlider) priceSlider.value = 300;
      if (priceDisplay) priceDisplay.textContent = 'Até R$ 300+ (Todos os preços)';
    } else if (key === 'openBar') {
      filtros.openBar = false;
      const chk = document.getElementById('filterOpenBar');
      if (chk) chk.checked = false;
    } else if (key === 'openFood') {
      filtros.openFood = false;
      const chk = document.getElementById('filterOpenFood');
      if (chk) chk.checked = false;
    } else if (key === 'areaVip') {
      filtros.areaVip = false;
      const chk = document.getElementById('filterAreaVip');
      if (chk) chk.checked = false;
    } else if (key === 'camarote') {
      filtros.camarote = false;
      const chk = document.getElementById('filterCamarote');
      if (chk) chk.checked = false;
    }

    aplicarFiltros();
  }

  // ── Reset Completo dos Filtros ──
  function resetarFiltros() {
    filtros.q = '';
    filtros.uf = '';
    filtros.cidade = '';
    filtros.periodo = '';
    filtros.dataEspecifica = '';
    filtros.estilos = [];
    filtros.tipos = [];
    filtros.faixasEtarias = [];
    filtros.precoMax = 300;
    filtros.openBar = false;
    filtros.openFood = false;
    filtros.areaVip = false;
    filtros.camarote = false;
    filtros.ingressosDisponiveis = false;

    searchInput.value = '';
    searchClearBtn.style.display = 'none';
    stateSelect.value = '';
    citySelect.value = '';
    dateSelect.value = '';
    popularCidades();

    if (priceSlider) priceSlider.value = 300;
    if (priceDisplay) priceDisplay.textContent = 'Até R$ 300+ (Todos os preços)';

    document.querySelectorAll('.filters-drawer input[type="checkbox"]').forEach(c => { c.checked = false; });
    const dataEspInput = document.getElementById('filterDataEspecifica');
    if (dataEspInput) dataEspInput.value = '';
  }

  // ── Sincronização com Parâmetros de URL ──
  function sincronizarURL() {
    const params = new URLSearchParams();
    if (filtros.q) params.set('q', filtros.q);
    if (filtros.uf) params.set('uf', filtros.uf);
    if (filtros.cidade) params.set('cidade', filtros.cidade);
    if (filtros.periodo) params.set('periodo', filtros.periodo);
    if (filtros.estilos.length > 0) params.set('estilos', filtros.estilos.join(','));
    if (filtros.ordenacao !== 'relevantes') params.set('sort', filtros.ordenacao);

    const queryStr = params.toString();
    const novaURL = window.location.pathname + (queryStr ? '?' + queryStr : '');
    window.history.replaceState(null, '', novaURL);
  }

  function lerParametrosURL() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('q')) {
      filtros.q = params.get('q');
      searchInput.value = filtros.q;
      searchClearBtn.style.display = 'block';
    }
    if (params.has('uf')) {
      filtros.uf = params.get('uf');
      stateSelect.value = filtros.uf;
      popularCidades(params.get('cidade') || '');
    }
    if (params.has('cidade')) {
      filtros.cidade = params.get('cidade');
      citySelect.value = filtros.cidade;
    }
    if (params.has('periodo')) {
      filtros.periodo = params.get('periodo');
      dateSelect.value = filtros.periodo;
    }
    if (params.has('estilos')) {
      filtros.estilos = params.get('estilos').split(',').map(s => s.trim());
      filtros.estilos.forEach(est => {
        const chk = document.querySelector(`input[name="filterEstilo"][value="${est}"]`);
        if (chk) chk.checked = true;
      });
    }
    if (params.has('sort') && sortSelect) {
      filtros.ordenacao = params.get('sort');
      sortSelect.value = filtros.ordenacao;
    }
  }

  function escapeHTML(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
