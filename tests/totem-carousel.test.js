const fs = require('fs');

console.log('=== TESTE DE VALIDAÇÃO DO CARROSSEL CINEMATOGRÁFICO DE EVENTOS ===\n');

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

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/events-totem.css', 'utf8');
const js = fs.readFileSync('js/events-totem.js', 'utf8');

// 1. Descarte do formato de totem / ampulheta
assert('Sem formato de totem vertical', !html.includes('class="totem-sculpture"'));
assert('Sem IDs de totem clip anterior', !html.includes('id="totemSculpturalClip"'));

// 2. Novo formato: Telas de Cinema Panorâmicas
assert('Clip-path SVG com id="cinemaScreenClip" presente', html.includes('id="cinemaScreenClip"'));
assert('Clip-path usa objectBoundingBox', html.includes('clipPathUnits="objectBoundingBox"'));
assert('CSS aplica clip-path url(#cinemaScreenClip)', css.includes('clip-path: url(#cinemaScreenClip)'));
assert('Card de cinema com proporções panorâmicas (16:9)', css.includes('width: 740px') && css.includes('height: 416px'));
assert('Borda elegante de tela de cinema SVG presente', (html.match(/class="cinema-contour-svg"/g) || []).length === 3);

// 3. Hierarquia das Telas
assert('Tela central (pos-center) presente', html.includes('class="cinema-card pos-center"'));
assert('Tela lateral direita (pos-right) presente', html.includes('class="cinema-card pos-right"'));
assert('Tela lateral esquerda (pos-left) presente', html.includes('class="cinema-card pos-left"'));
assert('Exatamente 3 artigos de tela de cinema presentes', (html.match(/class="cinema-card/g) || []).length === 3);
assert('Telas laterais recebem blur e menor luminosidade', css.includes('filter: blur(7px) brightness(0.46)'));

// 4. Navegação: Exclusivamente pelas Setas (Cards laterais NÃO clicáveis)
assert('Cards laterais usam pointer-events: none !important', css.includes('.cinema-card.pos-left') && css.includes('pointer-events: none !important'));
assert('Cards laterais direitos usam pointer-events: none !important', css.includes('.cinema-card.pos-right') && css.includes('pointer-events: none !important'));
assert('Botão seta anterior presente com class cinema-nav-prev', html.includes('cinema-nav-prev'));
assert('Botão seta próximo presente com class cinema-nav-next', html.includes('cinema-nav-next'));
assert('JS gerencia navegação pelas setas', js.includes('btnPrev.addEventListener') && js.includes('btnNext.addEventListener'));
assert('JS NÃO possui listener de clique nos cards para navegação', !js.includes('card.addEventListener(\'click\''));

// 5. Indicadores discretos de navegação
assert('Indicadores (dots) presentes no HTML', html.includes('class="cinema-dots"'));
assert('Dot ativo estilizado com o acento verde vivo', css.includes('.cinema-dot.is-active') && css.includes('#20d96b'));

// 6. Botões Padronizados com o Home
assert('Botão "Saber mais" utiliza classes e estilos idênticos ao Home', html.includes('cinema-btn-primary') && html.includes('hero-btn-primary'));
assert('Botão "Ver todos os eventos" utiliza classes e estilos idênticos ao Home', html.includes('cinema-btn-secondary') && html.includes('hero-btn-secondary'));
assert('Container dos botões utiliza hero-actions', html.includes('cinema-actions hero-actions'));
assert('Botões possuem altura de 50px e border-radius: 999px', css.includes('height: 50px;') && css.includes('border-radius: 999px;'));
assert('Efeito de gota decorativo removido dos botões', !css.includes('cinemaDropletWave'));
assert('Interação de salto (-7px) e desfoque suave no botão irmão presente', css.includes('transform: translateY(-7px) scale(1.04);'));

// 7. Funcionalidade dos botões
assert('Botão "Saber mais" presente com id="totemBtnInfo"', html.includes('id="totemBtnInfo"') && html.includes('Saber mais'));
assert('Botão "Ver todos os eventos" presente com id="totemBtnAll"', html.includes('id="totemBtnAll"') && html.includes('Ver todos os eventos'));
assert('Botão "Ver todos os eventos" aponta para eventos.html', html.includes('href="eventos.html"'));

// 8. Responsividade
assert('Breakpoints para laptop, tablet e mobile presentes', css.includes('@media (max-width: 1200px)') && css.includes('@media (max-width: 900px)') && css.includes('@media (max-width: 640px)'));

console.log(`\n──────────────────────────────────────────────────`);
console.log(`RESULTADO: ${pass} ok, ${fail} falha(s)`);

if (fail > 0) process.exit(1);
