const fs = require('fs');

console.log('=== TESTE DE VALIDAÇÃO DAS CORREÇÕES MOBILE E PLATAFORMAS ===\n');

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
const mainCss = fs.readFileSync('css/main.css', 'utf8');
const heroCss = fs.readFileSync('css/home-hero.css', 'utf8');
const totemCss = fs.readFileSync('css/events-totem.css', 'utf8');
const catalogCss = fs.readFileSync('css/catalog-events.css', 'utf8');
const mainJs = fs.readFileSync('js/main.js', 'utf8');
const globeJs = fs.readFileSync('js/globe_v2.js', 'utf8');
const totemJs = fs.readFileSync('js/events-totem.js', 'utf8');

// 1. Correção do Prompt de Senha no iOS / iPhone
assert('modalLogin inicia oculto no index.html (display:none)', indexHtml.includes('id="modalLogin"') && indexHtml.includes('style="display:none"'));
assert('loginSenha com autocomplete="off" e disabled no load', indexHtml.includes('id="loginSenha"') && indexHtml.includes('autocomplete="off"') && indexHtml.includes('disabled'));
assert('cadSenha com autocomplete="off" e disabled no load', indexHtml.includes('id="cadSenha"') && indexHtml.includes('autocomplete="off"') && indexHtml.includes('disabled'));
assert('.modal-overlay usa display: none !important quando fechado no CSS', mainCss.includes('.modal-overlay') && mainCss.includes('display: none !important'));
assert('openModal habilita inputs desabilitados', mainJs.includes("querySelectorAll('input[disabled]')") && mainJs.includes('inp.disabled = false'));
assert('closeModal desabilita inputs de senha para evitar autofill indevido', mainJs.includes('inp.disabled = true'));

// 2. Planeta Terra no Mobile (Rotação autônoma e novo layout da Hero)
assert('globo desabilita drag por toque em telas mobile (<=1024px)', globeJs.includes('isMobileScreen') && globeJs.includes('if (isMobileScreen()) return;'));
assert('hero mobile aplica pointer-events: none no container e canvas do globo', heroCss.includes('#hero #globeContainer.globe-container') && heroCss.includes('pointer-events: none !important'));
assert('hero mobile posiciona o globo no topo (order: 1)', heroCss.includes('#hero .hero-globe-wrapper') && heroCss.includes('order: 1'));
assert('hero mobile posiciona títulos e subtítulo sobre o planeta com vinheta (order: 2)', heroCss.includes('#hero .hero-content') && heroCss.includes('order: 2') && heroCss.includes('radial-gradient'));
assert('hero mobile possui sombra no título e subtítulo para legibilidade', heroCss.includes('#hero .hero-headline') && heroCss.includes('text-shadow'));
assert('hero mobile posiciona os dois botões de CTA na parte inferior', heroCss.includes('#hero .hero-actions') && heroCss.includes('justify-content: center'));

// 3. Carrossel Cinematográfico (Sem swipe por dedo, sem spoilers laterais)
assert('events-totem.js NÃO possui listeners de swipe por touch', !totemJs.includes('stage.addEventListener(\'touchstart\'') && !totemJs.includes('stage.addEventListener(\'touchend\''));
assert('cards laterais pos-left e pos-right ocultos com opacity: 0 !important', totemCss.includes('.cinema-card.pos-left') && totemCss.includes('opacity: 0 !important') && totemCss.includes('visibility: hidden !important'));
assert('cinema-viewport possui overflow: hidden para evitar vazamento visual', totemCss.includes('.cinema-viewport') && totemCss.includes('overflow: hidden'));

// 4. Trava de Rolagem dos Modais ("Saber mais" e outros)
assert('html.modal-open e body.modal-open travam scroll com overflow: hidden !important e touch-action: none', mainCss.includes('html.modal-open') && mainCss.includes('body.modal-open') && mainCss.includes('touch-action: none !important'));
assert('.modal possui overscroll-behavior: contain e touch-action: pan-y', mainCss.includes('.modal') && mainCss.includes('overscroll-behavior: contain !important') && mainCss.includes('touch-action: pan-y !important'));
assert('openModal adiciona modal-open ao html e body', mainJs.includes("document.documentElement.classList.add('modal-open')") && mainJs.includes("document.body.classList.add('modal-open')"));
assert('closeModal remove modal-open de html e body', mainJs.includes("document.documentElement.classList.remove('modal-open')") && mainJs.includes("document.body.classList.remove('modal-open')"));

// 5. Desbloqueio de Rolagem em eventos.html (Ver todos os eventos)
assert('eventos.html possui modalOverlay em volta dos modais', eventosHtml.includes('<div class="modal-overlay" id="modalOverlay"'));
assert('filters-drawer-overlay usa display: none !important quando fechado', catalogCss.includes('.filters-drawer-overlay') && catalogCss.includes('display: none !important'));
assert('html e body.catalog-page possuem rolagem vertical irrestrita (overflow-y: auto)', catalogCss.includes('body.catalog-page') && catalogCss.includes('overflow-y: auto !important'));
assert('eventos.html não inclui css/home-hero.css', !eventosHtml.includes('css/home-hero.css'));
assert('eventos.html possui rodapé completo da plataforma', eventosHtml.includes('<footer class="footer"') && eventosHtml.includes('Evotech') && eventosHtml.includes('Todos os direitos reservados'));

console.log(`\n──────────────────────────────────────────────────`);
console.log(`RESULTADO: ${pass} ok, ${fail} falha(s)`);

if (fail > 0) process.exit(1);
