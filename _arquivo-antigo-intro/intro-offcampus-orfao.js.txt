'use strict';

/* ============================================================
   OFFCAMPUS — ABERTURA (intro) · ~2,5 s
   ------------------------------------------------------------
   Esfera geodésica 3D (projeção em perspectiva própria, sem libs)
   + wordmark em glifos geométricos (Path2D) + arco orbital no
   primeiro "O". Uma única linha do tempo, dirigida por relógio
   real (não por contagem de frames).

   Linha do tempo (s):
     0.00–0.40  primeiros pontos
     0.25–0.95  malha 3D se forma
     0.55–1.50  tipografia revelada (do centro da esfera p/ fora)
     1.35–1.90  destaque: arco orbital + varredura de luz + OFF
     1.90–2.50  dissipação e revelação do site

   Encerramento: release() (libera a página, ~1,9 s) e finish() (limpeza
   total, 1x) são operações distintas. Pular / Escape / fim normal /
   alternativa visual / prefers-reduced-motion / fail-safe de 4 s
   convergem todos em finish().

   Marcação: #intro em index.html · Estilos: seção INTRO em main.css
   Debug: ?intro=off (desativa por completo: nada é travado, animado ou
   agendado) · ?intro=fallback (força alternativa sem canvas) ·
   ?introT=1.2 (congela o quadro em t = 1.2 s)
   ============================================================ */
(function () {
    const html = document.documentElement;
    const qs = window.location.search;

    /* ---------- desativação (?intro=off) ----------
       Verificada ANTES de qualquer outra coisa: sem inert, sem listeners,
       sem timers, sem canvas e sem requestAnimationFrame. O padrão é o mesmo
       do <script> do <head> em index.html (que já nem liga a classe intro-on). */
    const root = document.getElementById('intro');
    const introOff = /[?&]intro=off(?:&|$)/.test(qs);
    if (introOff || !root) {
        html.classList.remove('intro-on', 'intro-released');
        if (root) root.remove();
        return;
    }

    const DURATION = 2.5;          // fim total (s)
    const T_RELEASE = 1.9;         // site já recebe interação
    const T_FADE_START = 2.1;      // overlay começa a clarear
    const T_FAILSAFE = 4000;       // rede de segurança global (ms)
    const ONCE_PER_SESSION = false; // true = só na 1ª visita de cada aba

    const forceFallback = /[?&]intro=fallback/.test(qs);
    const freezeMatch = qs.match(/[?&]introT=([\d.]+)/);
    const freezeAt = freezeMatch ? parseFloat(freezeMatch[1]) : null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (ONCE_PER_SESSION && freezeAt === null) {
        let seen = false;
        try { seen = sessionStorage.getItem('oc_intro_seen') === '1'; } catch (e) { /* ignore */ }
        if (seen) {                               // nada foi travado ainda: só desliga
            html.classList.remove('intro-on', 'intro-released');
            root.remove();
            return;
        }
    }

    window.__ocIntroActive = true;   // avisa o fail-safe do <head> que este script assumiu o controle

    const skipBtn = root.querySelector('.intro-skip');
    const canvas = root.querySelector('.intro-canvas');

    /* ---------- estado ----------
       Duas operações DISTINTAS:
         release() — libera a página (scroll, cliques, inert). O overlay
                     continua na tela clareando. Pode acontecer 1x, ~1,9 s.
         finish()  — encerra a intro: limpeza completa, 1x, estado terminal.
       finish() NÃO depende de release() ter acontecido (nem do contrário). */
    let released = false;
    let finished = false;
    let skipping = false;
    let rafId = 0;
    const timers = new Set();
    let locked = [];                 // nós em que ESTE script aplicou inert

    function later(fn, ms) {         // setTimeout rastreado: finish() cancela todos
        const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
        timers.add(id);
        return id;
    }

    const pageNodes = () => Array.from(document.body.children)
        .filter(n => n !== root && n.tagName !== 'SCRIPT' && n.tagName !== 'NOSCRIPT');

    function lockPage() {            // só marca o que ainda não era inert por outro motivo
        locked = pageNodes().filter(n => !n.hasAttribute('inert'));
        locked.forEach(n => n.setAttribute('inert', ''));
    }
    function unlockPage() {
        locked.forEach(n => n.removeAttribute('inert'));
        locked = [];
    }

    function release() {
        if (released || finished) return;
        released = true;
        html.classList.add('intro-released');          // libera scroll + cliques
        unlockPage();
        root.setAttribute('inert', '');                // overlay deixa de ser focável/anunciado
        root.removeAttribute('aria-modal');
    }

    function finish() {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(rafId);
        rafId = 0;
        timers.forEach(clearTimeout);                  // fallback, release, fail-safe, fade do Pular…
        timers.clear();
        window.removeEventListener('resize', onResize);
        document.removeEventListener('keydown', onKey);
        if (skipBtn) skipBtn.removeEventListener('click', skip);
        unlockPage();                                  // mesmo que release() nunca tenha rodado
        root.remove();                                 // remove o overlay do DOM
        html.classList.remove('intro-on', 'intro-released');
        if (ONCE_PER_SESSION) { try { sessionStorage.setItem('oc_intro_seen', '1'); } catch (e) { /* ignore */ } }
    }

    function skip() {
        if (finished || skipping) return;
        skipping = true;
        cancelAnimationFrame(rafId);
        rafId = 0;
        release();
        root.style.transition = 'opacity .18s ease';
        root.style.opacity = '0';
        later(finish, 200);
    }

    function onKey(e) { if (e.key === 'Escape' || e.key === 'Esc') skip(); }

    /* bloqueia a página atrás da intro (acessibilidade básica) */
    lockPage();
    document.addEventListener('keydown', onKey);
    if (skipBtn) {
        skipBtn.addEventListener('click', skip);
        try { skipBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    // rede de segurança global, armada ANTES de qualquer preparo pesado: se algo
    // lançar exceção ou a aba ficar oculta, a página nunca fica presa atrás do overlay.
    // (no modo de inspeção ?introT= o quadro precisa permanecer.)
    if (freezeAt === null) later(finish, T_FAILSAFE);

    /* ---------- alternativa visual (sem canvas / sem 3D) ---------- */
    function startFallback() {
        if (finished) return;
        if (reduceMotion) { finish(); return; }
        root.classList.add('intro--fallback');
        later(release, T_RELEASE * 1000);
        later(finish, DURATION * 1000 + 50);
    }

    let ctx = null;
    try { ctx = !forceFallback && canvas && canvas.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx || typeof Path2D === 'undefined') { startFallback(); return; }

    /* ============================================================
       DADOS: glifos (lidos do SVG do HTML — fonte única) e esfera
       ============================================================ */
    const TEXT_W = 952, TEXT_H = 100, TEXT_CX = 476;
    const glyphs = Array.from(root.querySelectorAll('.intro-fallback .il')).map(g => {
        const p = g.querySelector('path');
        const x = parseFloat(g.dataset.x), w = parseFloat(g.dataset.w);
        return {
            x, w, cx: x + w / 2,
            kind: g.dataset.kind,
            off: g.classList.contains('il-off'),
            evenodd: p.getAttribute('fill-rule') === 'evenodd',
            path: new Path2D(p.getAttribute('d'))
        };
    });
    if (glyphs.length !== 9) { startFallback(); return; }

    // ordem de revelação: do centro da esfera para fora
    glyphs.map((g, i) => ({ i, d: Math.abs(g.cx - TEXT_CX) }))
        .sort((a, b) => a.d - b.d)
        .forEach((o, rank) => { glyphs[o.i].rank = rank; });
    const OFF_LAST = glyphs.findIndex(g => g.off);   // primeiro "O"

    // icosfera (geodésica) — nível 2 → 162 vértices / 480 arestas
    function buildSphere(level) {
        const t = (1 + Math.sqrt(5)) / 2;
        const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
        const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
                   [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
        let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2],
                 [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5],
                 [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
        for (let l = 0; l < level; l++) {
            const cache = {}, nf = [];
            const mid = (a, b) => {
                const k = a < b ? a + '_' + b : b + '_' + a;
                if (cache[k] !== undefined) return cache[k];
                V.push(norm([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2]));
                return (cache[k] = V.length - 1);
            };
            F.forEach(f => {
                const a = mid(f[0], f[1]), b = mid(f[1], f[2]), c = mid(f[2], f[0]);
                nf.push([f[0], a, c], [f[1], b, a], [f[2], c, b], [a, b, c]);
            });
            F = nf;
        }
        const seen = {}, E = [];
        F.forEach(f => [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]].forEach(e => {
            const a = Math.min(e[0], e[1]), b = Math.max(e[0], e[1]), k = a + '_' + b;
            if (!seen[k]) { seen[k] = 1; E.push([a, b]); }
        }));
        return { V, E };
    }
    const sph = buildSphere(2);
    const NV = sph.V.length;

    // rotação: yaw (Y) depois pitch (X)
    const PITCH = 0.36;
    const yawAt = t => -0.75 + 0.9 * t;
    function rot(v, yaw, pitch) {
        const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
        const x1 = v[0] * cy + v[2] * sy, z1 = -v[0] * sy + v[2] * cy;
        return [x1, v[1] * cp - z1 * sp, v[1] * sp + z1 * cp];
    }

    // vértice-semente: o que estiver voltado ao observador (cima/esquerda) em t = 0
    let seed = 0, best = -9;
    for (let i = 0; i < NV; i++) {
        const r = rot(sph.V[i], yawAt(0), PITCH);
        const s = r[0] * -0.30 + r[1] * 0.35 + r[2] * 0.89;
        if (s > best) { best = s; seed = i; }
    }
    const ang = sph.V.map(v => {
        const d = v[0] * sph.V[seed][0] + v[1] * sph.V[seed][1] + v[2] * sph.V[seed][2];
        return Math.acos(Math.max(-1, Math.min(1, d))) / Math.PI;   // 0..1
    });
    const born = ang.map(a => 0.02 + 0.40 * a);                     // pontos: 0.02 → 0.42 s
    const edges = sph.E.map(e => {
        const a = e[0], b = e[1];
        const from = born[a] <= born[b] ? a : b, to = from === a ? b : a;
        let eb = 0.25 + 0.42 * (ang[a] + ang[b]) / 2;               // arestas: 0.25 → 0.67 (+0.28 de traço)
        eb = Math.min(0.67, Math.max(eb, born[from] + 0.06));
        return { from, to, eb };
    });
    const adj = Array.from({ length: NV }, () => []);
    edges.forEach(e => { adj[e.from].push(e.to); adj[e.to].push(e.from); });

    // pulsos de energia: caminhos fixos (PRNG com semente → sempre idêntico)
    function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    const rnd = mulberry(20260);
    const PULSE_N = 8, PULSE_DUR = 0.5;
    const pulses = [];
    for (let i = 0; i < PULSE_N; i++) {
        let v = Math.floor(rnd() * NV), prev = -1;
        const path = [v];
        for (let k = 0; k < 3; k++) {
            const opts = adj[v].filter(n => n !== prev);
            const n = opts[Math.floor(rnd() * opts.length)];
            prev = v; v = n; path.push(v);
        }
        pulses.push({ path, ts: 0.90 + i * 0.105 });
    }

    /* ============================================================
       LAYOUT (recalculado no resize)
       ============================================================ */
    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 0, u = 0, tx = 0, th = 0;
    let orb = null;
    const tc = document.createElement('canvas');   // camada de texto (bbox pequena)
    const tctx = tc.getContext('2d');
    const PADX = 40, PADY = 30;
    const bc = document.createElement('canvas');   // textura da faixa escura atrás do texto
    let bw = 0, bh = 0;

    function layout() {
        W = window.innerWidth; H = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        cx = W / 2; cy = H / 2;
        R = Math.min(W * 0.36, H * 0.30);
        const tw = Math.min(W * 0.88, 2 * R * 1.9);
        u = tw / TEXT_W; th = TEXT_H * u; tx = cx - tw / 2;
        tc.width = Math.ceil((TEXT_W + 2 * PADX) * u * dpr);
        tc.height = Math.ceil((TEXT_H + 2 * PADY) * u * dpr);
        // órbita ao redor do primeiro "O"
        orb = { x: tx + 50 * u, y: cy, rx: 82 * u, ry: 36 * u, tilt: -0.5 };
        // faixa escura: gradiente vertical × máscara horizontal (sem bordas duras)
        bw = R * 2.9; bh = th * 3.6;
        bc.width = Math.ceil(bw * dpr); bc.height = Math.ceil(bh * dpr);
        const b = bc.getContext('2d');
        b.setTransform(dpr, 0, 0, dpr, 0, 0);
        b.clearRect(0, 0, bw, bh);
        let g = b.createLinearGradient(0, 0, 0, bh);
        g.addColorStop(0, 'rgba(2,6,4,0)'); g.addColorStop(0.28, 'rgba(2,6,4,1)');
        g.addColorStop(0.72, 'rgba(2,6,4,1)'); g.addColorStop(1, 'rgba(2,6,4,0)');
        b.fillStyle = g; b.fillRect(0, 0, bw, bh);
        b.globalCompositeOperation = 'destination-in';
        g = b.createLinearGradient(0, 0, bw, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.2, 'rgba(0,0,0,1)');
        g.addColorStop(0.8, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        b.fillStyle = g; b.fillRect(0, 0, bw, bh);
    }

    /* ============================================================
       UTILITÁRIOS
       ============================================================ */
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const c01 = x => clamp(x, 0, 1);
    const easeOut = x => 1 - Math.pow(1 - x, 3);
    const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    const backOut = x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
    const lerp = (a, b, k) => a + (b - a) * k;
    const NEON = [57, 255, 122];

    const CAM = 3.4;
    function project(v, yaw, scale) {
        const r = rot(v, yaw, PITCH);
        const s = CAM / (CAM - r[2]);
        return { x: cx + r[0] * R * s * scale, y: cy - r[1] * R * s * scale, df: (r[2] + 1) / 2 };
    }

    function orbitPoint(th_) {
        const ex = orb.rx * Math.cos(th_), ey = orb.ry * Math.sin(th_);
        const c = Math.cos(orb.tilt), s = Math.sin(orb.tilt);
        return { x: orb.x + ex * c - ey * s, y: orb.y + ex * s + ey * c, front: Math.sin(th_) >= 0 };
    }

    const NB = 6;
    const px = new Float32Array(NV), py = new Float32Array(NV), pd = new Float32Array(NV);

    /* ============================================================
       RENDER (t em segundos)
       ============================================================ */
    function render(t) {
        const D = 1 - easeInOut(c01((t - 1.9) / 0.5));       // dissipação 1 → 0
        const dis = 1 - D;
        const yaw = yawAt(t);
        const scaleIn = (0.9 + 0.1 * easeOut(c01(t / 1.0))) * (1 + 0.10 * easeOut(c01((t - 1.9) / 0.6)));
        const Rs = R * scaleIn;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        /* --- halo + corpo da esfera (volume) --- */
        const body = easeOut(c01((t - 0.2) / 0.7)) * D;
        if (body > 0) {
            let g = ctx.createRadialGradient(cx, cy, Rs * 0.9, cx, cy, Rs * 1.65);
            g.addColorStop(0, 'rgba(57,255,122,' + (0.10 * body) + ')');
            g.addColorStop(1, 'rgba(57,255,122,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, Rs * 1.65, 0, 6.2832); ctx.fill();

            g = ctx.createRadialGradient(cx - Rs * 0.32, cy - Rs * 0.36, Rs * 0.08, cx, cy, Rs * 1.02);
            g.addColorStop(0, 'rgba(34,160,84,' + (0.20 * body) + ')');
            g.addColorStop(0.65, 'rgba(6,56,28,' + (0.12 * body) + ')');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, Rs * 1.02, 0, 6.2832); ctx.fill();

            ctx.strokeStyle = 'rgba(57,255,122,' + (0.22 * body) + ')';
            ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, Rs, 0, 6.2832); ctx.stroke();
        }

        /* --- projeção dos vértices --- */
        for (let i = 0; i < NV; i++) {
            const p = project(sph.V[i], yaw, scaleIn);
            px[i] = p.x; py[i] = p.y; pd[i] = p.df;
        }

        /* --- arestas (em faixas de profundidade) --- */
        const buckets = Array.from({ length: NB }, () => []);
        for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            const k = c01((t - e.eb) / 0.28);
            if (k <= 0) continue;
            const kk = easeOut(k);
            const x1 = px[e.from], y1 = py[e.from];
            const x2 = lerp(x1, px[e.to], kk), y2 = lerp(y1, py[e.to], kk);
            const df = (pd[e.from] + pd[e.to]) / 2;
            buckets[Math.min(NB - 1, Math.floor(df * NB))].push(x1, y1, x2, y2);
        }
        ctx.lineCap = 'round';
        for (let b = 0; b < NB; b++) {
            const s = buckets[b]; if (!s.length) continue;
            const f = (b + 0.5) / NB;
            ctx.strokeStyle = 'rgba(' + Math.round(lerp(10, 57, f)) + ',' + Math.round(lerp(95, 255, f)) + ',' +
                Math.round(lerp(45, 122, f)) + ',' + ((0.10 + 0.78 * Math.pow(f, 1.3)) * D).toFixed(3) + ')';
            ctx.lineWidth = 0.6 + 0.9 * f;
            ctx.beginPath();
            for (let j = 0; j < s.length; j += 4) { ctx.moveTo(s[j], s[j + 1]); ctx.lineTo(s[j + 2], s[j + 3]); }
            ctx.stroke();
        }

        /* --- vértices (fundo → frente) --- */
        const vs = Math.max(0.75, Math.min(1.25, R / 200));
        for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i < NV; i++) {
                const df = pd[i];
                if ((pass === 0) === (df >= 0.5)) continue;
                const age = t - born[i]; if (age < 0) continue;
                const pop = age < 0.2 ? backOut(age / 0.2) : 1;
                const r = (0.9 + 2.0 * df) * pop * vs;
                const a = (0.25 + 0.75 * df) * D;
                if (df > 0.68) {
                    ctx.fillStyle = 'rgba(57,255,122,' + (0.10 * D) + ')';
                    ctx.beginPath(); ctx.arc(px[i], py[i], r * 3.4, 0, 6.2832); ctx.fill();
                }
                ctx.fillStyle = df > 0.6 ? 'rgba(170,255,205,' + a.toFixed(3) + ')' : 'rgba(57,255,122,' + a.toFixed(3) + ')';
                ctx.beginPath(); ctx.arc(px[i], py[i], Math.max(0.4, r), 0, 6.2832); ctx.fill();
            }
        }

        /* --- pulsos de energia ao longo das conexões --- */
        for (let i = 0; i < pulses.length; i++) {
            const pu = pulses[i];
            const s = (t - pu.ts) / PULSE_DUR;
            if (s < 0 || s > 1.15) continue;
            const L = pu.path.length - 1;
            const at = pos => {
                const q = clamp(pos, 0, L - 1e-6), k = Math.floor(q), f = q - k;
                const a = sph.V[pu.path[k]], b = sph.V[pu.path[k + 1]];
                return project([lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)], yaw, scaleIn);
            };
            const fade = (1 - c01((s - 1) / 0.15)) * D;
            const head = clamp(s, 0, 1) * L;
            let prevP = at(head);
            for (let j = 1; j <= 6; j++) {
                const p = at(head - j * 0.11);
                if (head - j * 0.11 < 0) break;
                const a = (1 - j / 7) * (0.25 + 0.75 * prevP.df) * fade;
                ctx.strokeStyle = 'rgba(190,255,215,' + a.toFixed(3) + ')';
                ctx.lineWidth = 1.7 * (1 - j / 9);
                ctx.beginPath(); ctx.moveTo(prevP.x, prevP.y); ctx.lineTo(p.x, p.y); ctx.stroke();
                prevP = p;
            }
            const h = at(head), ha = (0.25 + 0.75 * h.df) * fade;
            ctx.fillStyle = 'rgba(57,255,122,' + (0.22 * ha) + ')';
            ctx.beginPath(); ctx.arc(h.x, h.y, 8 * vs, 0, 6.2832); ctx.fill();
            ctx.fillStyle = 'rgba(220,255,232,' + ha.toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(h.x, h.y, 2.1 * vs, 0, 6.2832); ctx.fill();
        }

        /* --- arco orbital: metade de trás (atrás do "O") --- */
        const ring = easeOut(c01((t - 1.30) / 0.25)) * D;
        const headA = -Math.PI / 2 + Math.max(0, t - 1.35) * (Math.PI * 2 / 0.5);
        const tail = 1.7;
        const lw = Math.max(1.6, 3.6 * u);
        function drawOrbit(front) {
            if (ring <= 0) return;
            const N = 72;
            for (let i = 0; i < N; i++) {
                const a0 = (i / N) * 6.2832, a1 = ((i + 1) / N) * 6.2832;
                const m = orbitPoint((a0 + a1) / 2);
                if (m.front !== front) continue;
                const p0 = orbitPoint(a0), p1 = orbitPoint(a1);
                // distância angular atrás da "cabeça" que gira
                let d = ((headA - (a0 + a1) / 2) % 6.2832 + 6.2832) % 6.2832;
                const lit = t >= 1.35 && d < tail ? 1 - d / tail : 0;
                const base = front ? 0.75 : 0.32;
                ctx.strokeStyle = lit > 0.02
                    ? 'rgba(' + Math.round(lerp(57, 190, lit * lit)) + ',255,' + Math.round(lerp(122, 215, lit * lit)) + ',' + (ring * Math.max(base, lit * (front ? 1 : 0.55))).toFixed(3) + ')'
                    : 'rgba(57,255,122,' + (ring * base).toFixed(3) + ')';
                ctx.lineWidth = lit > 0.02 ? lw * (0.55 + 0.45 * lit) : Math.max(1.3, lw * 0.6);
                ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
            }
            // nó luminoso na cabeça
            if (t >= 1.35) {
                const n = orbitPoint(headA);
                if (n.front === front) {
                    const na = ring * (front ? 1 : 0.5);
                    ctx.fillStyle = 'rgba(57,255,122,' + (0.25 * na) + ')';
                    ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(6, 11 * u), 0, 6.2832); ctx.fill();
                    ctx.fillStyle = 'rgba(225,255,235,' + na.toFixed(3) + ')';
                    ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(1.8, 4.6 * u), 0, 6.2832); ctx.fill();
                }
            }
        }
        drawOrbit(false);

        /* --- faixa escura atrás do texto (malha passa "por trás" da marca) --- */
        const tIn = c01((t - 0.55) / 0.5) * D;
        if (tIn > 0) {
            ctx.globalAlpha = 0.78 * tIn;
            ctx.drawImage(bc, cx - bw / 2, cy - bh / 2, bw, bh);
            ctx.globalAlpha = 1;
        }

        /* --- ligação esfera → primeiro "O" (passa acima do texto) --- */
        const lk = easeInOut(c01((t - 1.30) / 0.28));
        if (lk > 0 && D > 0) {
            const S = { x: cx - Rs * 0.80, y: cy - Rs * 0.60 };
            const E = orbitPoint(-Math.PI / 2);
            const C = { x: (S.x + E.x) / 2, y: Math.min(S.y, E.y) - 0.30 * Rs };
            const q = k => ({
                x: (1 - k) * (1 - k) * S.x + 2 * (1 - k) * k * C.x + k * k * E.x,
                y: (1 - k) * (1 - k) * S.y + 2 * (1 - k) * k * C.y + k * k * E.y
            });
            const la = (t > 1.7 ? 0.28 : 0.6) * D;
            ctx.strokeStyle = 'rgba(57,255,122,' + la.toFixed(3) + ')';
            ctx.lineWidth = 1.1; ctx.beginPath();
            for (let i = 0; i <= 28; i++) { const p = q(lk * i / 28); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
            ctx.stroke();
            // nó no limite da esfera + pulso viajando
            ctx.fillStyle = 'rgba(170,255,205,' + D + ')';
            ctx.beginPath(); ctx.arc(S.x, S.y, 2.6 * vs, 0, 6.2832); ctx.fill();
            const pk = easeInOut(c01((t - 1.40) / 0.26));
            if (pk > 0 && pk < 1) {
                const ph = q(pk);
                ctx.fillStyle = 'rgba(57,255,122,' + (0.25 * D) + ')';
                ctx.beginPath(); ctx.arc(ph.x, ph.y, 8 * vs, 0, 6.2832); ctx.fill();
                ctx.fillStyle = 'rgba(225,255,235,' + D + ')';
                ctx.beginPath(); ctx.arc(ph.x, ph.y, 2.2 * vs, 0, 6.2832); ctx.fill();
            }
        }

        /* --- tipografia (camada própria) --- */
        const ox = tx - PADX * u, oy = cy - (TEXT_H / 2 + PADY) * u;
        const glow = Math.sin(Math.PI * c01((t - 1.35) / 0.55));   // 0 → 1 → 0 no destaque
        const prog = glyphs.map(g => easeOut(c01((t - (0.55 + g.rank * 0.085)) / 0.28)));

        if (t >= 0.55 && D > 0) {
            tctx.setTransform(1, 0, 0, 1, 0, 0);
            tctx.clearRect(0, 0, tc.width, tc.height);
            tctx.setTransform(dpr * u, 0, 0, dpr * u, dpr * u * PADX, dpr * u * PADY);
            tctx.lineJoin = 'miter'; tctx.lineCap = 'butt';
            glyphs.forEach((g, i) => {
                const p = prog[i]; if (p <= 0) return;
                const dx = (g.cx - TEXT_CX) * (-0.10 * (1 - p) + 0.07 * dis);
                tctx.save();
                tctx.translate(g.x + dx, 10 * (1 - p));
                tctx.beginPath(); tctx.rect(-12, 108 - 118 * p, g.w + 24, 130); tctx.clip();   // máscara que sobe
                tctx.globalAlpha = Math.min(1, p * 1.4) * D;
                const col = g.off ? 'rgb(57,255,122)' : 'rgb(240,245,241)';
                if (g.kind === 'stroke') { tctx.lineWidth = 17; tctx.strokeStyle = col; tctx.stroke(g.path); }
                else { tctx.fillStyle = col; tctx.fill(g.path, g.evenodd ? 'evenodd' : 'nonzero'); }
                tctx.restore();
            });
            // varredura de luz sobre a assinatura (1.40 → 1.85)
            const sp = easeInOut(c01((t - 1.40) / 0.45));
            if (sp > 0 && sp < 1) {
                const sx = -140 + (TEXT_W + 280) * sp;
                const gg = tctx.createLinearGradient(sx - 60, 0, sx + 60, 40);
                gg.addColorStop(0, 'rgba(120,255,170,0)');
                gg.addColorStop(0.5, 'rgba(150,255,190,0.85)');
                gg.addColorStop(1, 'rgba(120,255,170,0)');
                tctx.globalCompositeOperation = 'source-atop';
                tctx.fillStyle = gg; tctx.fillRect(-PADX, -PADY, TEXT_W + 2 * PADX, TEXT_H + 2 * PADY);
                tctx.globalCompositeOperation = 'source-over';
            }

            // brilho contido em "OFF" (traços alargados, sem blur)
            if (glow > 0.01) {
                ctx.save();
                ctx.setTransform(dpr * u, 0, 0, dpr * u, dpr * tx, dpr * (cy - TEXT_H * u / 2));
                glyphs.forEach((g, i) => {
                    if (!g.off || prog[i] < 0.98) return;
                    ctx.save(); ctx.translate(g.x, 0);
                    ctx.lineJoin = 'round';
                    ctx.strokeStyle = 'rgba(57,255,122,' + (0.07 * glow * D) + ')'; ctx.lineWidth = 16; ctx.stroke(g.path);
                    ctx.strokeStyle = 'rgba(57,255,122,' + (0.13 * glow * D) + ')'; ctx.lineWidth = 7; ctx.stroke(g.path);
                    ctx.restore();
                });
                ctx.restore();
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.drawImage(tc, ox, oy, tc.width / dpr, tc.height / dpr);
        }

        /* --- arco orbital: metade da frente (cruza por cima do "O") --- */
        drawOrbit(true);

        /* --- opacidade do overlay: revela o site --- */
        root.style.opacity = t <= T_FADE_START ? '1' : String(Math.max(0, 1 - (t - T_FADE_START) / (DURATION - T_FADE_START)));
        if (t >= T_RELEASE) release();
    }

    /* ============================================================
       LOOP / EVENTOS
       ============================================================ */
    function onResize() {
        layout();
        if (freezeAt !== null) render(freezeAt);
        else if (reduceMotion) render(1.72);
    }
    window.addEventListener('resize', onResize);

    try {
        layout();
        if (freezeAt !== null) {                       // modo de inspeção de quadro (teste)
            render(freezeAt);
            return;
        }
        if (reduceMotion) {                            // quadro estático, sem movimento
            render(1.72);
            root.style.opacity = '1';
            later(release, 400);
            later(finish, 800);
            return;
        }
        let t0 = null;
        const frame = now => {
            if (finished || skipping) return;
            if (t0 === null) t0 = now;
            const t = (now - t0) / 1000;
            if (t >= DURATION) { finish(); return; }
            try { render(t); } catch (err) {
                cancelAnimationFrame(rafId);
                canvas.style.display = 'none';
                startFallback();
                return;
            }
            rafId = requestAnimationFrame(frame);
        };
        rafId = requestAnimationFrame(frame);
    } catch (err) {
        canvas.style.display = 'none';
        startFallback();
    }
})();
