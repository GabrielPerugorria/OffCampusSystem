const fs = require('fs');
const assert = require('assert');

console.log('=== TESTE DE VALIDAÇÃO DO REDESIGN VISUAL & LUCIDE ICONS ===\n');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Erro: ${err.message}`);
    failed++;
  }
}

// 1. Verificação Lucide CDN
const indexHtml = fs.readFileSync('index.html', 'utf8');
const adminHtml = fs.readFileSync('admin.html', 'utf8');
const eventosHtml = fs.readFileSync('eventos.html', 'utf8');

test('Lucide CDN presente no index.html', () => {
  assert(indexHtml.includes('unpkg.com/lucide@latest'), 'Falta script Lucide no index.html');
});

test('Lucide CDN presente no admin.html', () => {
  assert(adminHtml.includes('unpkg.com/lucide@latest'), 'Falta script Lucide no admin.html');
});

test('Lucide CDN presente no eventos.html', () => {
  assert(eventosHtml.includes('unpkg.com/lucide@latest'), 'Falta script Lucide no eventos.html');
});

// 2. Remoção de Emojis
const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F1E0}-\u{1F1FF}]|✏|🗑|📅|👥|📇|✉|📞|💰|🥇|🥈|🥉|🧠|🎟|⚠|✅|🛰|📉|🍶/u;

test('Zero emojis no admin.html', () => {
  const matches = adminHtml.split('\n').filter(l => emojiRegex.test(l));
  assert.strictEqual(matches.length, 0, `Encontrados emojis no admin.html: ${matches.join(', ')}`);
});

test('Zero emojis no eventos.html', () => {
  const matches = eventosHtml.split('\n').filter(l => emojiRegex.test(l));
  assert.strictEqual(matches.length, 0, `Encontrados emojis no eventos.html: ${matches.join(', ')}`);
});

const adminJs = fs.readFileSync('js/admin.js', 'utf8');
test('Zero emojis no js/admin.js', () => {
  const matches = adminJs.split('\n').filter(l => emojiRegex.test(l));
  assert.strictEqual(matches.length, 0, `Encontrados emojis no js/admin.js: ${matches.join(', ')}`);
});

// 3. Remoção de Badges Decorativos
test('Badges decorativos mod-badge removidos do index.html', () => {
  assert(!indexHtml.includes('class="mod-badge"'), 'Ainda existe mod-badge no index.html');
});

test('Chip decorativo evo-chip removido do index.html', () => {
  assert(!indexHtml.includes('class="evo-chip'), 'Ainda existe evo-chip no index.html');
});

test('Badges decorativos cinema-top-badge removidos do index.html', () => {
  assert(!indexHtml.includes('class="cinema-top-badge"'), 'Ainda existe cinema-top-badge no index.html');
});

// 4. Padronização de Títulos com Gradiente
const mainCss = fs.readFileSync('css/main.css', 'utf8');
test('Classe de gradiente oficial definida no main.css', () => {
  assert(mainCss.includes('.evo-title-gradient') || mainCss.includes('.section-heading'), 'Falta gradiente de título no main.css');
  assert(mainCss.includes('linear-gradient(135deg, #ffffff 60%, #22c55e 100%)'), 'Gradiente não utiliza o padrão branco→verde oficial');
});

// 5. Redesign da Seção Plataforma (Layout Assimétrico)
test('Seção plataforma utiliza layout de grid assimétrico (col-span)', () => {
  assert(indexHtml.includes('col-span-8'), 'Falta classe assimétrica col-span-8');
  assert(indexHtml.includes('col-span-4'), 'Falta classe assimétrica col-span-4');
  assert(indexHtml.includes('col-span-12'), 'Falta classe assimétrica col-span-12');
});

// 6. Redesign dos Modais de Auth (Login e Registro)
test('Modal de login possui estrutura auth-panel assimétrica', () => {
  assert(indexHtml.includes('class="modal auth-panel-modal" id="modalLogin"'), 'Falta modalLogin redesenhado');
  assert(indexHtml.includes('class="auth-brand"'), 'Falta painel de identidade auth-brand');
  assert(indexHtml.includes('class="auth-form-side"'), 'Falta formulário auth-form-side');
});

test('Modal de registro possui estrutura auth-panel assimétrica', () => {
  assert(indexHtml.includes('class="modal auth-panel-modal" id="modalCadastro"'), 'Falta modalCadastro redesenhado');
});

test('Preservação rigorosa de todos os IDs interativos de Auth', () => {
  const ids = [
    'loginEmail', 'loginSenha', 'btnLoginSubmit', 'linkParaCadastro', 'linkEsqueci',
    'cadNome', 'cadEmail', 'cadCpf', 'cadTel', 'cadDt', 'cadSenha', 'btnCadastroSubmit', 'linkParaLogin'
  ];
  ids.forEach(id => {
    assert(indexHtml.includes(`id="${id}"`), `ID interativo ausente: ${id}`);
  });
});

// 7. Lucide Icons no DOM
test('Elementos Lucide com data-lucide presentes no admin.html', () => {
  assert(adminHtml.includes('data-lucide="layout-dashboard"'), 'Falta ícone Lucide dashboard no admin.html');
  assert(adminHtml.includes('data-lucide="calendar-days"'), 'Falta ícone Lucide calendar no admin.html');
  assert(adminHtml.includes('data-lucide="scan-line"'), 'Falta ícone Lucide portaria no admin.html');
  assert(adminHtml.includes('data-lucide="wallet"'), 'Falta ícone Lucide financeiro no admin.html');
});

test('Elementos Lucide com data-lucide presentes no index.html', () => {
  assert(indexHtml.includes('data-lucide="layout-dashboard"'), 'Falta ícone Lucide no index.html');
  assert(indexHtml.includes('data-lucide="shield-check"'), 'Falta ícone Lucide no index.html');
});

// 8. Scrollbar e Scroll Lock
test('Scrollbars personalizadas configuradas no css/main.css e css/admin.css', () => {
  const adminCss = fs.readFileSync('css/admin.css', 'utf8');
  assert(mainCss.includes('*::-webkit-scrollbar-thumb'), 'Falta scrollbar personalizada no main.css');
  assert(adminCss.includes('*::-webkit-scrollbar-thumb'), 'Falta scrollbar personalizada no admin.css');
});

test('ModalScrollLock implementado em js/main.js e js/admin.js', () => {
  const mainJs = fs.readFileSync('js/main.js', 'utf8');
  assert(mainJs.includes('ModalScrollLock'), 'Falta ModalScrollLock no main.js');
  assert(adminJs.includes('ModalScrollLock'), 'Falta ModalScrollLock no admin.js');
});

console.log(`\n──────────────────────────────────────────────────`);
console.log(`RESULTADO: ${passed} ok, ${failed} falha(s)`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log(`TODAS AS VALIDAÇÕES DO REDESIGN PASSARAM COM 100% DE SUCESSO!\n`);
}
