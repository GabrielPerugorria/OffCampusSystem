/* Testes da intro (sem dependências): node tests/intro-splash.test.js
 *
 * Roda o <script> inline do index.html e js/intro-splash.js REAIS num DOM falso com relógio virtual.
 * Cobre também a regressão do GitHub Pages: JS antigo ("Digital Activation", commits 1a6d510/7a6ed76,
 * que exige .intro-progress-label) rodando contra o HTML atual -> TypeError em updateProgressUI.
 *
 * Opcional: INTRO_OLD_JS=<arquivo> e INTRO_OLD_HTML=<arquivo> para o cenário de regressão
 * (gerados com `git show 1a6d510:js/intro-splash.js` e `git show HEAD:index.html`).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/* ---------------- DOM falso mínimo ---------------- */
function makeEl(name, classes, opts) {
  opts = opts || {};
  const el = {
    name, parentNode: null, style: {}, listeners: {}, attrs: {}, children: [],
    _classes: new Set(classes || []),
    classList: {
      add: (...c) => c.forEach((x) => { if (opts.throwOnAdd === x) throw new Error('boom classList.add ' + x); el._classes.add(x); }),
      remove: (...c) => c.forEach((x) => el._classes.delete(x)),
      contains: (c) => el._classes.has(c),
      toggle: (c) => (el._classes.has(c) ? el._classes.delete(c) : el._classes.add(c)),
    },
    addEventListener(t, fn) { (el.listeners[t] = el.listeners[t] || []).push(fn); },
    removeEventListener(t, fn) { el.listeners[t] = (el.listeners[t] || []).filter((f) => f !== fn); },
    setAttribute(k, v) { el.attrs[k] = v; }, getAttribute: (k) => el.attrs[k] || null,
    removeChild(c) { el.children = el.children.filter((x) => x !== c); c.parentNode = null; },
    closest(sel) { return sel.startsWith('.') && el._classes.has(sel.slice(1)) ? el : null; },
    getBoundingClientRect: () => ({ left: 300, top: 200, width: 300, height: 300 }),
    clientWidth: 1000, clientHeight: 700, textContent: '', width: 0, height: 0,
    preventDefault() {},
  };
  return el;
}

function makeCtx(opts) {
  const noop = () => {};
  const ctx = new Proxy({}, {
    get: (t, k) => {
      if (k === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (k === 'createLinearGradient') return () => ({ addColorStop: noop });
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'arc' && opts.drawThrows) return () => { throw new Error('boom ctx.arc'); };
      return k in t ? t[k] : noop;
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return ctx;
}

/* Cria uma "página" a partir de um HTML real e executa scripts nela */
function makePage(htmlText, opts) {
  opts = opts || {};
  const html = makeEl('html', []);
  const body = makeEl('body', []);
  const splashMatch = htmlText.match(/<div id="introSplash"[\s\S]*?<button[^>]*class="intro-skip"[^>]*>[\s\S]*?<\/button>\s*<\/div>/);
  if (!splashMatch) throw new Error('bloco #introSplash não encontrado no HTML');
  const block = splashMatch[0];
  const has = (c) => new RegExp('class="[^"]*\\b' + c + '\\b').test(block);

  const splash = makeEl('splash', [], { throwOnAdd: opts.throwOnAdd });
  const canvas = makeEl('canvas', []);
  canvas.getContext = () => (opts.noCtx ? null : makeCtx(opts));
  body.children.push(splash); splash.parentNode = body;
  const inner = {};
  ['intro-mark', 'intro-orb', 'intro-progress-fill', 'intro-progress-label', 'intro-skip'].forEach((c) => {
    if (has(c) && !(opts.omit || []).includes(c)) inner[c] = makeEl(c, [c]);
  });
  splash.querySelector = (sel) => inner[sel.replace(/^\./, '')] || null;
  splash.querySelectorAll = () => [];

  // relógio virtual
  let now = 0, seq = 1;
  const timers = new Map(), rafs = new Map();
  const uncaught = [];
  const guard = (fn, a) => { try { fn(a); } catch (e) { uncaught.push(e); } };

  const docListeners = {};
  const document = {
    documentElement: html, body, readyState: 'complete', hidden: false,
    getElementById: (id) => (id === 'introSplash' ? (splash.parentNode ? splash : null) : id === 'introCanvas' ? canvas : null),
    querySelector: () => null, querySelectorAll: () => [], createElement: () => makeEl('x', []),
    addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    removeEventListener(t, fn) { docListeners[t] = (docListeners[t] || []).filter((f) => f !== fn); },
    dispatch(t, ev) { (docListeners[t] || []).slice().forEach((f) => guard(f, ev)); },
  };
  const sandbox = {
    document, console: { log() {}, warn() {}, error: (...a) => { sandbox.__consoleErrors.push(a); } },
    __consoleErrors: [], location: { search: opts.search || '' }, navigator: { userAgent: 'node', hardwareConcurrency: 4 },
    performance: { now: () => now }, Math, Date, Array, Object, JSON, Set, Map, Float32Array, Number, String, RegExp, Error,
    innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    setTimeout: (fn, ms) => { const id = seq++; timers.set(id, { at: now + (ms || 0), fn }); return id; },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: (fn) => { const id = seq++; rafs.set(id, fn); return id; },
    cancelAnimationFrame: (id) => rafs.delete(id),
    addEventListener() {}, removeEventListener() {},
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  const ctxVm = vm.createContext(sandbox);

  const page = {
    html, splash, uncaught, sandbox, inner,
    run(code, name) { guard(() => vm.runInContext(code, ctxVm, { filename: name }), undefined); },
    /* avança o relógio em passos de 16 ms (rAF) respeitando timers */
    advance(ms) {
      const end = now + ms;
      while (now < end) {
        now = Math.min(end, now + 16);
        for (const [id, t] of [...timers]) if (t.at <= now && timers.has(id)) { timers.delete(id); guard(t.fn); }
        const batch = [...rafs]; rafs.clear();
        batch.forEach(([, fn]) => guard(fn, now));
      }
    },
    clickSkip() {
      const btn = inner['intro-skip'];
      const ev = { target: btn, preventDefault() {} };
      if (btn) (btn.listeners.click || []).slice().forEach((f) => guard(f, ev));
      document.dispatch('click', ev);
    },
    pressEsc() { document.dispatch('keydown', { key: 'Escape', target: body }); },
    released() { return !html._classes.has('intro-on') && !html._classes.has('intro-lock') && !splash.parentNode; },
    locked() { return html._classes.has('intro-on') || html._classes.has('intro-lock'); },
  };
  // <script> inline do <head> (o primeiro) + o script externo
  const inline = htmlText.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/);
  if (inline) page.run(inline[1], 'index.html#inline-head');
  return page;
}

/* ---------------- mini runner ---------------- */
let pass = 0, fail = 0; const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; failures.push(name); console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function suite(t) { console.log('\n=== ' + t + ' ==='); }

const HTML = read(path.join(ROOT, 'index.html'));
const JS = read(path.join(ROOT, 'js/intro-splash.js'));
const boot = (opts, js) => { const p = makePage(HTML, opts); p.run(js || JS, 'js/intro-splash.js'); return p; };

/* 0) estrutura publicada */
suite('0. Arquivos/URLs referenciados pelo index.html existem (case-sensitive)');
{
  const refs = [...HTML.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1].replace(/\?.*$/, ''))
    .filter((u) => !/^(https?:|\/\/|mailto:|tel:|data:|javascript:)/.test(u));
  const listing = (d) => fs.readdirSync(path.join(ROOT, d));
  const missing = refs.filter((r) => {
    const dir = path.dirname(r), base = path.basename(r);
    return !(dir === '.' ? fs.readdirSync(ROOT) : listing(dir)).includes(base);
  });
  check('todos os ' + refs.length + ' caminhos locais existem com a caixa exata', missing.length === 0, 'faltando: ' + missing.join(', '));
  check('JS da intro referenciado é js/intro-splash.js?v=…', /<script src="js\/intro-splash\.js\?v=\d+"><\/script>/.test(HTML));
  check('CSS da intro referenciado é css/intro-splash.css?v=…', /href="css\/intro-splash\.css\?v=\d+"/.test(HTML));
  check('não restam cópias órfãs (raiz / mnt)', !fs.existsSync(path.join(ROOT, 'intro-splash.js')) && !fs.existsSync(path.join(ROOT, 'intro-splash.css')) && !fs.existsSync(path.join(ROOT, 'mnt')));
}

suite('1. Fluxo normal');
{
  const p = boot();
  check('intro ativa ao iniciar (intro-on presente)', p.locked());
  p.advance(1000);
  check('em 1,0 s ainda está animando (não liberou cedo)', p.locked() && !!p.splash.parentNode);
  check('barra de progresso avançou', /scaleX\(0\.5/.test(p.inner['intro-progress-fill'].style.transform || ''), p.inner['intro-progress-fill'].style.transform);
  p.advance(1600);
  check('em 2,6 s a intro terminou e o site foi liberado', p.released());
  check('nenhuma exceção não tratada', p.uncaught.length === 0, String(p.uncaught[0]));
}

suite('2. Botão "Pular" e Esc');
{
  const p = boot(); p.advance(500); p.clickSkip(); p.advance(400);
  check('Pular libera o site em < 0,4 s', p.released() && p.uncaught.length === 0, String(p.uncaught[0]));
  const q = boot(); q.advance(500); q.pressEsc(); q.advance(400);
  check('Esc libera o site', q.released());
}

suite('3. Elementos opcionais ausentes (orb, barra, mark, label)');
{
  const p = boot({ omit: ['intro-orb', 'intro-progress-fill', 'intro-mark', 'intro-progress-label'] }); p.advance(2800);
  check('sem elementos opcionais: sem exceção e site liberado', p.uncaught.length === 0 && p.released(), String(p.uncaught[0]));
  const q = boot({ omit: ['intro-skip'] }); q.advance(2800);
  check('sem botão Pular: ainda termina sozinho', q.uncaught.length === 0 && q.released());
}

suite('4. Falha da animação não bloqueia o site');
{
  const p = boot({ drawThrows: true }); p.advance(200);
  check('exceção em draw(): site liberado no mesmo instante (sem esperar fail-safe)', p.released(), 'locked=' + p.locked());
  check('exceção em draw(): nada vaza como "Uncaught"', p.uncaught.length === 0, String(p.uncaught[0]));
  check('exceção em draw(): erro foi registrado no console', p.sandbox.__consoleErrors.length >= 1);
  const q = boot({ noCtx: true });
  check('getContext("2d") nulo: site liberado de imediato', q.released() && q.uncaught.length === 0);
  const r = boot({ throwOnAdd: 'is-leaving' }); r.advance(300); r.clickSkip(); r.advance(500);
  check('falha ao iniciar o fade: Pular continua liberando o site', r.released());
}

suite('5. ?intro=off');
{
  const p = boot({ search: '?intro=off' }); p.advance(100);
  check('intro desativada: nunca trava e remove o overlay', p.released());
}

/* 6) REGRESSÃO: o erro do GitHub Pages */
suite('6. Regressão GitHub Pages: JS antigo (1a6d510) + HTML atual');
const OLD_JS = process.env.INTRO_OLD_JS && fs.existsSync(process.env.INTRO_OLD_JS) ? read(process.env.INTRO_OLD_JS) : null;
const OLD_HTML = process.env.INTRO_OLD_HTML && fs.existsSync(process.env.INTRO_OLD_HTML) ? read(process.env.INTRO_OLD_HTML) : null;
if (!OLD_JS) {
  console.log('  (pulado: defina INTRO_OLD_JS=<js antigo>; INTRO_OLD_HTML=<index.html do HEAD antes da correção>)');
} else {
  const withOld = (htmlText) => { const p = makePage(htmlText, {}); p.run(OLD_JS, 'js/intro-splash.js(OLD)'); return p; };
  // (a) reproduz o sintoma original: HTML do HEAD (sem fallback) + JS antigo
  const a = withOld(OLD_HTML || HTML.replace(/<script>[\s\S]*?<\/script>/, "<script>(function(){document.documentElement.classList.add('intro-on');})();</script>"));
  a.advance(1500);
  const err = a.uncaught.find((e) => /Cannot set properties of null \(setting 'textContent'\)/.test(String(e)));
  check('[ANTES] reproduz: TypeError "Cannot set properties of null (setting \'textContent\')"', !!err, a.uncaught.map(String).join(' | ') || 'nenhuma exceção');
  check('[ANTES] reproduz: a pilha cita updateProgressUI/loop', !!err && /updateProgressUI/.test(err.stack) && /loop/.test(err.stack));
  a.clickSkip(); a.advance(20000);
  check('[ANTES] reproduz: mesmo após Pular + 20 s o site continua travado', a.locked());
  // (b) com a correção do index.html, mesmo com o JS antigo/quebrado
  const b = withOld(HTML);
  b.advance(1500);
  check('[DEPOIS] JS antigo ainda lança o erro (prova que o cenário é o mesmo)', b.uncaught.some((e) => /textContent/.test(String(e))));
  b.clickSkip(); b.advance(800);
  check('[DEPOIS] Pular libera o site mesmo com o JS antigo quebrado', b.released());
  const c = withOld(HTML); c.advance(6200);
  check('[DEPOIS] sem clicar em nada, o site é liberado em ~6 s', c.released());
}

console.log('\n' + '─'.repeat(50) + '\nRESULTADO: ' + pass + ' ok, ' + fail + ' falha(s)');
if (fail) { console.log('Falhas:\n  - ' + failures.join('\n  - ')); process.exit(1); }
