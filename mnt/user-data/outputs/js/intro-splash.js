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

   REVISÃO — esfera "constelação" (não mais wireframe sólido):
     - a rede de nós deixou de vir de uma IcosahedronGeometry (que
       gerava dezenas de arestas por vértice e "enchia" a esfera).
       Agora são ~50–80 nós amostrados por espiral de Fibonacci na
       casca da esfera, ligados só aos vizinhos mais próximos, com
       um orçamento total de arestas e grau máximo por nó — sobra
       bastante superfície sem nenhuma conexão, de propósito;
     - profundidade real: os nós usam um ShaderMaterial com tamanho
       e opacidade por vértice (não um PointsMaterial uniforme), então
       o que está longe da câmera fica visivelmente menor, mais
       transparente e menos brilhante do que o que está perto;
     - a "poeira" inicial nasce em pequenos aglomerados espalhados
       (não uma nuvem única homogênea), com deriva própria — parte
       sobe, parte desce — antes de migrar para a posição final;
     - a montagem é de baixo para cima: o atraso de cada nó depende
       da altura do seu alvo (base primeiro, topo por último);
     - as arestas só nascem quando os dois nós já chegaram, e mesmo
       assim crescem de um ponto até o outro (não aparecem prontas),
       em pequenos grupos escalonados — efeito "constelação";
     - glow contido: nós luminosos, linhas discretas, fundo escuro;
       a camada externa de "wireframe duplo" foi removida.
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

  /* nodeCount/edgeBudget/maxDegree controlam a REDE (a esfera-constelação);
     particles/orbitDots controlam a poeira de fundo e os pulsos de energia —
     ambos foram reduzidos para não competir com a rede nem exagerar o glow. */
  var TIER = {
    high: { particles: 900, orbitDots: 14, dotSize: 1.7, bloom: true, targetFps: 55, dpr: 2, nodeCount: 80, edgeBudget: 68, maxDegree: 3 },
    med: { particles: 600, orbitDots: 10, dotSize: 1.5, bloom: true, targetFps: 45, dpr: 1.5, nodeCount: 65, edgeBudget: 54, maxDegree: 3 },
    low: { particles: 320, orbitDots: 6, dotSize: 1.4, bloom: false, targetFps: 30, dpr: 1.25, nodeCount: 50, edgeBudget: 40, maxDegree: 2 }
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
     2) MOTOR 3D — esfera-constelação (nós esparsos + arestas
        seletivas) via Three.js; fallback Canvas2D se WebGL
        indisponível.
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
    var cfg = TIER[tier];

    /* ============================================================
       REDE DE CONSTELAÇÃO — poucos nós, poucas conexões, muito
       espaço vazio. Os nós ficam numa casca esférica (amostragem em
       espiral de Fibonacci, com uma leve desordem para não parecer
       uma malha geodésica perfeita) e as arestas ligam só os
       vizinhos mais próximos, dentro de um orçamento pequeno —
       exatamente como uma constelação, e não uma bola de wireframe.
       ============================================================ */
    var nodeCount = cfg.nodeCount;
    var GOLDEN = Math.PI * (3 - Math.sqrt(5));
    var vTarget = []; // posição final de cada nó (Vector3), na casca da esfera
    for (var ni = 0; ni < nodeCount; ni++) {
      var yN = 1 - (ni / (nodeCount - 1)) * 2; // 1 (topo) → -1 (base)
      var rN = Math.sqrt(Math.max(0, 1 - yN * yN));
      var thN = GOLDEN * ni;
      var jitter = 0.05; // leve desordem — não é uma malha perfeita
      var vx = (Math.cos(thN) * rN) + (Math.random() - 0.5) * jitter;
      var vy = yN + (Math.random() - 0.5) * jitter;
      var vz = (Math.sin(thN) * rN) + (Math.random() - 0.5) * jitter;
      var vlen = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      vTarget.push(new THREE.Vector3((vx / vlen) * radius, (vy / vlen) * radius, (vz / vlen) * radius));
    }

    // topologia esparsa: cada nó liga só aos ~2 vizinhos mais próximos, com um
    // orçamento total de arestas e um grau máximo por nó — sobra bastante
    // superfície sem nenhuma conexão, de propósito (menos é mais).
    var edgeIndexPairs = [];
    (function buildSparseEdges() {
      var maxDegree = cfg.maxDegree;
      var degree = new Int32Array(nodeCount);
      var candidates = [];
      for (var a = 0; a < nodeCount; a++) {
        var dists = [];
        for (var b = 0; b < nodeCount; b++) {
          if (a === b) continue;
          dists.push({ b: b, d: vTarget[a].distanceToSquared(vTarget[b]) });
        }
        dists.sort(function (p, q) { return p.d - q.d; });
        var take = 2 + (Math.random() < 0.3 ? 1 : 0); // maioria com 2 vizinhos, alguns com 3
        for (var k = 0; k < take && k < dists.length; k++) {
          var bb = dists[k].b;
          var ek = a < bb ? a + '-' + bb : bb + '-' + a;
          candidates.push({ key: ek, ia: Math.min(a, bb), ib: Math.max(a, bb), d: dists[k].d });
        }
      }
      candidates.sort(function (p, q) { return p.d - q.d; });
      var seen = {};
      for (var c = 0; c < candidates.length && edgeIndexPairs.length / 2 < cfg.edgeBudget; c++) {
        var cd = candidates[c];
        if (seen[cd.key]) continue;
        if (degree[cd.ia] >= maxDegree || degree[cd.ib] >= maxDegree) continue;
        // descarta uma fração das candidatas mesmo quando cabem — deixa regiões
        // inteiras sem nenhuma linha, de propósito (itens 1 e 8 do briefing)
        if (Math.random() < 0.18) continue;
        seen[cd.key] = true;
        degree[cd.ia]++; degree[cd.ib]++;
        edgeIndexPairs.push(cd.ia, cd.ib);
      }
    })();
    var edgeCount = edgeIndexPairs.length / 2;

    // posição inicial ("poeira estelar"): pequenos aglomerados espalhados no
    // espaço, não uma nuvem única e homogênea — alguns grupos ficam acima,
    // outros abaixo, alguns de lado, cada um com sua própria deriva.
    var clusterN = 7;
    var clusters = [];
    for (var cl = 0; cl < clusterN; cl++) {
      clusters.push({
        x: (Math.random() - 0.5) * radius * 10,
        y: (Math.random() - 0.5) * radius * 8.5,
        z: (Math.random() - 0.5) * radius * 10 - radius * 1.2
      });
    }

    var nodeStart = new Float32Array(nodeCount * 3);
    var nodeDelay = new Float32Array(nodeCount);
    var nodeSpin = new Float32Array(nodeCount * 3);
    var nodeDriftSign = new Float32Array(nodeCount);
    for (var nv = 0; nv < nodeCount; nv++) {
      var c = clusters[nv % clusterN];
      nodeStart[nv * 3] = c.x + (Math.random() - 0.5) * radius * 2.6;
      nodeStart[nv * 3 + 1] = c.y + (Math.random() - 0.5) * radius * 2.6;
      nodeStart[nv * 3 + 2] = c.z + (Math.random() - 0.5) * radius * 2.6;

      // formação de baixo para cima: nós cujo alvo é mais baixo recebem um
      // atraso menor (chegam primeiro); cada um ainda tem uma variação própria
      // para não parecer um bloco sincronizado.
      var normY = (vTarget[nv].y + radius) / (2 * radius); // 0 = base, 1 = topo
      var d = 0.14 + normY * 0.56 + (Math.random() - 0.5) * 0.14;
      nodeDelay[nv] = Math.max(0.05, Math.min(0.86, d));

      nodeSpin[nv * 3] = (Math.random() - 0.5) * 2.2;
      nodeSpin[nv * 3 + 1] = (Math.random() - 0.5) * 2.2;
      nodeSpin[nv * 3 + 2] = (Math.random() - 0.5) * 2.2;
      nodeDriftSign[nv] = Math.random() < 0.5 ? -1 : 1; // algumas partículas sobem, outras descem
    }
    var nodeCurrent = nodeStart.slice();
    var nodeFacing = new Float32Array(nodeCount);
    var nodeArriveT = new Float32Array(nodeCount); // instante (em globalT) em que o nó "chega"
    for (var na = 0; na < nodeCount; na++) nodeArriveT[na] = nodeDelay[na] + 0.82 * (1 - nodeDelay[na]);

    var _facingV = new THREE.Vector3();

    function easeOutBack(t) {
      var c1 = 1.4, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    /* ---- Arestas: nascem como constelação — só depois que os DOIS nós já
       chegaram, e mesmo assim crescem de um ponto até o outro (não aparecem
       prontas), com um pequeno atraso extra por aresta. ---- */
    var edgeReadyT = new Float32Array(edgeCount);
    var edgeGrowDur = new Float32Array(edgeCount);
    for (var eg = 0; eg < edgeCount; eg++) {
      var eia = edgeIndexPairs[eg * 2], eib = edgeIndexPairs[eg * 2 + 1];
      edgeReadyT[eg] = Math.max(nodeArriveT[eia], nodeArriveT[eib]) + Math.random() * 0.08;
      edgeGrowDur[eg] = 0.05 + Math.random() * 0.09;
    }

    var assembly = 0;
    var clockT = 0; // tempo real acumulado — só para a "respiração" sutil dos nós

    function updateAssembly(globalT, dtClock) {
      assembly = globalT;
      clockT += dtClock || 0;
      var nColor = nodesGeo.attributes.color.array;
      var nSize = nodesGeo.attributes.aSize.array;
      var nAlpha = nodesGeo.attributes.aAlpha.array;

      for (var i = 0; i < nodeCount; i++) {
        var local = (globalT - nodeDelay[i]) / (1 - nodeDelay[i]);
        var arrived = local > 0;
        if (!arrived) {
          // poeira: ainda solta, com deriva orgânica — algumas partículas sobem,
          // outras descem, cada uma na sua própria profundidade
          var drift = Math.min(1, globalT / Math.max(0.02, nodeDelay[i]));
          nodeCurrent[i * 3] = nodeStart[i * 3] + Math.sin(clockT * 0.9 + nodeSpin[i * 3]) * 0.18;
          nodeCurrent[i * 3 + 1] = nodeStart[i * 3 + 1] + nodeDriftSign[i] * drift * 0.9 + Math.sin(clockT * 0.7 + nodeSpin[i * 3 + 1]) * 0.16;
          nodeCurrent[i * 3 + 2] = nodeStart[i * 3 + 2] + Math.sin(clockT * 0.8 + nodeSpin[i * 3 + 2]) * 0.18;
        } else {
          local = Math.min(1, local);
          var e = easeOutBack(local);
          nodeCurrent[i * 3] = nodeStart[i * 3] + (vTarget[i].x - nodeStart[i * 3]) * e;
          nodeCurrent[i * 3 + 1] = nodeStart[i * 3 + 1] + (vTarget[i].y - nodeStart[i * 3 + 1]) * e;
          nodeCurrent[i * 3 + 2] = nodeStart[i * 3 + 2] + (vTarget[i].z - nodeStart[i * 3 + 2]) * e;
        }

        // profundidade 3D real: usa a rotação atual do mundo pra saber o quanto
        // esse nó está de frente pra câmera, e disso deriva tamanho, brilho e
        // opacidade — é isso que faz a esfera parecer volumétrica mesmo parada.
        _facingV.set(nodeCurrent[i * 3], nodeCurrent[i * 3 + 1], nodeCurrent[i * 3 + 2]).applyQuaternion(world.quaternion);
        var facing = Math.max(0, Math.min(1, (_facingV.z / (radius * 1.15) + 1) * 0.5));
        nodeFacing[i] = facing;

        var bright = 0.28 + facing * 0.82;
        nColor[i * 3] = 0.525 * bright;
        nColor[i * 3 + 1] = 0.937 * bright;
        nColor[i * 3 + 2] = 0.675 * bright;

        var breathe = arrived ? (1 + Math.sin(clockT * 1.6 + nodeSpin[i * 3]) * 0.06) : 1;
        if (!arrived) {
          nSize[i] = 0.55 * breathe; // especks de poeira: pequenos e discretos
          nAlpha[i] = 0.35;
        } else {
          nSize[i] = (0.85 + facing * 1.05) * breathe; // perto = maior, longe = menor
          nAlpha[i] = 0.4 + facing * 0.6; // perto = mais opaco/brilhante, longe = mais transparente
        }
      }
      nodesGeo.attributes.position.needsUpdate = true;
      nodesGeo.attributes.color.needsUpdate = true;
      nodesGeo.attributes.aSize.needsUpdate = true;
      nodesGeo.attributes.aAlpha.needsUpdate = true;

      var eArr = edgesGeo.attributes.position.array;
      var eColor = edgesGeo.attributes.color.array;
      for (var j = 0; j < edgeCount; j++) {
        var ia2 = edgeIndexPairs[j * 2], ib2 = edgeIndexPairs[j * 2 + 1];
        var growT = (globalT - edgeReadyT[j]) / edgeGrowDur[j];
        var ax = nodeCurrent[ia2 * 3], ay = nodeCurrent[ia2 * 3 + 1], az = nodeCurrent[ia2 * 3 + 2];
        if (growT <= 0) {
          // ainda não nasceu — colapsada num ponto, invisível
          eArr[j * 6] = eArr[j * 6 + 3] = ax;
          eArr[j * 6 + 1] = eArr[j * 6 + 4] = ay;
          eArr[j * 6 + 2] = eArr[j * 6 + 5] = az;
          eColor[j * 6] = eColor[j * 6 + 1] = eColor[j * 6 + 2] = 0;
          eColor[j * 6 + 3] = eColor[j * 6 + 4] = eColor[j * 6 + 5] = 0;
          continue;
        }
        growT = Math.min(1, growT);
        var bx = nodeCurrent[ib2 * 3], by = nodeCurrent[ib2 * 3 + 1], bz = nodeCurrent[ib2 * 3 + 2];
        // a linha nasce de um ponto e cresce até o outro — não aparece pronta
        var gx = ax + (bx - ax) * growT, gy = ay + (by - ay) * growT, gz = az + (bz - az) * growT;
        eArr[j * 6] = ax; eArr[j * 6 + 1] = ay; eArr[j * 6 + 2] = az;
        eArr[j * 6 + 3] = gx; eArr[j * 6 + 4] = gy; eArr[j * 6 + 5] = gz;
        var fade = 0.3 + growT * 0.7;
        var ba = (0.14 + nodeFacing[ia2] * 0.5) * fade, bb = (0.14 + nodeFacing[ib2] * 0.5) * fade;
        eColor[j * 6] = 0.133 * ba; eColor[j * 6 + 1] = 0.773 * ba; eColor[j * 6 + 2] = 0.369 * ba;
        eColor[j * 6 + 3] = 0.133 * bb; eColor[j * 6 + 4] = 0.773 * bb; eColor[j * 6 + 5] = 0.369 * bb;
      }
      edgesGeo.attributes.position.needsUpdate = true;
      edgesGeo.attributes.color.needsUpdate = true;
    }

    /* Malha de arestas — poucas, finas e discretas, redesenhadas a cada quadro
       a partir da posição/estágio de crescimento atual. Cor por vértice (não
       sólida) para carregar a atenuação de profundidade e o fade de nascimento. */
    var edgesGeo = new THREE.BufferGeometry();
    edgesGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, edgeCount) * 6), 3));
    edgesGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Math.max(1, edgeCount) * 6), 3));
    var edgesMat = new THREE.LineBasicMaterial({
      transparent: true, opacity: 0, vertexColors: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var network = new THREE.LineSegments(edgesGeo, edgesMat);
    world.add(network);

    /* Nós — pequenos, luminosos, com tamanho e opacidade por vértice via
       shader próprio: é isso que garante que o que está longe da câmera
       fique visivelmente menor/mais apagado do que o que está perto. */
    var nodesGeo = new THREE.BufferGeometry();
    nodesGeo.setAttribute('position', new THREE.BufferAttribute(nodeCurrent, 3));
    nodesGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nodeCount * 3), 3));
    nodesGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(nodeCount), 1));
    nodesGeo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(nodeCount), 1));
    var nodesMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uBase: { value: cfg.dotSize }
      },
      vertexShader: [
        'attribute float aSize;',
        'attribute float aAlpha;',
        'varying vec3 vColor;',
        'varying float vAlpha;',
        'uniform float uPixelRatio;',
        'uniform float uBase;',
        'void main() {',
        '  vColor = color;',
        '  vAlpha = aAlpha;',
        '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = clamp(aSize * uBase * uPixelRatio * (5.5 / -mvPosition.z), 1.4, 16.0);',
        '  gl_Position = projectionMatrix * mvPosition;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor;',
        'varying float vAlpha;',
        'uniform float uOpacity;',
        'void main() {',
        '  vec2 uv = gl_PointCoord - vec2(0.5);',
        '  float d = length(uv);',
        '  float a = smoothstep(0.5, 0.05, d) * vAlpha * uOpacity;',
        '  if (a < 0.015) discard;',
        '  gl_FragColor = vec4(vColor, a);',
        '}'
      ].join('\n')
    });
    var nodes = new THREE.Points(nodesGeo, nodesMat);
    world.add(nodes);
    updateAssembly(0, 0);

    /* Halo finíssimo — só um leve contorno de luz, não uma "atmosfera" cheia */
    var haloGeo = new THREE.SphereGeometry(radius * 1.05, 20, 20);
    var haloMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0, side: THREE.BackSide });
    var halo = new THREE.Mesh(haloGeo, haloMat);
    world.add(halo);

    /* ---- Pulsos de energia viajando pelas arestas — poucos e muito discretos ---- */
    var travelerCount = Math.max(1, Math.min(edgeCount, cfg.orbitDots));
    var travelerEdge = new Int32Array(travelerCount);
    var travelerPhase = new Float32Array(travelerCount);
    var travelerSpeed = new Float32Array(travelerCount);
    for (var t = 0; t < travelerCount; t++) {
      travelerEdge[t] = Math.floor(Math.random() * Math.max(1, edgeCount));
      travelerPhase[t] = Math.random();
      travelerSpeed[t] = 0.2 + Math.random() * 0.3;
    }
    var travelerGeo = new THREE.BufferGeometry();
    var travelerPos = new Float32Array(travelerCount * 3);
    travelerGeo.setAttribute('position', new THREE.BufferAttribute(travelerPos, 3));
    var travelerMat = new THREE.PointsMaterial({
      color: 0xeafff1, size: 0.05, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    var travelers = new THREE.Points(travelerGeo, travelerMat);
    world.add(travelers);

    function updateTravelers(dt) {
      if (edgeCount === 0) return;
      var arr = travelerGeo.attributes.position.array;
      var eArr = edgesGeo.attributes.position.array;
      for (var i = 0; i < travelerCount; i++) {
        travelerPhase[i] += dt * travelerSpeed[i];
        if (travelerPhase[i] > 1) {
          travelerPhase[i] = 0;
          travelerEdge[i] = Math.floor(Math.random() * edgeCount);
        }
        var e = travelerEdge[i] * 6;
        var ph = travelerPhase[i];
        arr[i * 3] = eArr[e] + (eArr[e + 3] - eArr[e]) * ph;
        arr[i * 3 + 1] = eArr[e + 1] + (eArr[e + 4] - eArr[e + 1]) * ph;
        arr[i * 3 + 2] = eArr[e + 2] + (eArr[e + 5] - eArr[e + 2]) * ph;
      }
      travelerGeo.attributes.position.needsUpdate = true;
    }

    /* ---- Poeira de fundo: campo estelar em múltiplas profundidades, convergindo
       para uma casca ampla ao redor da rede (decorativo, nunca preenche a esfera) ---- */
    var fieldCount = cfg.particles;
    var fieldGeo = new THREE.BufferGeometry();
    var fieldStart = new Float32Array(fieldCount * 3);
    var fieldTarget = new Float32Array(fieldCount * 3);
    for (var p = 0; p < fieldCount; p++) {
      var yF = 1 - (p / (fieldCount - 1)) * 2;
      var rF = Math.sqrt(Math.max(0, 1 - yF * yF));
      var thF = Math.PI * (3 - Math.sqrt(5)) * p;
      var shell = radius * (1.15 + Math.random() * 0.9);
      fieldTarget[p * 3] = Math.cos(thF) * rF * shell;
      fieldTarget[p * 3 + 1] = yF * shell;
      fieldTarget[p * 3 + 2] = Math.sin(thF) * rF * shell;

      fieldStart[p * 3] = (Math.random() - 0.5) * 60;
      fieldStart[p * 3 + 1] = (Math.random() - 0.5) * 60;
      fieldStart[p * 3 + 2] = (Math.random() - 0.5) * 60 - 10;
    }
    fieldGeo.setAttribute('position', new THREE.BufferAttribute(fieldStart.slice(), 3));
    var fieldMat = new THREE.PointsMaterial({ color: 0x86efac, size: cfg.dotSize / 20, transparent: true, opacity: 0.5, sizeAttenuation: true });
    var field = new THREE.Points(fieldGeo, fieldMat);
    scene.add(field);

    /* ---- Arraste (mouse/touch) — só ativo depois que a rede "nasce" ---- */
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
      setConfig: function (newCfg) {
        if (newCfg && fieldMat) fieldMat.size = newCfg.dotSize / 20;
      },
      setDragEnabled: function (v) { drag.enabled = v; },
      /* progress: 0..1 dentro da cena atual; sceneName define o comportamento */
      update: function (sceneName, progress, dt) {
        // rotação: viva na descoberta/ativação, MUITO lenta na formação e no
        // estado final — a estrutura precisa continuar legível e "viva", nunca
        // girando rápido.
        var spin = sceneName === 'discovery' ? 0.0009
          : sceneName === 'activation' ? 0.0022
          : sceneName === 'formation' ? 0.00015
          : 0.00008;
        if (!drag.active) {
          world.rotation.y += spin + drag.velX;
          world.rotation.x += drag.velY;
          drag.velX *= 0.94; drag.velY *= 0.94;
        }

        updateTravelers(dt);

        // câmera: aproxima suavemente ao longo de toda a sequência
        var camZ = cameraDistanceFor(sceneName);
        camera.position.z += (camZ - camera.position.z) * Math.min(1, dt * 1.6);
        camera.position.y = Math.sin(progress * Math.PI) * (sceneName === 'formation' || sceneName === 'transition' ? 0.08 : 0.35);
        camera.lookAt(0, 0, 0);

        // montagem da esfera: poeira → posição geodésica, de baixo para cima.
        // Roda ao longo da descoberta e termina na primeira metade da
        // ativação, para que a rede já esteja pronta quando os dados
        // começam a circular pelas arestas.
        var assemblyGlobal = sceneName === 'discovery' ? progress * 0.7
          : sceneName === 'activation' ? 0.7 + Math.min(1, progress / 0.45) * 0.3
          : 1;
        updateAssembly(assemblyGlobal, dt);

        if (sceneName === 'discovery') {
          var posAttr = fieldGeo.attributes.position;
          var arr = posAttr.array;
          var ease = 1 - Math.pow(1 - progress, 3);
          for (var i2 = 0; i2 < fieldCount; i2++) {
            arr[i2 * 3] = fieldStart[i2 * 3] + (fieldTarget[i2 * 3] - fieldStart[i2 * 3]) * ease;
            arr[i2 * 3 + 1] = fieldStart[i2 * 3 + 1] + (fieldTarget[i2 * 3 + 1] - fieldStart[i2 * 3 + 1]) * ease;
            arr[i2 * 3 + 2] = fieldStart[i2 * 3 + 2] + (fieldTarget[i2 * 3 + 2] - fieldStart[i2 * 3 + 2]) * ease;
          }
          posAttr.needsUpdate = true;
          edgesMat.opacity = Math.min(0.45, progress * 1.0);
          nodesMat.uniforms.uOpacity.value = Math.min(0.9, progress * 1.2);
          haloMat.opacity = 0;
          travelerMat.opacity = 0;
          fieldMat.opacity = 0.5;
        }

        if (sceneName === 'activation') {
          // a rede acorda: nós e linhas ganham brilho pleno, dados começam a
          // circular — mas sempre discreto, nunca uma esfera inteira brilhando
          edgesMat.opacity = Math.min(0.8, 0.45 + progress * 0.35);
          nodesMat.uniforms.uOpacity.value = 1;
          haloMat.opacity = Math.min(0.1, progress * 0.14);
          travelerMat.opacity = Math.min(0.6, progress * 0.8);
          fieldMat.opacity = Math.max(0.12, 0.5 - progress * 0.3);
          drag.enabled = true;
        }

        if (sceneName === 'formation') {
          var posAttr2 = fieldGeo.attributes.position;
          var arr2 = posAttr2.array;
          var collapse = Math.pow(progress, 1.6);
          for (var i3 = 0; i3 < fieldCount; i3++) {
            arr2[i3 * 3] = fieldTarget[i3 * 3] * (1 - collapse * 0.85);
            arr2[i3 * 3 + 1] = fieldTarget[i3 * 3 + 1] * (1 - collapse * 0.85);
            arr2[i3 * 3 + 2] = fieldTarget[i3 * 3 + 2] * (1 - collapse * 0.85);
          }
          posAttr2.needsUpdate = true;
          fieldMat.opacity = Math.max(0, 0.2 - progress * 0.22);
          edgesMat.opacity = Math.min(0.85, 0.8 + progress * 0.05);
          nodesMat.uniforms.uOpacity.value = 1;
          travelerMat.opacity = Math.max(0.3, 0.6 - progress * 0.2);
          haloMat.opacity = Math.min(0.14, 0.1 + progress * 0.08);
        }

        if (sceneName === 'transition') {
          fieldMat.opacity = 0;
          edgesMat.opacity = Math.max(0, 0.85 - progress * 1.0);
          nodesMat.uniforms.uOpacity.value = Math.max(0, 1 - progress);
          travelerMat.opacity = Math.max(0, 0.3 - progress * 0.8);
          haloMat.opacity = Math.max(0, 0.14 - progress * 0.25);
        }
      },
      render: function () { renderer.render(scene, camera); },
      dispose: function () {
        canvas.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', up);
        [edgesGeo, nodesGeo, haloGeo, travelerGeo, fieldGeo].forEach(function (g) { g.dispose(); });
        [edgesMat, nodesMat, haloMat, travelerMat, fieldMat].forEach(function (m) { m.dispose(); });
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
