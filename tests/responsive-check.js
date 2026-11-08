const fs = require('fs');

console.log('=== TESTE DE RESPONSIVIDADE E INTEGRIDADE DO HEADER ===\n');

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
const heroCss = fs.readFileSync('css/home-hero.css', 'utf8');
const mainJs = fs.readFileSync('js/main.js', 'utf8');

// 1. Barra de progresso removida
assert('Barra de progresso removida do index.html', !html.includes('class="scroll-progress"'));
assert('Barra de progresso id="progressBar" removida do index.html', !html.includes('id="progressBar"'));
assert('js/main.js possui verificação nula segura para progressBar', mainJs.includes('if (total > 0 && progressBar)'));

// 2. Logo do cabeçalho removido e texto EvotechEvents adicionado
const headerHtml = html.match(/<header id="mainHeader">[\s\S]*?<\/header>/)?.[0] || '';
assert('Cabeçalho mainHeader existe', !!headerHtml);
assert('Logo imagem removido de dentro do cabeçalho', !headerHtml.includes('Logo EvoTech') && !headerHtml.includes('logo-icon'));
assert('Texto EvotechEvents presente no cabeçalho em branco', headerHtml.includes('EvotechEvents') && heroCss.includes('.nav-brand'));

// 3. Elementos do cabeçalho mantidos
assert('Menu de navegação principal mantido no cabeçalho', headerHtml.includes('class="menu"'));
assert('Ações do nav (Entrar/Cadastrar) mantidas', headerHtml.includes('id="btnEntrar"') && headerHtml.includes('id="btnCadastro"'));
assert('Botão hambúrguer para mobile mantido', headerHtml.includes('id="hamburger"'));
assert('Mobile menu mantido', headerHtml.includes('id="mobileMenu"'));

// 4. Elementos da Hero mantidos
assert('Hero section presente com id="hero"', html.includes('<section class="hero" id="hero"'));
assert('Canvas de partículas presente', html.includes('id="particlesCanvas"'));
assert('Container do globo 3D presente', html.includes('id="globeContainer"'));
assert('Canvas do globo 3D presente', html.includes('id="globeCanvas"'));
assert('CTA principal (Comprar ingressos) presente com id="heroBtnIngressos"', html.includes('id="heroBtnIngressos"'));
assert('CTA secundário (Administre seu evento) presente com id="heroBtnConhecer"', html.includes('id="heroBtnConhecer"'));

// 5. Regras de responsividade no css/home-hero.css
assert('Reset antitransbordo (overflow-x: hidden) presente', heroCss.includes('overflow-x: hidden !important'));
assert('Layout do header adaptado para desktop (>1100px)', heroCss.includes('@media (min-width: 1101px)'));
assert('Layout do header adaptado para mobile (<=1100px)', heroCss.includes('@media (max-width: 1100px)'));
assert('Breakpoint laptop (1280px) configurado na Hero', heroCss.includes('@media (max-width: 1280px)'));
assert('Breakpoint tablet (1024px) configurado na Hero', heroCss.includes('@media (max-width: 1024px)'));
assert('Breakpoint mobile (640px) configurado na Hero', heroCss.includes('@media (max-width: 640px)'));
assert('Breakpoint mobile pequeno (360px) configurado na Hero', heroCss.includes('@media (max-width: 360px)'));

// 6. Efeitos dos botões mantidos
assert('Animação de gota líquida presente', heroCss.includes('@keyframes dropletWave'));
assert('Efeito de salto e desfoque mantido', heroCss.includes('#hero .hero-actions:hover .hero-btn-primary') && heroCss.includes('filter: blur(3px)'));

console.log('\n──────────────────────────────────────────────────');
console.log(`RESULTADO: ${pass} ok, ${fail} falha(s)`);

if (fail > 0) process.exit(1);
