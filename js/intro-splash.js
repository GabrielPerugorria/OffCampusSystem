/* ============================================================
   INTRO — EvoTech Events · "Eventos em movimento"  (≈ 2,5 s no total, contando o parse da página)
   ------------------------------------------------------------
   Esfera 3D de pontos e linhas verdes desenhada em <canvas> 2D
   (projeção em perspectiva própria; sem Three.js/WebGL, portanto
   sem dependência de CDN nem de GPU).

   Linha do tempo (relógio real, não contagem de frames):
     0,00–0,90 s  pontos convergem e formam a esfera
     0,15–1,90 s  rotação suave contínua · barra 0 → 100 %
     1,90–2,30 s  fade-out e liberação do site
   Pular / Escape / fim normal / fail-safe → sempre finish() (1x).
   Debug: ?intro=off desativa por completo.
   ============================================================ */
(function () {
  'use strict';

  var html = document.documentElement;
  var splash = document.getElementById('introSplash');
  var canvas = document.getElementById('introCanvas');

  // guarda contra dupla execução (script carregado duas vezes)
  if (window.__evoIntroBooted) return;
  window.__evoIntroBooted = true;

  if (!splash || !canvas || !canvas.getContext || !html.classList.contains('intro-on')) {
    cleanupDom();
    return;
  }

  var ctx = canvas.getContext('2d');
  if (!ctx) { cleanupDom(); return; }             // sem canvas 2D: não há o que animar, libera o site
  var orbEl = splash.querySelector('.intro-orb');
  var fillEl = splash.querySelector('.intro-progress-fill');
  var skipBtn = splash.querySelector('.intro-skip');

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var T_FILL = reduced ? 1.0 : 1.9;     // barra completa (s)
  var T_END = reduced ? 1.3 : 2.3;      // intro totalmente encerrada (s)
  var T_BUILD = 0.9;                    // montagem da esfera (s)
  var SPIN = 1.1;                       // rad/s (rotação suave)
  var TILT = 0.38;                      // inclinação do eixo (rad)
  var NODES = 260;
  var NEIGHBORS = 3;

  /* ---------- geometria: esfera de Fibonacci + vizinhos mais próximos ---------- */
  var pts = [];
  var golden = Math.PI * (3 - Math.sqrt(5));
  for (var i = 0; i < NODES; i++) {
    var y = 1 - (i + 0.5) * 2 / NODES;
    var r = Math.sqrt(1 - y * y);
    var th = golden * i;
    var seed = pseudo(i);
    pts.push({
      x: Math.cos(th) * r, y: y, z: Math.sin(th) * r,
      // origem dispersa (poeira) para a animação de montagem
      sx: (pseudo(i * 3 + 1) - 0.5) * 5, sy: (pseudo(i * 3 + 2) - 0.5) * 5, sz: (seed - 0.5) * 5,
      delay: pseudo(i * 7 + 5) * 0.35
    });
  }
  function pseudo(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  var edges = [];
  (function buildEdges() {
    var seen = {};
    var maxD2 = 0.36; // ~0,6 do raio: ignora ligações longas
    for (var a = 0; a < NODES; a++) {
      var ds = [];
      for (var b = 0; b < NODES; b++) {
        if (a === b) continue;
        var dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y, dz = pts[a].z - pts[b].z;
        ds.push({ b: b, d: dx * dx + dy * dy + dz * dz });
      }
      ds.sort(function (p, q) { return p.d - q.d; });
      for (var k = 0; k < NEIGHBORS; k++) {
        if (ds[k].d > maxD2) break;
        var lo = Math.min(a, ds[k].b), hi = Math.max(a, ds[k].b), key = lo * 1000 + hi;
        if (!seen[key]) { seen[key] = 1; edges.push([lo, hi]); }
      }
    }
  })();

  /* ---------- canvas / layout (sem distorção: escala uniforme + DPR) ---------- */
  var W = 0, H = 0, cx = 0, cy = 0, orbR = 0, dpr = 1;

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = splash.clientWidth || window.innerWidth;
    H = splash.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var rect = orbEl ? orbEl.getBoundingClientRect() : null;
    if (rect && rect.width > 0) {
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
      orbR = Math.min(rect.width, rect.height) / 2 * 0.92;
    } else {
      cx = W / 2; cy = H * 0.42; orbR = Math.min(W, H) * 0.22;
    }
  }

  /* ---------- render ---------- */
  var CAM = 3.4; // distância da câmera (em raios)
  function ease(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return 1 - Math.pow(1 - t, 3); }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    var ang = reduced ? 0.6 : t * SPIN;
    var ca = Math.cos(ang), sa = Math.sin(ang), ct = Math.cos(TILT), st = Math.sin(TILT);
    // escala para que a silhueta (com perspectiva) tenha raio = orbR
    var f = orbR * Math.sqrt(CAM * CAM - 1);
    var build = reduced ? 1 : null;

    var proj = new Array(NODES);
    for (var i = 0; i < NODES; i++) {
      var p = pts[i];
      var k = build === 1 ? 1 : ease((t - p.delay) / T_BUILD);
      var x = p.sx + (p.x - p.sx) * k;
      var y = p.sy + (p.y - p.sy) * k;
      var z = p.sz + (p.z - p.sz) * k;
      // rotação em Y, depois inclinação em X
      var x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
      var y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
      var s = f / (CAM - z2);
      proj[i] = { x: cx + x1 * s, y: cy - y2 * s, z: z2, k: k, s: s };
    }

    var rimA = ease((t - 0.2) / 0.7);

    // halo + silhueta (reforça a leitura de volume esférico)
    var g = ctx.createRadialGradient(cx, cy, orbR * 0.2, cx, cy, orbR * 1.25);
    g.addColorStop(0, 'rgba(34,197,94,0.07)');
    g.addColorStop(0.75, 'rgba(34,197,94,0.10)');
    g.addColorStop(1, 'rgba(34,197,94,0)');
    ctx.globalAlpha = rimA;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, orbR * 1.25, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(74,222,128,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, 6.2832); ctx.stroke();

    // linhas, agrupadas por profundidade (poucos strokes por quadro)
    var edgeA = ease((t - 0.35) / 0.6);
    var B = 5, buckets = [];
    for (var b = 0; b < B; b++) buckets.push([]);
    for (var e = 0; e < edges.length; e++) {
      var A = proj[edges[e][0]], C = proj[edges[e][1]];
      var depth = (A.z + C.z) * 0.5;              // -1 (fundo) … 1 (frente)
      var bi = Math.min(B - 1, Math.max(0, Math.floor((depth + 1) / 2 * B)));
      buckets[bi].push(A.x, A.y, C.x, C.y);
    }
    ctx.lineWidth = 1;
    for (var bk = 0; bk < B; bk++) {
      var arr = buckets[bk];
      if (!arr.length) continue;
      var near = (bk + 0.5) / B;                  // 0 fundo … 1 frente
      ctx.globalAlpha = edgeA * (0.07 + near * 0.55);
      ctx.strokeStyle = near > 0.5 ? '#4ade80' : '#22c55e';
      ctx.beginPath();
      for (var q = 0; q < arr.length; q += 4) { ctx.moveTo(arr[q], arr[q + 1]); ctx.lineTo(arr[q + 2], arr[q + 3]); }
      ctx.stroke();
    }

    // pontos (mais ao fundo primeiro) — tamanho e brilho variam com a profundidade
    var order = proj.slice().sort(function (p, q) { return p.z - q.z; });
    for (var n = 0; n < order.length; n++) {
      var o = order[n];
      var near2 = (o.z + 1) / 2;
      ctx.globalAlpha = (0.18 + near2 * 0.82) * (0.25 + 0.75 * o.k);
      ctx.fillStyle = near2 > 0.6 ? '#bbf7d0' : '#4ade80';
      var rad = Math.max(0.6, (0.9 + near2 * 1.5) * (orbR / 140));
      ctx.beginPath(); ctx.arc(o.x, o.y, Math.min(rad, 3.2), 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- ciclo de vida ---------- */
  var startTs = performance.now(), rafId = 0, done = false, leaving = false;
  var failsafe = 0, endTimer = 0, resizeRaf = 0;

  function frame(now) {
    if (done) return;
    try {
      var t = (now - startTs) / 1000;

      if (t > 0.12) splash.classList.add('is-in');
      if (fillEl) fillEl.style.transform = 'scaleX(' + Math.min(1, t / T_FILL).toFixed(4) + ')';
      draw(Math.min(t, T_END));

      if (t >= T_FILL && !leaving) beginLeave(false);
      if (t >= T_END) { finish(); return; }
    } catch (err) {
      // falha na animação nunca pode prender o usuário: registra e libera o site
      if (window.console && console.error) console.error('[intro] animação falhou; liberando o site.', err);
      finish();
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  function beginLeave(fast) {
    if (leaving) return;
    leaving = true;
    html.classList.remove('intro-on');            // libera rolagem/interação já no início do fade
    splash.style.display = 'block';               // o overlay continua visível só durante o fade
    splash.classList.add('is-leaving');
    if (fast) { splash.style.transitionDuration = '200ms'; }
    var ms = fast ? 220 : Math.max(0, (T_END - T_FILL) * 1000);
    clearTimeout(endTimer);
    endTimer = setTimeout(finish, ms + 20);
  }

  function finish() {
    if (done) return;
    done = true;
    try {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(resizeRaf);
      clearTimeout(failsafe);
      clearTimeout(endTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('keydown', onKey);
      if (skipBtn) skipBtn.removeEventListener('click', onSkip);
    } finally {
      cleanupDom();                               // sempre executa, mesmo se a limpeza acima falhar
    }
  }

  function cleanupDom() {
    html.classList.remove('intro-on');
    try {
      if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    } catch (e) {
      if (splash) splash.style.display = 'none';
    }
  }

  // "Pular"/Esc: se algo falhar ao iniciar o fade, encerra na hora em vez de travar
  function onSkip(ev) {
    try { if (ev) ev.preventDefault(); beginLeave(true); } catch (e) { finish(); }
  }
  function onKey(ev) {
    if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
    try { beginLeave(true); } catch (e) { finish(); }
  }
  function onResize() {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(layout);
  }

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  document.addEventListener('keydown', onKey);
  if (skipBtn) skipBtn.addEventListener('click', onSkip);

  layout();
  failsafe = setTimeout(finish, 3500);            // rede de segurança: nunca prende o usuário
  rafId = requestAnimationFrame(frame);
})();
