/* ============================================================
   EVOTECH DIGITAL ACTIVATION — preloader cinematográfico
   ------------------------------------------------------------
   Timeline fixo (independe de FPS, roda em tempo real):
     Cena 1  DISCOVERY   0.0s → 3.0s  partículas convergem, planeta nasce
     Cena 2  ACTIVATION  3.0s → 6.0s  planeta gira, rede orbital acende
     Cena 3  FORMATION   6.0s → 9.0s  energia migra pro centro, logo é construída
     Cena 4  TRANSITION  9.0s → 9.8s  flash + câmera atravessa, site aparece
   O site só é revelado após a Cena 4, e nunca antes de window.load
   (se o load demorar, a Cena 2 entra em loop de "respiração" até
   liberar a Cena 3 — nunca trava, nunca soma um scene igual duas vezes).

   Robustez contra o bug de F5:
     - guarda global (window.__evoIntroBooted) impede uma segunda
       inicialização se o script for avaliado mais de uma vez;
     - um único WebGLRenderer é criado por execução e é sempre
       destruído (dispose) antes de qualquer return antecipado;
     - todos os listeners são registrados com referência nomeada e
       removidos em teardown() — nunca ficam acumulando;
     - nenhum estado é lido de sessionStorage/localStorage — cada
       carregamento de página começa do zero, de forma determinística.
   ============================================================ */
(function () {
  'use strict';

  if (window.__evoIntroBooted) return; // trava contra dupla execução (bug do F5 / script duplicado)
  window.__evoIntroBooted = true;

  var splash = document.getElementById('introSplash');
  if (!splash) return;

  var canvas = document.getElementById('introCanvas');
  var mark = splash.querySelector('.intro-mark');
  var progressFill = splash.querySelector('.intro-progress-fill');
  var progressLabel = splash.querySelector('.intro-progress-label');
  var skipBtn = splash.querySelector('.intro-skip');
  var html = document.documentElement;

  var reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  html.classList.add('intro-lock');

  /* ============================================================
     1) DETECÇÃO DE CAPACIDADE → TIER
     ============================================================ */
  function detectGL() {
    try {
      var t = document.createElement('canvas');
      var gl = t.getContext('webgl') || t.getContext('experimental-webgl');
      if (!gl) return { supported: false };
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var renderer = dbg ? (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      return { supported: true, renderer: renderer.toLowerCase() };
    } catch (e) { return { supported: false }; }
  }

  function pickTier() {
    var gl = detectGL();
    if (!gl.supported) return { tier: 'low', webgl: false };
    if (reducedMotion) return { tier: 'low', webgl: true };

    var mem = navigator.deviceMemory || 4;
    var cores = navigator.hardwareConcurrency || 4;
    var minSide = Math.min(window.innerWidth, window.innerHeight);
    var maxSide = Math.max(window.innerWidth, window.innerHeight);
    var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var weakGpu = gl.renderer && /(mali-4|mali-t|adreno 3|adreno 4|powervr sgx|swiftshader)/.test(gl.renderer);

    if (weakGpu || mem <= 2 || cores <= 2) return { tier: 'low', webgl: true };

    var isPhone = minSide <= 480 && coarse;
    var isTablet = minSide > 480 && maxSide <= 1180 && coarse;

    if (isPhone) return (mem >= 6 && cores >= 6) ? { tier: 'med', webgl: true } : { tier: 'low', webgl: true };
    if (isTablet) return { tier: 'med', webgl: true };
    if (coarse) return { tier: 'med', webgl: true }; // notebook híbrido/touch
    if (mem >= 8 && cores >= 8) return { tier: 'high', webgl: true };
    return { tier: 'med', webgl: true };
  }

  var caps = pickTier();
  var tier = caps.tier;

  var TIER = {
    high: { particles: 2600, orbitDots: 220, dotSize: 1.7, bloom: true, targetFps: 55, dpr: 2 },
    med: { particles: 1300, orbitDots: 120, dotSize: 1.5, bloom: true, targetFps: 45, dpr: 1.5 },
    low: { particles: 550, orbitDots: 60, dotSize: 1.4, bloom: false, targetFps: 30, dpr: 1.25 }
  };

  function applyTierClass(t) {
    document.body.classList.remove('qhigh', 'qmed', 'qlow');
    document.body.classList.add(t === 'high' ? 'qhigh' : t === 'med' ? 'qmed' : 'qlow');
  }
  applyTierClass(tier);

  function downgrade() {
    if (tier === 'high') { tier = 'med'; }
    else if (tier === 'med') { tier = 'low'; }
    else return;
    applyTierClass(tier);
    if (engine && engine.setConfig) engine.setConfig(TIER[tier]);
  }

  /* ============================================================
     2) MOTOR 3D — planeta em camadas (núcleo, atmosfera, rede
        orbital, partículas de profundidade) via Three.js;
        fallback Canvas2D se WebGL indisponível.
     ============================================================ */
  var engine = null;

  function makeThreeEngine() {
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: tier !== 'low', alpha: true, powerPreference: 'high-performance' });
    } catch (e) { return null; }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIER[tier].dpr));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

    var world = new THREE.Group();
    scene.add(world);

    var radius = 3.3;

    /* ============================================================
       O PLANETA É A LOGO — não um globo terrestre com uma marca
       colada em cima. A mesma geometria geodésica (nós + arestas)
       que forma o ícone EvoTech é construída aqui em 3D, em escala
       planetária: um núcleo facetado escuro, a malha de arestas
       (a "rede") por cima, e os vértices como nós de energia.
       Quando a câmera se aproxima na Cena 3, essa estrutura É o
       ícone da marca — a logo não aparece: ela é revelada.
       ============================================================ */
    var detail = tier === 'high' ? 2 : tier === 'med' ? 1 : 1;
    var geoGeometry = new THREE.IcosahedronGeometry(radius, detail);

    /* Núcleo facetado — material tecnológico escuro, nunca azul/verde-terra */
    var coreMat = new THREE.MeshPhongMaterial({
      color: 0x030c07, emissive: 0x0a2414, emissiveIntensity: 0.6,
      shininess: 60, specular: 0x2fae6a, flatShading: true,
      transparent: true, opacity: 0
    });
    var core = new THREE.Mesh(geoGeometry, coreMat);
    world.add(core);

    /* Malha de arestas — a "rede" da marca, idêntica em espírito ao ícone */
    var edgesGeo = new THREE.EdgesGeometry(geoGeometry);
    var edgesMat = new THREE.LineBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0 });
    var network = new THREE.LineSegments(edgesGeo, edgesMat);
    world.add(network);

    /* Nós — um ponto de energia em cada vértice do poliedro */
    var nodesMat = new THREE.PointsMaterial({
      color: 0x86efac, size: 0.11, transparent: true, opacity: 0, sizeAttenuation: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var nodes = new THREE.Points(geoGeometry, nodesMat);
    world.add(nodes);

    /* Segunda camada, levemente maior e mais lenta — profundidade de campo tecnológica */
    var outerGeo = new THREE.IcosahedronGeometry(radius * 1.22, Math.max(0, detail - 1));
    var outerEdges = new THREE.EdgesGeometry(outerGeo);
    var outerMat = new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0 });
    var outerNetwork = new THREE.LineSegments(outerEdges, outerMat);
    world.add(outerNetwork);

    /* Halo fino — brilho de contorno, sem parecer atmosfera terrestre */
    var haloGeo = new THREE.SphereGeometry(radius * 1.04, 24, 24);
    var haloMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0, side: THREE.BackSide });
    var halo = new THREE.Mesh(haloGeo, haloMat);
    world.add(halo);

    /* ---- Pulsos de energia viajando pelas arestas (dados circulando) ---- */
    var edgePositions = edgesGeo.attributes.position.array;
    var edgeCount = edgePositions.length / 6; // cada aresta = 2 pontos * 3 componentes
    var travelerCount = Math.min(edgeCount, TIER[tier].orbitDots);
    var travelerEdge = new Int32Array(travelerCount);
    var travelerPhase = new Float32Array(travelerCount);
    var travelerSpeed = new Float32Array(travelerCount);
    for (var t = 0; t < travelerCount; t++) {
      travelerEdge[t] = Math.floor(Math.random() * edgeCount);
      travelerPhase[t] = Math.random();
      travelerSpeed[t] = 0.25 + Math.random() * 0.4;
    }
    var travelerGeo = new THREE.BufferGeometry();
    var travelerPos = new Float32Array(travelerCount * 3);
    travelerGeo.setAttribute('position', new THREE.BufferAttribute(travelerPos, 3));
    var travelerMat = new THREE.PointsMaterial({
      color: 0xeafff1, size: 0.07, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    var travelers = new THREE.Points(travelerGeo, travelerMat);
    world.add(travelers);

    function updateTravelers(dt) {
      var arr = travelerGeo.attributes.position.array;
      for (var i = 0; i < travelerCount; i++) {
        travelerPhase[i] += dt * travelerSpeed[i];
        if (travelerPhase[i] > 1) {
          travelerPhase[i] = 0;
          travelerEdge[i] = Math.floor(Math.random() * edgeCount);
        }
        var e = travelerEdge[i] * 6;
        var ph = travelerPhase[i];
        arr[i * 3] = edgePositions[e] + (edgePositions[e + 3] - edgePositions[e]) * ph;
        arr[i * 3 + 1] = edgePositions[e + 1] + (edgePositions[e + 4] - edgePositions[e + 1]) * ph;
        arr[i * 3 + 2] = edgePositions[e + 2] + (edgePositions[e + 5] - edgePositions[e + 2]) * ph;
      }
      travelerGeo.attributes.position.needsUpdate = true;
    }

    var ambient = new THREE.AmbientLight(0x1a4d2e, 1.1);
    scene.add(ambient);
    var key = new THREE.DirectionalLight(0x86efac, 1.1);
    key.position.set(4, 3, 6);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x22c55e, 0.5);
    rim.position.set(-5, -2, -4);
    scene.add(rim);

    /* ---- Camada 4: partículas em múltiplas profundidades (campo estelar convergente) ---- */
    var fieldCount = TIER[tier].particles;
    var fieldGeo = new THREE.BufferGeometry();
    var fieldStart = new Float32Array(fieldCount * 3);
    var fieldTarget = new Float32Array(fieldCount * 3);
    for (var p = 0; p < fieldCount; p++) {
      // posição final: distribuída em uma casca esférica ao redor do planeta (profundidade variável)
      var yF = 1 - (p / (fieldCount - 1)) * 2;
      var rF = Math.sqrt(1 - yF * yF);
      var thF = Math.PI * (3 - Math.sqrt(5)) * p;
      var shell = radius * (1.15 + Math.random() * 0.9);
      fieldTarget[p * 3] = Math.cos(thF) * rF * shell;
      fieldTarget[p * 3 + 1] = yF * shell;
      fieldTarget[p * 3 + 2] = Math.sin(thF) * rF * shell;

      // posição inicial: disperso, distante (a "descoberta" converge para o planeta)
      fieldStart[p * 3] = (Math.random() - 0.5) * 60;
      fieldStart[p * 3 + 1] = (Math.random() - 0.5) * 60;
      fieldStart[p * 3 + 2] = (Math.random() - 0.5) * 60 - 10;
    }
    fieldGeo.setAttribute('position', new THREE.BufferAttribute(fieldStart.slice(), 3));
    var fieldMat = new THREE.PointsMaterial({ color: 0x86efac, size: TIER[tier].dotSize / 20, transparent: true, opacity: 0.85, sizeAttenuation: true });
    var field = new THREE.Points(fieldGeo, fieldMat);
    scene.add(field);

    /* ---- Arraste (mouse/touch) — só ativo depois que o planeta "nasce" ---- */
    var drag = { active: false, lastX: 0, lastY: 0, velX: 0, velY: 0, enabled: false };
    function down(x, y) { if (drag.enabled) { drag.active = true; drag.lastX = x; drag.lastY = y; } }
    function move(x, y) {
      if (!drag.active) return;
      var dx = x - drag.lastX, dy = y - drag.lastY;
      drag.velX = dx * 0.0007; drag.velY = dy * 0.0007;
      world.rotation.y += dx * 0.005;
      world.rotation.x += dy * 0.003;
      drag.lastX = x; drag.lastY = y;
    }
    function up() { drag.active = false; }
    function onDown(e) { down(e.clientX, e.clientY); }
    function onMove(e) { move(e.clientX, e.clientY); }
    canvas.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });

    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, true);
    }
    resize();

    /* ---- Câmera cinematográfica: presets por cena/dispositivo ---- */
    function cameraDistanceFor(scene2) {
      var w = window.innerWidth, h = window.innerHeight;
      var landscapeMobile = w > h && Math.min(w, h) < 500;
      var small = Math.min(w, h) < 480;
      var base = { discovery: 22, activation: 10, formation: 5.6, transition: 3.1 };
      var d = base[scene2] || 11;
      if (landscapeMobile) d *= 0.9;
      if (small) d *= 1.08;
      return d;
    }

    return {
      resize: resize,
      setConfig: function (cfg) {
        fieldMat.size = cfg.dotSize / 20;
      },
      setDragEnabled: function (v) { drag.enabled = v; },
      /* progress: 0..1 dentro da cena atual; sceneName define o comportamento */
      update: function (sceneName, progress, dt) {
        // rotação: viva na descoberta/ativação, quase estática na formação
        // (a estrutura precisa ficar legível como a logo quando a câmera se aproxima)
        var spin = sceneName === 'discovery' ? 0.0009
          : sceneName === 'activation' ? 0.0026
          : sceneName === 'formation' ? 0.0003
          : 0.00015;
        if (!drag.active) {
          world.rotation.y += spin + drag.velX;
          world.rotation.x += drag.velY;
          drag.velX *= 0.94; drag.velY *= 0.94;
        }
        outerNetwork.rotation.y -= 0.0011;
        outerNetwork.rotation.x += 0.0004;

        updateTravelers(dt);

        // câmera: aproxima suavemente ao longo de toda a sequência — é essa
        // aproximação que transforma "o planeta" em "o ícone da marca"
        var camZ = cameraDistanceFor(sceneName);
        camera.position.z += (camZ - camera.position.z) * Math.min(1, dt * 1.6);
        camera.position.y = Math.sin(progress * Math.PI) * (sceneName === 'formation' || sceneName === 'transition' ? 0.08 : 0.35);
        camera.lookAt(0, 0, 0);

        if (sceneName === 'discovery') {
          // partículas convergindo do caos para a casca do planeta — o núcleo ainda nasce
          var posAttr = fieldGeo.attributes.position;
          var arr = posAttr.array;
          var ease = 1 - Math.pow(1 - progress, 3);
          for (var i2 = 0; i2 < fieldCount; i2++) {
            arr[i2 * 3] = fieldStart[i2 * 3] + (fieldTarget[i2 * 3] - fieldStart[i2 * 3]) * ease;
            arr[i2 * 3 + 1] = fieldStart[i2 * 3 + 1] + (fieldTarget[i2 * 3 + 1] - fieldStart[i2 * 3 + 1]) * ease;
            arr[i2 * 3 + 2] = fieldStart[i2 * 3 + 2] + (fieldTarget[i2 * 3 + 2] - fieldStart[i2 * 3 + 2]) * ease;
          }
          posAttr.needsUpdate = true;
          coreMat.opacity = Math.min(0.9, progress * 1.5);
          edgesMat.opacity = Math.min(0.5, progress * 1.1);
          nodesMat.opacity = Math.min(0.7, progress * 1.2);
          outerMat.opacity = 0;
          haloMat.opacity = 0;
          travelerMat.opacity = 0;
          fieldMat.opacity = 0.85;
        }

        if (sceneName === 'activation') {
          // a rede acorda: arestas e nós ganham brilho pleno, dados começam a circular
          coreMat.opacity = 0.92;
          edgesMat.opacity = Math.min(0.9, 0.5 + progress * 0.5);
          nodesMat.opacity = Math.min(1, 0.7 + progress * 0.4);
          outerMat.opacity = Math.min(0.35, progress * 0.5);
          haloMat.opacity = Math.min(0.18, progress * 0.25);
          travelerMat.opacity = Math.min(0.95, progress * 1.3);
          fieldMat.opacity = Math.max(0.2, 0.85 - progress * 0.5);
          drag.enabled = true;
        }

        if (sceneName === 'formation') {
          // a energia dispersa recolhe para dentro da própria rede — não "sobrepõe"
          // uma logo: alimenta a estrutura que já é a logo
          var posAttr2 = fieldGeo.attributes.position;
          var arr2 = posAttr2.array;
          var collapse = Math.pow(progress, 1.6);
          for (var i3 = 0; i3 < fieldCount; i3++) {
            arr2[i3 * 3] = fieldTarget[i3 * 3] * (1 - collapse * 0.85);
            arr2[i3 * 3 + 1] = fieldTarget[i3 * 3 + 1] * (1 - collapse * 0.85);
            arr2[i3 * 3 + 2] = fieldTarget[i3 * 3 + 2] * (1 - collapse * 0.85);
          }
          posAttr2.needsUpdate = true;
          fieldMat.opacity = Math.max(0, 0.35 - progress * 0.4);
          coreMat.opacity = Math.max(0.55, 0.92 - progress * 0.2);
          edgesMat.opacity = Math.min(1, 0.9 + progress * 0.1);
          nodesMat.opacity = 1;
          travelerMat.opacity = Math.max(0.5, 0.95 - progress * 0.3);
          outerMat.opacity = Math.max(0, 0.35 - progress * 0.35);
          haloMat.opacity = Math.min(0.3, 0.18 + progress * 0.2);
        }

        if (sceneName === 'transition') {
          fieldMat.opacity = 0;
          coreMat.opacity = Math.max(0, 0.7 - progress * 1.4);
          edgesMat.opacity = Math.max(0, 1 - progress * 1.2);
          nodesMat.opacity = Math.max(0, 1 - progress);
          travelerMat.opacity = Math.max(0, 0.5 - progress * 1.2);
          outerMat.opacity = 0;
          haloMat.opacity = Math.max(0, 0.3 - progress * 0.5);
        }
      },
      render: function () { renderer.render(scene, camera); },
      dispose: function () {
        canvas.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', up);
        [geoGeometry, edgesGeo, outerGeo, outerEdges, haloGeo, travelerGeo, fieldGeo].forEach(function (g) { g.dispose(); });
        [coreMat, edgesMat, nodesMat, outerMat, haloMat, travelerMat, fieldMat].forEach(function (m) { m.dispose(); });
        renderer.dispose();
      }
    };
  }

  /* ---- Fallback Canvas2D (sem WebGL) — mesma linguagem visual, mais simples ---- */
  function makeCanvas2DEngine() {
    var ctx = canvas.getContext('2d');
    var w, h, dpr, rot = 0;
    var dots = [];
    var count = TIER.low.particles;
    for (var i = 0; i < count; i++) {
      var y = 1 - (i / (count - 1)) * 2;
      var r = Math.sqrt(1 - y * y);
      var th = Math.PI * (3 - Math.sqrt(5)) * i;
      dots.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r });
    }
    function resize() {
      w = window.innerWidth; h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.4);
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    var dragX = 0, dragging = false, lastX = 0;
    function onDown(e) { dragging = true; lastX = e.clientX; }
    function onMove(e) { if (dragging) { dragX += (e.clientX - lastX) * 0.008; lastX = e.clientX; } }
    function onUp() { dragging = false; }
    canvas.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });

    return {
      resize: resize,
      setConfig: function () { },
      setDragEnabled: function () { },
      update: function (sceneName, progress) {
        rot += 0.005 + dragX;
        dragX *= 0.9;
      },
      render: function () {
        ctx.clearRect(0, 0, w, h);
        var cx = w / 2, cy = h / 2;
        var radius = Math.min(w, h) * (w < 480 ? 0.2 : 0.15);
        var cos = Math.cos(rot), sin = Math.sin(rot);
        for (var i = 0; i < dots.length; i++) {
          var d = dots[i];
          var x = d.x * cos - d.z * sin;
          var z = d.x * sin + d.z * cos;
          var scale = (z + 2) / 3;
          ctx.beginPath();
          ctx.arc(cx + x * radius, cy + d.y * radius, 1.3 * scale, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(74,222,128,' + (0.3 + scale * 0.5) + ')';
          ctx.fill();
        }
      },
      dispose: function () {
        canvas.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      }
    };
  }

  if (caps.webgl && typeof THREE !== 'undefined') {
    engine = makeThreeEngine();
  }
  if (!engine) engine = makeCanvas2DEngine();

  /* ============================================================
     3) TIMELINE DAS CENAS — tempo real, sincronizado com o load
     ============================================================ */
  var SCENES = [
    { name: 'discovery', duration: 3000, label: 'Conectando' },
    { name: 'activation', duration: 3000, label: 'Ativando rede' },
    { name: 'formation', duration: 3000, label: 'Construindo marca' },
    { name: 'transition', duration: 800, label: 'Pronto' }
  ];
  var sceneStartOffsets = (function () {
    var acc = 0, out = [];
    SCENES.forEach(function (s) { out.push(acc); acc += s.duration; });
    return out;
  })();
  var totalCore = sceneStartOffsets[3]; // início da transição = 9000ms

  var pageLoaded = false;
  window.addEventListener('load', function onLoad() {
    pageLoaded = true;
    window.removeEventListener('load', onLoad);
  });
  // se por algum motivo o evento load nunca disparar, não prender o usuário além de 14s
  var hardStop = setTimeout(function () { pageLoaded = true; }, 14000);

  var startedAt = null;
  var running = true;
  var raf = null;
  var finished = false;
  var skipped = false;

  function currentScene(elapsed) {
    if (elapsed < sceneStartOffsets[1]) return { idx: 0, t: elapsed };
    if (elapsed < sceneStartOffsets[2]) return { idx: 1, t: elapsed - sceneStartOffsets[1] };
    if (elapsed < sceneStartOffsets[3]) return { idx: 2, t: elapsed - sceneStartOffsets[2] };
    return { idx: 3, t: elapsed - sceneStartOffsets[3] };
  }

  function loop(now) {
    if (!running) return;
    if (startedAt === null) startedAt = now;
    var lastFrame = loop._last || now;
    var dt = Math.min(0.05, (now - lastFrame) / 1000);
    loop._last = now;

    var elapsed = now - startedAt;

    if (!skipped) {
      // Cena 3 (formation) só é liberada quando a página já carregou;
      // enquanto isso, a Cena 2 respira em loop suave sem travar visualmente.
      var effectiveElapsed = elapsed;
      if (!pageLoaded && elapsed >= sceneStartOffsets[2]) {
        var breatheWindow = SCENES[1].duration;
        var into = (elapsed - sceneStartOffsets[1]) % breatheWindow;
        effectiveElapsed = sceneStartOffsets[1] + into;
        updateProgressUI(SCENES[1].label, 55 + Math.sin(elapsed / 500) * 8);
      } else {
        effectiveElapsed = elapsed;
      }

      var cs = currentScene(effectiveElapsed);
      var sceneDef = SCENES[cs.idx];
      var progress = Math.min(1, cs.t / sceneDef.duration);

      if (splash.getAttribute('data-scene') !== sceneDef.name) {
        splash.setAttribute('data-scene', sceneDef.name);
      }

      if (engine && engine.update) engine.update(sceneDef.name, progress, dt);

      if (pageLoaded || cs.idx < 2) {
        var pct = Math.min(96, ((sceneStartOffsets[cs.idx] + cs.t) / totalCore) * 100);
        updateProgressUI(sceneDef.label, pct);
      }

      if (pageLoaded && effectiveElapsed >= sceneStartOffsets[3] + SCENES[3].duration) {
        finish();
        return;
      }
    }

    if (engine && engine.render) engine.render();
    raf = requestAnimationFrame(loop);
  }

  function updateProgressUI(label, pct) {
    progressFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    progressLabel.textContent = label;
  }

  raf = requestAnimationFrame(loop);

  /* ---- Pausa em segundo plano (bateria) ---- */
  function onVisibility() {
    if (document.hidden) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    } else if (!finished) {
      running = true;
      loop._last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  function onResize() { if (engine && engine.resize) engine.resize(); }
  function onOrientation() { setTimeout(onResize, 120); }
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onOrientation);

  /* ---- Pular ---- */
  function onSkip() {
    if (finished) return;
    skipped = true;
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { } }
    splash.setAttribute('data-scene', 'transition');
    setTimeout(finish, 260);
  }
  skipBtn.addEventListener('click', onSkip);

  /* ---- Finalização e teardown completo ---- */
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(hardStop);
    updateProgressUI('Pronto', 100);
    mark.classList.add('is-out');
    setTimeout(teardown, 640);
  }

  function teardown() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onOrientation);
    skipBtn.removeEventListener('click', onSkip);

    html.classList.remove('intro-lock');
    splash.classList.add('is-hidden');

    setTimeout(function () {
      splash.classList.add('is-removed');
      if (engine && engine.dispose) engine.dispose();
      engine = null;
    }, 720);
  }
})();
