const fs = require('fs');

console.log('=== TESTE DE VALIDAÇÃO DA PÁGINA EXCLUSIVA DE CATÁLOGO (EVENTOS.HTML) ===\n');

let pass = 0;
let fail = 0;

function assert(desc, condition) {
  if (condition) {
    console.log('  ✓ ' + desc);
    pass++;
  } else {
    console.error('  ✗ FALHA: ' + desc);
    fail++;
  }
}

const indexHtml = fs.readFileSync('index.html', 'utf8');
const eventosHtml = fs.readFileSync('eventos.html', 'utf8');
const catalogCss = fs.readFileSync('css/catalog-events.css', 'utf8');
const catalogJs = fs.readFileSync('js/catalog-events.js', 'utf8');

// 1. Separação entre Home e Catálogo
assert('Seção all-events-section removida do index.html', !indexHtml.includes('class="all-events-section"'));
assert('ID todos-eventos removido do index.html', !indexHtml.includes('id="todos-eventos"'));
assert('Menu "Eventos" no index.html aponta para eventos.html', indexHtml.includes('href="eventos.html"'));
assert('Botão "Ver todos os eventos" no index.html aponta para eventos.html', indexHtml.includes('id="totemBtnAll"') && indexHtml.includes('href="eventos.html"'));
assert('eventos.html existe como página independente', fs.existsSync('eventos.html'));

// 2. Identidade Visual e Header em eventos.html
assert('Header presente em eventos.html', eventosHtml.includes('<header id="mainHeader">'));
assert('Logo EvotechEvents presente em eventos.html', eventosHtml.includes('EvotechEvents'));
assert('Link de retorno (Voltar para o Início) presente', eventosHtml.includes('Voltar para o Início') && eventosHtml.includes('index.html#hero'));
assert('Item "Eventos" ativo no menu de eventos.html', eventosHtml.includes('href="eventos.html" class="active"'));

// 3. Barra de Pesquisa Principal (Cápsula Translúcida / Glassmorphism)
assert('Cápsula de pesquisa presente (.catalog-search-capsule)', eventosHtml.includes('catalog-search-capsule'));
assert('CSS da cápsula possui glassmorphism (backdrop-filter: blur)', catalogCss.includes('backdrop-filter: blur'));
assert('CSS da cápsula possui cantos arredondados (border-radius: 999px)', catalogCss.includes('border-radius: 999px'));
assert('Campo de busca textual presente com id="catalogSearchInput"', eventosHtml.includes('id="catalogSearchInput"'));
assert('Select de Estado presente com id="catalogStateSelect"', eventosHtml.includes('id="catalogStateSelect"'));
assert('Select de Cidade presente com id="catalogCitySelect"', eventosHtml.includes('id="catalogCitySelect"'));
assert('Select de Período rápido presente com id="catalogDateSelect"', eventosHtml.includes('id="catalogDateSelect"'));
assert('Botão "Mais filtros" presente com id="btnOpenFiltersModal"', eventosHtml.includes('id="btnOpenFiltersModal"'));
assert('Botão "Buscar" presente com id="btnSearchSubmit"', eventosHtml.includes('id="btnSearchSubmit"'));

// 4. Sistema Completo de Filtros e Categorias no Drawer
assert('Gaveta modal de filtros presente (#filtersDrawerOverlay)', eventosHtml.includes('id="filtersDrawerOverlay"'));
assert('Filtros de Estilo Musical com múltipla seleção presentes', eventosHtml.includes('name="filterEstilo"') && eventosHtml.includes('Eletrônica') && eventosHtml.includes('Funk'));
assert('Filtros de Tipo de Evento presentes (Festa universitária, Balada, Festival, Show)', eventosHtml.includes('name="filterTipo"') && eventosHtml.includes('Festa universitária'));
assert('Filtros de Faixa Etária presentes (Livre, 16, 18)', eventosHtml.includes('name="filterIdade"') && eventosHtml.includes('value="18"'));
assert('Campo de data específica presente (#filterDataEspecifica)', eventosHtml.includes('id="filterDataEspecifica"'));
assert('Slider de faixa de preço presente (#filterPriceSlider)', eventosHtml.includes('id="filterPriceSlider"'));
assert('Filtros de Estrutura presentes (Open Bar, Open Food, Área VIP, Camarote)', eventosHtml.includes('id="filterOpenBar"') && eventosHtml.includes('id="filterAreaVip"'));
assert('Ações do drawer (Limpar tudo / Aplicar filtros) presentes', eventosHtml.includes('id="btnDrawerClear"') && eventosHtml.includes('id="btnDrawerApply"'));

// 5. Apresentação dos Eventos e Chips
assert('Barra de chips de filtros ativos presente (#catalogActiveChips)', eventosHtml.includes('id="catalogActiveChips"'));
assert('Contador de resultados presente (#catalogResultsCount)', eventosHtml.includes('id="catalogResultsCount"'));
assert('Select de ordenação presente (#catalogSortSelect)', eventosHtml.includes('id="catalogSortSelect"'));
assert('Grade de eventos presente (#catalogEventsGrid)', eventosHtml.includes('id="catalogEventsGrid"'));

// 6. Motor JavaScript de Filtragem (js/catalog-events.js)
assert('Mapeamento de cidades por estado presente no JS', catalogJs.includes('CIDADES_POR_UF'));
assert('Lógica de filtragem combinada implementada', catalogJs.includes('aplicarFiltros'));
assert('Ordenação de eventos implementada (data, menor/maior preço, nome)', catalogJs.includes('ordenarEventos'));
assert('Renderização de chips removíveis implementada', catalogJs.includes('renderizarChipsAtivos') && catalogJs.includes('filter-chip-remove'));
assert('Sincronização com URL search params implementada', catalogJs.includes('sincronizarURL') && catalogJs.includes('lerParametrosURL'));
assert('Abertura de detalhes e compra integrada com modais', eventosHtml.includes('id="modalEvento"') && eventosHtml.includes('id="modalCompra"'));

// 7. Responsividade
assert('CSS contém regras de responsividade para tablet e mobile', catalogCss.includes('@media (max-width: 1100px)') && catalogCss.includes('@media (max-width: 768px)'));

console.log(`\n──────────────────────────────────────────────────`);
console.log(`RESULTADO: ${pass} ok, ${fail} falha(s)`);

if (fail > 0) process.exit(1);
