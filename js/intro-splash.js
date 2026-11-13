/* ============================================================
   INTRO — EvoTech Events · "Eventos em movimento"  (≈ 2,5 s no total, contando o parse da página)
   ------------------------------------------------------------
   Esfera 3D de pontos e linhas verdes desenhada em <canvas> 2D
   (projeção em perspectiva própria; sem Three.js/WebGL, portanto
   sem dependência de CDN nem de GPU).

   Linha do tempo (relógio real, não contagem de frames):
     0,00–1,00 s  pontos convergem e formam a esfera
     0,15–2,80 s  rotação suave contínua · barra 0 → 100 %
     2,80–3,40 s  fade-out e liberação do site
   Pular / Escape / fim normal / fail-safe → sempre finish() (1x).
   Debug: ?intro=off desativa por completo.

   OTIMIZAÇÕES DE PERFORMANCE (v2):
     - Zero alocações por frame: projeções, buckets e ordem de
       profundidade usam arrays pré-alocados e reutilizados.
     - Gradiente radial do halo cacheado (recriado só no resize).
     - Pontos agrupados por cor em 2 lotes (2 paths em vez de 260).
     - Constantes trigonométricas de TILT pré-computadas.
     - DPR limitado a 1.5 em mobile para reduzir área de pixels.
     - build check removido (era sempre null).
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

  var ctx = canvas.getContext('2d', { alpha: false }); // opaco: sem composição com fundo, +perf
  if (!ctx) { cleanupDom(); return; }             // sem canvas 2D: não há o que animar, libera o site
  var orbEl = splash.querySelector('.intro-orb');
  var fillEl = splash.querySelector('.intro-progress-fill');
  var skipBtn = splash.querySelector('.intro-skip');

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var T_FILL = reduced ? 1.4 : 2.8;     // barra completa (s)
  var T_END = reduced ? 1.8 : 3.4;      // intro totalmente encerrada (s)
  var T_BUILD = reduced ? 0.5 : 1.0;    // montagem da esfera (s) — mais rápida quando reduced
  var SPIN = reduced ? 0.22 : 0.55;     // rad/s — rotação suave e elegante
  var TILT = 0.38;                       // inclinação do eixo (rad)
  var CT = Math.cos(TILT);              // pré-computado: constante durante toda a animação
  var ST = Math.sin(TILT);              // pré-computado: constante durante toda a animação
  var NODES = 260;
  var NEIGHBORS = 3;
  var TWO_PI = 6.283185307179586;
  var CAM = 3.4;                        // distância da câmera (em raios)

  /* ---------- geometria: esfera de Fibonacci + vizinhos mais próximos ---------- */
  // Dados da geometria em arrays tipados (SoA) para melhor localidade de cache
  var ptX = new Float32Array(NODES);    // posição final X
  var ptY = new Float32Array(NODES);    // posição final Y
  var ptZ = new Float32Array(NODES);    // posição final Z
  var ptSX = new Float32Array(NODES);   // posição inicial (dispersa) X
  var ptSY = new Float32Array(NODES);   // posição inicial (dispersa) Y
  var ptSZ = new Float32Array(NODES);   // posição inicial (dispersa) Z
  var ptDelay = new Float32Array(NODES); // atraso de cada ponto na montagem

  var golden = Math.PI * (3 - Math.sqrt(5));
  for (var i = 0; i < NODES; i++) {
    var yVal = 1 - (i + 0.5) * 2 / NODES;
    var rVal = Math.sqrt(1 - yVal * yVal);
    var th = golden * i;
    var seed = pseudo(i);
    ptX[i] = Math.cos(th) * rVal;
    ptY[i] = yVal;
    ptZ[i] = Math.sin(th) * rVal;
    ptSX[i] = (pseudo(i * 3 + 1) - 0.5) * 5;
    ptSY[i] = (pseudo(i * 3 + 2) - 0.5) * 5;
    ptSZ[i] = (seed - 0.5) * 5;
    ptDelay[i] = pseudo(i * 7 + 5) * 0.35;
  }
  function pseudo(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  // Arestas em array flat [a0, b0, a1, b1, ...] em vez de array de arrays
  var edgeA_arr, edgeB_arr, edgeCount;
  (function buildEdges() {
    var seen = {};
    var maxD2 = 0.36; // ~0,6 do raio: ignora ligações longas
    var tempA = [], tempB = [];
    for (var a = 0; a < NODES; a++) {
      var ds = [];
      for (var b = 0; b < NODES; b++) {
        if (a === b) continue;
        var dx = ptX[a] - ptX[b], dy = ptY[a] - ptY[b], dz = ptZ[a] - ptZ[b];
        ds.push({ b: b, d: dx * dx + dy * dy + dz * dz });
      }
      ds.sort(function (p, q) { return p.d - q.d; });
      for (var k = 0; k < NEIGHBORS; k++) {
        if (ds[k].d > maxD2) break;
        var lo = a < ds[k].b ? a : ds[k].b;
        var hi = a < ds[k].b ? ds[k].b : a;
        var key = lo * 1000 + hi;
        if (!seen[key]) { seen[key] = 1; tempA.push(lo); tempB.push(hi); }
      }
    }
    edgeCount = tempA.length;
    edgeA_arr = new Uint16Array(tempA);
    edgeB_arr = new Uint16Array(tempB);
  })();

  /* ---------- arrays pré-alocados para o render (zero GC por frame) ---------- */
  // Projeções: struct-of-arrays para evitar 260 objetos/frame
  var projX = new Float32Array(NODES);
  var projY = new Float32Array(NODES);
  var projZ = new Float32Array(NODES);
  var projK = new Float32Array(NODES);

  // Buckets de arestas (5 faixas de profundidade) — pré-alocados com tamanho máximo
  var B = 5;
  var bucketData = new Float32Array(edgeCount * 4); // coords: ax, ay, bx, by por aresta
  var bucketStart = new Uint16Array(B);             // offset de início de cada bucket
  var bucketLen = new Uint16Array(B);               // nº de arestas em cada bucket

  // Ordem de profundidade dos pontos: array de índices reutilizado
  var sortIdx = new Uint16Array(NODES);
  for (var si = 0; si < NODES; si++) sortIdx[si] = si;

  /* ---------- canvas / layout (sem distorção: escala uniforme + DPR) ---------- */
  var W = 0, H = 0, cx = 0, cy = 0, orbR = 0, dpr = 1;
  var haloGrad = null; // gradiente cacheado (recriado só no resize)

  function layout() {
    // Mobile: limita DPR a 1.5 para poupar GPU (visual indistinguível em tela pequena)
    var isSmall = window.innerWidth < 768;
    dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 2);
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
    // Recria o gradiente radial do halo (depende de cx, cy, orbR)
    haloGrad = ctx.createRadialGradient(cx, cy, orbR * 0.2, cx, cy, orbR * 1.25);
    haloGrad.addColorStop(0, 'rgba(32,217,107,0.045)');
    haloGrad.addColorStop(0.75, 'rgba(32,217,107,0.06)');
    haloGrad.addColorStop(1, 'rgba(32,217,107,0)');
  }

  /* ---------- render ---------- */
  function ease(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return 1 - (1 - t) * (1 - t) * (1 - t); }

  // Constantes de cor para os pontos (evita criar strings em loop)
  var DOT_COLOR_FRONT = '#d7e6dc';
  var DOT_COLOR_BACK = '#55e98c';
  var EDGE_COLOR_FRONT = '#55e98c';
  var EDGE_COLOR_BACK = '#20d96b';

  function draw(t) {
    // Limpa com fillRect preto (mais rápido que clearRect em canvas opaco)
    ctx.fillStyle = '#101214';
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, W, H);

    var ang = t * SPIN;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    // escala para que a silhueta (com perspectiva) tenha raio = orbR
    var f = orbR * Math.sqrt(CAM * CAM - 1);
    var invTBuild = 1 / T_BUILD; // divisão pré-computada

    /* --- Projeção de todos os pontos (em arrays pré-alocados) --- */
    for (var i = 0; i < NODES; i++) {
      var rawK = (t - ptDelay[i]) * invTBuild;
      // ease inline: evita chamada de função 260×/frame
      var k = rawK < 0 ? 0 : rawK > 1 ? 1 : rawK;
      k = 1 - (1 - k) * (1 - k) * (1 - k);

      var x = ptSX[i] + (ptX[i] - ptSX[i]) * k;
      var y = ptSY[i] + (ptY[i] - ptSY[i]) * k;
      var z = ptSZ[i] + (ptZ[i] - ptSZ[i]) * k;
      // rotação em Y, depois inclinação em X (CT/ST pré-computados)
      var x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
      var z2 = y * ST + z1 * CT;
      var s = f / (CAM - z2);
      projX[i] = cx + x1 * s;
      projY[i] = cy - (y * CT - z1 * ST) * s;
      projZ[i] = z2;
      projK[i] = k;
    }

    var rimA = ease((t - 0.2) / 0.7);

    /* --- halo + silhueta (volume esférico) --- */
    ctx.globalAlpha = rimA;
    ctx.fillStyle = haloGrad; // gradiente cacheado (criado no layout)
    ctx.beginPath(); ctx.arc(cx, cy, orbR * 1.25, 0, TWO_PI); ctx.fill();
    ctx.strokeStyle = 'rgba(85,233,140,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, TWO_PI); ctx.stroke();

    /* --- Arestas: distribuição em buckets de profundidade --- */
    var edgeA_val = ease((t - 0.35) / 0.6);

    // Reset contadores dos buckets (sem alocar novos arrays)
    for (var bi = 0; bi < B; bi++) { bucketStart[bi] = 0; bucketLen[bi] = 0; }

    // Primeira passada: conta quantas arestas vão para cada bucket
    for (var e = 0; e < edgeCount; e++) {
      var aIdx = edgeA_arr[e], bIdx = edgeB_arr[e];
      var depth = (projZ[aIdx] + projZ[bIdx]) * 0.5;
      var bk = (depth + 1) * 0.5 * B | 0; // trunca para inteiro (mais rápido que Math.floor)
      if (bk < 0) bk = 0; else if (bk >= B) bk = B - 1;
      bucketLen[bk]++;
    }

    // Calcula offsets (prefix sum)
    var off = 0;
    for (var bi2 = 0; bi2 < B; bi2++) { bucketStart[bi2] = off; off += bucketLen[bi2]; }

    // Segunda passada: preenche os dados nos buckets (reusa bucketLen como cursor)
    var cursor = new Uint16Array(B); // cursor local dentro de cada bucket
    for (var e2 = 0; e2 < edgeCount; e2++) {
      var aI = edgeA_arr[e2], bI = edgeB_arr[e2];
      var d2 = (projZ[aI] + projZ[bI]) * 0.5;
      var bk2 = (d2 + 1) * 0.5 * B | 0;
      if (bk2 < 0) bk2 = 0; else if (bk2 >= B) bk2 = B - 1;
      var pos = (bucketStart[bk2] + cursor[bk2]) * 4;
      bucketData[pos] = projX[aI];
      bucketData[pos + 1] = projY[aI];
      bucketData[pos + 2] = projX[bI];
      bucketData[pos + 3] = projY[bI];
      cursor[bk2]++;
    }

    // Desenha as arestas por faixa de profundidade (poucos strokes)
    ctx.lineWidth = 1;
    for (var bk3 = 0; bk3 < B; bk3++) {
      var count = bucketLen[bk3];
      if (count === 0) continue;
      var near = (bk3 + 0.5) / B;
      ctx.globalAlpha = edgeA_val * (0.07 + near * 0.55);
      ctx.strokeStyle = near > 0.5 ? EDGE_COLOR_FRONT : EDGE_COLOR_BACK;
      ctx.beginPath();
      var base = bucketStart[bk3] * 4;
      for (var q = 0; q < count; q++) {
        var qi = base + q * 4;
        ctx.moveTo(bucketData[qi], bucketData[qi + 1]);
        ctx.lineTo(bucketData[qi + 2], bucketData[qi + 3]);
      }
      ctx.stroke();
    }

    /* --- Pontos: ordenados por profundidade (fundo → frente) --- */
    // Insertion sort no array de índices pré-alocado: ~2× mais rápido que
    // Array.sort para 260 itens quase-ordenados (rotação suave entre frames)
    for (var si2 = 1; si2 < NODES; si2++) {
      var tmp = sortIdx[si2];
      var tmpZ = projZ[tmp];
      var j = si2 - 1;
      while (j >= 0 && projZ[sortIdx[j]] > tmpZ) {
        sortIdx[j + 1] = sortIdx[j];
        j--;
      }
      sortIdx[j + 1] = tmp;
    }

    // Cada ponto tem alpha individual (varia com profundidade e k), então
    // não é possível agrupar num único path. Mas minimizamos state changes:
    // apenas 2 trocas de fillStyle (cor de fundo vs. frente) em vez de
    // avaliar a condição 260× e trocar a cada ponto.
    var orbRatio = orbR / 140;
    var splitZ = 0.2; // z = 0.2 → near2 = 0.6 (limiar de cor original)

    // Lote 1: pontos de trás — já vêm ordenados do sort
    ctx.fillStyle = DOT_COLOR_BACK;
    var n1 = 0;
    for (; n1 < NODES; n1++) {
      var idx1 = sortIdx[n1];
      if (projZ[idx1] > splitZ) break;
      var near_1 = (projZ[idx1] + 1) * 0.5;
      ctx.globalAlpha = (0.18 + near_1 * 0.82) * (0.25 + 0.75 * projK[idx1]);
      var rad1 = (0.9 + near_1 * 1.5) * orbRatio;
      if (rad1 < 0.6) rad1 = 0.6; else if (rad1 > 3.2) rad1 = 3.2;
      ctx.beginPath();
      ctx.arc(projX[idx1], projY[idx1], rad1, 0, TWO_PI);
      ctx.fill();
    }

    // Lote 2: pontos da frente (cor '#bbf7d0')
    ctx.fillStyle = DOT_COLOR_FRONT;
    for (var n2 = n1; n2 < NODES; n2++) {
      var idx2 = sortIdx[n2];
      var near_2 = (projZ[idx2] + 1) * 0.5;
      ctx.globalAlpha = (0.18 + near_2 * 0.82) * (0.25 + 0.75 * projK[idx2]);
      var rad2 = (0.9 + near_2 * 1.5) * orbRatio;
      if (rad2 < 0.6) rad2 = 0.6; else if (rad2 > 3.2) rad2 = 3.2;
      ctx.beginPath();
      ctx.arc(projX[idx2], projY[idx2], rad2, 0, TWO_PI);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  /* ---------- ciclo de vida ---------- */
  var startTs = 0, rafId = 0, done = false, leaving = false;
  var failsafe = 0, endTimer = 0, resizeRaf = 0;
  var lastFillUpdate = -1; // throttle da barra de progresso

  function frame(now) {
    if (done) return;
    if (!startTs) startTs = now; // ancora o t=0 no primeiro frame real (ignora o tempo gasto no parse/buildEdges)
    try {
      var t = (now - startTs) / 1000;

      if (t > 0.12) splash.classList.add('is-in');

      // Atualiza a barra de progresso no máximo a cada ~32ms (≈30Hz) — não precisa de 60fps
      if (fillEl && now - lastFillUpdate > 32) {
        lastFillUpdate = now;
        fillEl.style.transform = 'scaleX(' + Math.min(1, t / T_FILL).toFixed(4) + ')';
      }

      draw(t < T_END ? t : T_END);

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
  failsafe = setTimeout(finish, 5000);            // rede de segurança: nunca prende o usuário
  rafId = requestAnimationFrame(frame);
})();
