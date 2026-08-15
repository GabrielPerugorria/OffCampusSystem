/* ============================================================
   PLANET EARTH 3D — Premium Global Intelligence Globe v5 (Three.js WebGL)
   - Fronteiras reais de todos os países (Natural Earth, via world-atlas/topojson)
   - Contorno oficial do Brasil extraído da mesma base cartográfica (sem pontos manuais)
   - Mapa de relevo (bump) e máscara oceânica (specular) para profundidade real
   - Destaque neon elegante, orgânico e exclusivo para o Brasil
   - Rotação contínua, desaceleração suave no hover e inércia natural no arraste
   ============================================================ */
(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.error('Three.js não foi carregado.');
    return;
  }

  const canvas = document.getElementById('globeCanvas');
  if (!canvas) return;
  const container = document.getElementById('globeContainer');
  const statsList = document.getElementById('globeStatsList');

  /* Fontes de dados cartográficos reais (carregadas em runtime, com fallback local) */
  const WORLD_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
  const EARTH_COLOR_URL = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg';
  const EARTH_BUMP_URL  = 'https://unpkg.com/three-globe/example/img/earth-topology.png';
  const EARTH_SPEC_URL  = 'https://unpkg.com/three-globe/example/img/earth-water.png';
  const BRAZIL_ISO_NUMERIC = '076';

  const COLORS = {
    brandDark: 0x04110a,
    brandPrimary: 0x22c55e,
    brandBright: 0x4ade80,
    brandSoft: 0x86efac,
    brandDim: 0x15803d,
    white: 0xffffff
  };

  /* ── 27 Estados Brasileiros ── */
  const STATES = [
    { state:'Amazonas',         abbr:'AM', capital:'Manaus',         lat:-3.119,  lon:-60.022, events:12 },
    { state:'Pará',             abbr:'PA', capital:'Belém',          lat:-1.456,  lon:-48.502, events:18 },
    { state:'Acre',             abbr:'AC', capital:'Rio Branco',     lat:-9.975,  lon:-67.810, events:5  },
    { state:'Rondônia',         abbr:'RO', capital:'Porto Velho',    lat:-8.761,  lon:-63.900, events:7  },
    { state:'Roraima',          abbr:'RR', capital:'Boa Vista',      lat:2.820,   lon:-60.671, events:4  },
    { state:'Amapá',            abbr:'AP', capital:'Macapá',         lat:0.035,   lon:-51.069, events:3  },
    { state:'Tocantins',        abbr:'TO', capital:'Palmas',         lat:-10.169, lon:-48.332, events:8  },
    { state:'Maranhão',         abbr:'MA', capital:'São Luís',       lat:-2.530,  lon:-44.283, events:14 },
    { state:'Piauí',            abbr:'PI', capital:'Teresina',       lat:-5.089,  lon:-42.802, events:9  },
    { state:'Ceará',            abbr:'CE', capital:'Fortaleza',      lat:-3.717,  lon:-38.543, events:28 },
    { state:'Rio G. do Norte',  abbr:'RN', capital:'Natal',          lat:-5.795,  lon:-35.211, events:15 },
    { state:'Paraíba',          abbr:'PB', capital:'João Pessoa',    lat:-7.120,  lon:-34.845, events:11 },
    { state:'Pernambuco',       abbr:'PE', capital:'Recife',         lat:-8.048,  lon:-34.877, events:32 },
    { state:'Alagoas',          abbr:'AL', capital:'Maceió',         lat:-9.666,  lon:-35.735, events:10 },
    { state:'Sergipe',          abbr:'SE', capital:'Aracaju',        lat:-10.909, lon:-37.068, events:8  },
    { state:'Bahia',            abbr:'BA', capital:'Salvador',       lat:-12.971, lon:-38.512, events:35 },
    { state:'Goiás',            abbr:'GO', capital:'Goiânia',        lat:-16.687, lon:-49.265, events:20 },
    { state:'Mato Grosso',      abbr:'MT', capital:'Cuiabá',         lat:-15.601, lon:-56.098, events:13 },
    { state:'Mato G. do Sul',   abbr:'MS', capital:'Campo Grande',   lat:-20.470, lon:-54.620, events:11 },
    { state:'Distrito Federal', abbr:'DF', capital:'Brasília',       lat:-15.798, lon:-47.892, events:42 },
    { state:'São Paulo',        abbr:'SP', capital:'São Paulo',      lat:-23.551, lon:-46.633, events:85 },
    { state:'Rio de Janeiro',   abbr:'RJ', capital:'Rio de Janeiro', lat:-22.907, lon:-43.173, events:65 },
    { state:'Minas Gerais',     abbr:'MG', capital:'Belo Horizonte', lat:-19.919, lon:-43.939, events:38 },
    { state:'Espírito Santo',   abbr:'ES', capital:'Vitória',        lat:-20.316, lon:-40.313, events:14 },
    { state:'Paraná',           abbr:'PR', capital:'Curitiba',       lat:-25.428, lon:-49.273, events:30 },
    { state:'Santa Catarina',   abbr:'SC', capital:'Florianópolis',  lat:-27.595, lon:-48.548, events:25 },
    { state:'Rio G. do Sul',    abbr:'RS', capital:'Porto Alegre',   lat:-30.035, lon:-51.218, events:38 }
  ];

  const DEG = Math.PI / 180;
  const GLOBE_RADIUS = 5;

  /* Contorno do Brasil — fallback local (usado até a fronteira oficial carregar) */
  const BRAZIL_GEO_FALLBACK = [
    [5.27,-51.0],[4.4,-51.1],[4.3,-50.3],[2.8,-50.8],[2.2,-50.0],
    [1.8,-49.9],[1.2,-49.9],[0.7,-50.0],[0.4,-49.6],[-0.1,-49.5],
    [-1.0,-48.5],[-1.7,-48.8],[-2.5,-48.6],[-2.8,-48.5],[-2.6,-44.3],
    [-2.9,-41.5],[-3.0,-39.0],[-3.7,-38.5],[-5.0,-36.7],[-5.5,-35.5],
    [-6.5,-35.0],[-7.1,-34.8],[-8.3,-35.0],[-9.4,-35.5],[-10.5,-36.4],
    [-11.5,-37.4],[-12.9,-38.4],[-13.4,-38.9],[-14.8,-39.1],[-15.4,-39.0],
    [-16.0,-39.2],[-17.8,-39.4],[-18.3,-39.7],[-19.9,-40.0],[-20.3,-40.3],
    [-22.0,-41.0],[-22.9,-41.9],[-23.0,-43.2],[-23.4,-44.7],[-23.8,-45.4],
    [-24.0,-46.1],[-25.3,-48.0],[-25.5,-48.5],[-26.3,-48.6],[-27.6,-48.6],
    [-28.6,-49.0],[-29.3,-49.7],[-29.4,-50.3],[-30.0,-51.0],[-31.0,-51.0],
    [-32.1,-52.0],[-33.0,-52.4],[-33.75,-53.4],[-33.5,-53.5],[-33.2,-54.0],
    [-32.0,-55.1],[-31.0,-56.0],[-30.0,-57.6],[-29.7,-57.5],[-28.7,-56.0],
    [-28.2,-55.5],[-27.5,-55.8],[-27.0,-55.4],[-26.0,-54.6],[-25.3,-54.6],
    [-24.0,-54.6],[-23.4,-55.4],[-22.3,-56.0],[-22.0,-57.8],[-20.5,-57.9],
    [-18.3,-57.6],[-17.8,-57.8],[-16.5,-58.4],[-16.0,-60.0],[-14.0,-60.0],
    [-13.5,-61.8],[-12.0,-63.0],[-11.0,-62.5],[-10.5,-65.3],[-10.0,-66.0],
    [-9.5,-66.0],[-9.0,-67.1],[-8.0,-69.5],[-7.5,-72.9],[-5.0,-70.2],
    [-4.2,-69.9],[-2.5,-69.9],[-1.7,-69.4],[-1.0,-69.6],[0.0,-69.2],
    [1.0,-68.0],[1.2,-67.1],[2.0,-66.9],[2.0,-64.0],[3.4,-64.0],
    [3.8,-63.4],[4.0,-63.0],[3.9,-61.0],[3.6,-60.0],[5.0,-60.5],
    [5.27,-60.0],[4.5,-58.0],[4.5,-56.1],[3.0,-55.0],[2.5,-54.6],
    [2.2,-54.0],[2.3,-53.0],[2.8,-52.9],[3.5,-52.0],[5.27,-51.0]
  ];

  /* Ponto de verdade atual do contorno do Brasil: começa no fallback e é
     substituído pelo polígono oficial assim que os dados reais carregam. */
  let BRAZIL_GEO = BRAZIL_GEO_FALLBACK;

  function latLonToVector3(lat, lon, r) {
    const phi = (90 - lat) * DEG;
    const theta = (lon + 180) * DEG;
    return new THREE.Vector3(
      -r * Math.cos(theta) * Math.sin(phi),
       r * Math.cos(phi),
       r * Math.sin(theta) * Math.sin(phi)
    );
  }

  /* ── CENA ── */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 18);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  /* ── ILUMINAÇÃO ── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.position.set(-10, 8, 12);
  scene.add(sun);

  /* ──────────────────────────────────────────────
     TEXTURA DA TERRA
     Estratégia: Usar a textura earth-dark.jpg SEM filtros destrutivos.
     A imagem mostra luzes urbanas em tons quentes (amarelo/laranja)
     sobre continentes escuros, com oceanos totalmente pretos.
     Isso já distingue perfeitamente terra de água.
     O Brasil recebe apenas um overlay translúcido verde + borda neon sutil.
  ────────────────────────────────────────────── */
  let earthTexture;

  // Fallback procedural elegante (caso CDN falhe)
  function createFallbackTexture() {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1024;
    const g = c.getContext('2d');

    // Oceanos - azul escuro profundo
    g.fillStyle = '#050d1a';
    g.fillRect(0, 0, c.width, c.height);

    function xy(lat, lon) {
      return { x: ((lon + 180) / 360) * c.width, y: ((90 - lat) / 180) * c.height };
    }

    // Continentes detalhados
    const continents = [
      // América do Norte
      [[72,-128],[70,-140],[68,-165],[65,-168],[60,-162],[58,-152],[55,-133],[48,-122],[38,-122],[32,-117],[25,-110],[19,-105],[15,-92],[10,-84],[8,-77],[10,-75],[18,-78],[25,-78],[25,-80],[30,-82],[35,-76],[40,-74],[41,-70],[43,-66],[45,-62],[47,-64],[50,-57],[55,-58],[60,-64],[65,-63],[68,-75],[72,-80],[73,-95],[72,-128]],
      // América Central
      [[10,-84],[15,-92],[19,-88],[21,-87],[18,-88],[15,-84],[10,-84]],
      // América do Sul (exceto Brasil será pintado separado)
      [[12,-72],[8,-77],[4,-78],[0,-80],[-5,-81],[-10,-78],[-15,-75],[-18,-70],[-23,-70],[-27,-71],[-33,-71.5],[-42,-72],[-46,-75],[-53,-71],[-55,-68.5],[-54,-65],[-52,-68],[-48,-66],[-42,-64],[-39,-62],[-35,-57],[-33,-53],[-30,-51],[-28,-49],[-25,-48],[-23,-46],[-22,-41],[-13,-39],[-8,-35],[-5,-35],[-3,-38],[-1,-49],[2,-50],[5,-51],[5,-60],[4,-58],[3,-55],[2,-54],[5,-52],[8,-60],[12,-72]],
      // Europa
      [[36,-9],[37,-6],[38,-1],[43,3],[44,8],[48,2],[51,4],[53,7],[55,8],[57,10],[60,5],[62,6],[65,12],[68,16],[70,20],[71,28],[70,30],[65,28],[62,30],[60,38],[57,40],[55,38],[54,28],[52,21],[50,20],[48,17],[47,16],[46,14],[44,12],[42,15],[41,18],[40,26],[38,24],[36,28],[36,22],[40,20],[42,12],[43,10],[42,3],[38,-1],[37,-5],[36,-9]],
      // África
      [[37,-6],[37,10],[35,11],[33,10],[31,10],[31,30],[30,33],[25,35],[20,38],[15,42],[11,51],[8,50],[5,42],[2,42],[-1,42],[-4,40],[-10,40],[-15,40],[-20,35],[-25,33],[-30,30],[-34,26],[-34,18],[-30,17],[-22,14],[-17,12],[-12,14],[-8,13],[-5,12],[0,10],[5,2],[5,-2],[8,-7],[10,-8],[13,-12],[15,-17],[18,-16],[21,-17],[25,-15],[28,-13],[30,-10],[35,-6],[37,-6]],
      // Ásia
      [[42,29],[43,40],[42,45],[40,44],[37,45],[33,44],[30,48],[28,48],[25,51],[22,56],[20,58],[18,57],[15,52],[11,51],[8,50],[2,45],[0,43],[-2,40],[-6,35],[-8,37],[-8,105],[-6,106],[-5,105],[-2,100],[1,104],[5,100],[7,100],[10,108],[18,107],[18,121],[22,120],[25,122],[30,122],[35,128],[38,132],[40,132],[42,132],[44,135],[46,143],[50,143],[52,140],[55,137],[60,143],[62,160],[64,175],[66,175],[68,170],[70,162],[71,160],[68,150],[65,140],[60,130],[56,120],[54,90],[55,73],[55,68],[52,58],[50,55],[47,52],[45,50],[43,44],[42,29]],
      // Austrália
      [[-12,130],[-12,136],[-14,136],[-14,141],[-16,146],[-20,149],[-24,152],[-28,153],[-32,152],[-35,150],[-38,148],[-38,141],[-35,137],[-35,135],[-32,131],[-27,125],[-23,114],[-22,114],[-20,119],[-15,124],[-12,130]],
      // Japão
      [[31,130],[33,131],[35,133],[36,136],[38,138],[40,140],[42,141],[44,142],[45,143],[44,145],[42,145],[40,141],[38,141],[36,140],[34,136],[33,133],[31,130]],
      // Reino Unido
      [[50,-5],[51,-3],[52,0],[53,1],[54,0],[55,-2],[56,-3],[58,-5],[58,-6],[57,-6],[56,-5],[55,-5],[54,-4],[53,-3],[52,-4],[51,-5],[50,-5]],
      // Irlanda
      [[52,-10],[53,-10],[54,-8],[54,-7],[53,-6],[52,-7],[51,-10],[52,-10]],
      // Nova Zelândia
      [[-34,172],[-37,174],[-39,177],[-42,174],[-44,169],[-46,168],[-45,170],[-42,172],[-38,176],[-34,172]],
      // Índia
      [[35,74],[32,78],[30,80],[28,84],[27,88],[22,89],[22,87],[21,86],[18,83],[15,80],[10,80],[8,77],[10,76],[12,77],[15,74],[18,73],[20,73],[23,70],[25,68],[27,68],[30,70],[33,70],[35,74]],
      // Indonésia
      [[5,95],[6,98],[5,105],[2,107],[0,109],[-2,106],[-5,105],[-7,106],[-8,110],[-8,115],[-6,118],[-8,120],[-8,124],[-5,126],[-3,128],[-1,131],[0,134],[-2,137],[-5,140],[-4,136],[-8,138],[-8,131],[-6,128],[-8,126],[-6,120],[-8,116],[-7,112],[-6,107],[-4,103],[-2,100],[1,104],[3,99],[5,95]],
      // Groenlândia
      [[83,-30],[82,-18],[80,-15],[78,-17],[76,18],[74,-20],[72,-25],[70,-22],[68,-30],[66,-38],[64,-44],[62,-44],[60,-44],[62,-48],[66,-50],[70,-54],[74,-56],[78,-60],[80,-52],[82,-40],[83,-30]],
      // Madagascar
      [[-12,49],[-14,48],[-16,46],[-19,44],[-21,44],[-25,44],[-24,47],[-22,49],[-18,50],[-15,50],[-12,49]],
      // Península Arábica
      [[30,35],[28,36],[25,37],[20,40],[15,43],[12,44],[14,48],[16,52],[20,56],[22,59],[25,56],[28,50],[30,48],[30,35]]
    ];

    // Desenhar continentes em verde-esmeralda escuro elegante
    g.fillStyle = '#1b4332';
    continents.forEach(poly => {
      g.beginPath();
      poly.forEach((pt, i) => {
        const p = xy(pt[0], pt[1]);
        if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
      });
      g.closePath();
      g.fill();
    });

    // Bordas costeiras em tom mais claro para dar definição
    g.strokeStyle = 'rgba(27, 67, 50, 0.5)';
    g.lineWidth = 1;
    continents.forEach(poly => {
      g.beginPath();
      poly.forEach((pt, i) => {
        const p = xy(pt[0], pt[1]);
        if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
      });
      g.closePath();
      g.stroke();
    });

    // Brasil com destaque neon sutil
    g.fillStyle = 'rgba(34, 197, 94, 0.25)';
    g.beginPath();
    BRAZIL_GEO.forEach((pt, i) => {
      const p = xy(pt[0], pt[1]);
      if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
    });
    g.closePath();
    g.fill();

    g.shadowColor = '#4ade80';
    g.shadowBlur = 12;
    g.strokeStyle = 'rgba(34, 197, 94, 0.8)';
    g.lineWidth = 2.5;
    g.stroke();
    g.shadowBlur = 0;

    return new THREE.CanvasTexture(c);
  }

  earthTexture = createFallbackTexture();

  function xyOnCanvas(c, lat, lon) {
    return { x: ((lon + 180) / 360) * c.width, y: ((90 - lat) / 180) * c.height };
  }

  // Pinta o destaque do Brasil (preenchimento translúcido + contorno neon com glow)
  // usando sempre o contorno mais preciso disponível no momento (BRAZIL_GEO).
  function paintBrazilHighlight(g, c) {
    g.save();
    g.fillStyle = 'rgba(34, 197, 94, 0.22)';
    g.beginPath();
    BRAZIL_GEO.forEach((pt, i) => {
      const p = xyOnCanvas(c, pt[0], pt[1]);
      if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
    });
    g.closePath();
    g.fill();

    g.shadowColor = '#4ade80';
    g.shadowBlur = 10;
    g.strokeStyle = 'rgba(74, 222, 128, 0.7)';
    g.lineWidth = 2;
    g.stroke();
    g.restore();
  }

  let baseEarthImage = null; // imagem-base (sem overlay do Brasil), reaproveitada para redesenhar

  // (Re)desenha a textura completa da Terra + destaque do Brasil por cima da imagem-base.
  function rebuildEarthTexture() {
    if (!baseEarthImage) return;
    const c = document.createElement('canvas');
    c.width = baseEarthImage.width;
    c.height = baseEarthImage.height;
    const g = c.getContext('2d');
    g.drawImage(baseEarthImage, 0, 0, c.width, c.height);
    paintBrazilHighlight(g, c);
    earthTexture.image = c;
    earthTexture.needsUpdate = true;
  }

  // Carrega a textura real da Terra (luzes urbanas noturnas) — já mostra todos os
  // países corretamente posicionados, sem nenhum deslocamento artificial.
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    EARTH_COLOR_URL,
    function (loaded) {
      baseEarthImage = loaded.image;
      rebuildEarthTexture();
    },
    undefined,
    function () { console.warn('Usando textura fallback procedural para a Terra.'); }
  );

  // Mapa de relevo (bump) real — dá profundidade às cadeias montanhosas e ao litoral
  let bumpTexture = null;
  textureLoader.load(EARTH_BUMP_URL, tex => {
    bumpTexture = tex;
    sphereMat.bumpMap = tex;
    sphereMat.bumpScale = 0.06;
    sphereMat.needsUpdate = true;
  }, undefined, () => {});

  // Máscara de água — separa reflexo especular do oceano (brilhante) da terra (fosca)
  textureLoader.load(EARTH_SPEC_URL, tex => {
    sphereMat.specularMap = tex;
    sphereMat.needsUpdate = true;
  }, undefined, () => {});

  /* ── ESFERA PRINCIPAL ── */
  const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96);
  const sphereMat = new THREE.MeshPhongMaterial({
    map: earthTexture,
    bumpMap: earthTexture,
    bumpScale: 0.015,
    color: 0xffffff,        // Branco puro: não distorce as cores da textura
    emissive: 0x0c1a12,     // Emissão leve verde-escura para o lado escuro não sumir por completo
    emissiveIntensity: 0.35,
    specular: 0x152820,     // Reflexo especular reduzido e discreto
    shininess: 10
  });
  const earthMesh = new THREE.Mesh(sphereGeo, sphereMat);
  globeGroup.add(earthMesh);

  /* ── BORDA 3D NEON DO BRASIL ── */
  const borderMat = new THREE.LineBasicMaterial({
    color: COLORS.brandBright, transparent: true, opacity: 0.85, linewidth: 2
  });
  let brazilBorder = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      BRAZIL_GEO.map(([lat, lon]) => latLonToVector3(lat, lon, GLOBE_RADIUS * 1.003))
    ),
    borderMat
  );
  globeGroup.add(brazilBorder);

  // Reconstrói a borda 3D do Brasil quando um contorno mais preciso estiver disponível.
  function rebuildBrazilBorder() {
    globeGroup.remove(brazilBorder);
    brazilBorder.geometry.dispose();
    brazilBorder = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        BRAZIL_GEO.map(([lat, lon]) => latLonToVector3(lat, lon, GLOBE_RADIUS * 1.003))
      ),
      borderMat
    );
    globeGroup.add(brazilBorder);
  }

  /* ── FRONTEIRAS REAIS DE TODOS OS PAÍSES ──
     Carrega dados topográficos reais (Natural Earth, simplificação 110m) para desenhar
     o contorno de cada país com precisão cartográfica, e extrai desses mesmos dados
     o polígono oficial do Brasil — eliminando qualquer posicionamento manual/artificial. */
  const countryBordersGroup = new THREE.Group();
  globeGroup.add(countryBordersGroup);
  const countryBorderMat = new THREE.LineBasicMaterial({
    color: 0x9fd8bb, transparent: true, opacity: 0.16
  });

  function largestRing(polygonOrMulti) {
    const polygons = polygonOrMulti.type === 'MultiPolygon' ? polygonOrMulti.coordinates : [polygonOrMulti.coordinates];
    let best = null;
    polygons.forEach(rings => {
      const ring = rings[0]; // anel externo de cada parte
      if (!best || ring.length > best.length) best = ring;
    });
    return best;
  }

  function drawCountryBorders(topology) {
    if (typeof topojson === 'undefined') return;
    const objectKey = topology.objects.countries ? 'countries' : Object.keys(topology.objects)[0];
    const mesh = topojson.mesh(topology, topology.objects[objectKey]);
    // mesh.coordinates: array de arcos, cada um [ [lon,lat], [lon,lat], ... ]
    mesh.coordinates.forEach(arc => {
      if (arc.length < 2) return;
      const pts = arc.map(([lon, lat]) => latLonToVector3(lat, lon, GLOBE_RADIUS * 1.001));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      countryBordersGroup.add(new THREE.Line(geo, countryBorderMat));
    });

    // Extrai o polígono oficial do Brasil da mesma base de dados usada para o mundo todo.
    const features = topojson.feature(topology, topology.objects[objectKey]).features;
    const brazilFeature = features.find(f => String(f.id) === BRAZIL_ISO_NUMERIC);
    if (brazilFeature) {
      const ring = largestRing(brazilFeature.geometry);
      if (ring && ring.length > 10) {
        BRAZIL_GEO = ring.map(([lon, lat]) => [lat, lon]);
        rebuildEarthTexture();
        rebuildBrazilBorder();
      }
    }
  }

  fetch(WORLD_ATLAS_URL)
    .then(r => r.json())
    .then(drawCountryBorders)
    .catch(() => console.warn('Não foi possível carregar as fronteiras reais — usando contorno de fallback do Brasil.'));

  /* ── MARCADORES DE CAPITAIS ── */
  const stateMeshes = [];
  const mGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 0.007, 12, 12);

  STATES.forEach((st, idx) => {
    const pos = latLonToVector3(st.lat, st.lon, GLOBE_RADIUS * 1.005);
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.brandBright, transparent: true, opacity: 0.95 });
    const m = new THREE.Mesh(mGeo, mat);
    m.position.copy(pos);
    m.userData = { stateIndex: idx, stateData: st };
    globeGroup.add(m);
    stateMeshes.push(m);
  });

  /* ── CONEXÕES DE DADOS ── */
  const connections = [
    { from: 'SP', to: 'DF' }, { from: 'SP', to: 'RJ' },
    { from: 'DF', to: 'AM' }, { from: 'DF', to: 'PE' },
    { from: 'SP', to: 'RS' }, { from: 'DF', to: 'BA' }
  ];
  const movingParticles = [];

  function getStatePos(abbr) {
    const s = STATES.find(st => st.abbr === abbr);
    return s ? latLonToVector3(s.lat, s.lon, GLOBE_RADIUS) : null;
  }

  function createArc(p1, p2) {
    const d = p1.distanceTo(p2);
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(GLOBE_RADIUS + d * 0.18);

    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    const arcGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));
    globeGroup.add(new THREE.Line(arcGeo, new THREE.LineBasicMaterial({
      color: COLORS.brandDim, transparent: true, opacity: 0.2
    })));

    for (let k = 0; k < 2; k++) {
      const pm = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS * 0.005, 8, 8),
        new THREE.MeshBasicMaterial({ color: COLORS.brandSoft, transparent: true, opacity: 0.9 })
      );
      globeGroup.add(pm);
      movingParticles.push({ mesh: pm, curve, speed: 0.004 + Math.random() * 0.004, t: (k * 0.5 + Math.random() * 0.2) % 1 });
    }
  }

  connections.forEach(c => {
    const a = getStatePos(c.from), b = getStatePos(c.to);
    if (a && b) createArc(a, b);
  });

  /* ── REDE GLOBAL DE INTELIGÊNCIA ──
     Representa a visão "cada evento gera dados, dados conectam o mundo":
     o Brasil (núcleo) conectado a hubs internacionais — não é um mapa de
     viagem, e sim uma rede de inteligência, com o mesmo tratamento visual
     das conexões internas (linhas finas + partículas fluindo). */
  const GLOBAL_CITIES = [
    { name: 'Porto Alegre',   lat: -30.035, lon: -51.218 },
    { name: 'São Paulo',      lat: -23.551, lon: -46.633 },
    { name: 'Rio de Janeiro', lat: -22.907, lon: -43.173 },
    { name: 'Nova York',      lat: 40.713,  lon: -74.006 },
    { name: 'Lisboa',         lat: 38.722,  lon: -9.139  }
  ];
  const globalCityGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 0.009, 12, 12);
  const globalCityMeshes = GLOBAL_CITIES.map(city => {
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.white, transparent: true, opacity: 0.9 });
    const m = new THREE.Mesh(globalCityGeo, mat);
    m.position.copy(latLonToVector3(city.lat, city.lon, GLOBE_RADIUS * 1.006));
    m.userData = { cityName: city.name };
    globeGroup.add(m);
    return m;
  });

  const NETWORK_HUB = GLOBAL_CITIES[1]; // São Paulo — núcleo da rede EvoTech
  GLOBAL_CITIES.forEach(city => {
    if (city === NETWORK_HUB) return;
    createArc(
      latLonToVector3(NETWORK_HUB.lat, NETWORK_HUB.lon, GLOBE_RADIUS),
      latLonToVector3(city.lat, city.lon, GLOBE_RADIUS)
    );
  });

  /* ── ANÉIS ORBITAIS E SATÉLITES ── */
  function createSatelliteModel(scale) {
    const sat = new THREE.Group();
    const s = GLOBE_RADIUS * scale;

    /* corpo central */
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(s * 1.4, s, s),
      new THREE.MeshBasicMaterial({ color: 0xd7d7d7 })
    );
    sat.add(body);

    /* núcleo emissivo (antena/sensor) */
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(s * 0.42, 8, 8),
      new THREE.MeshBasicMaterial({ color: COLORS.brandBright })
    );
    core.position.set(s * 0.9, 0, 0);
    sat.add(core);

    /* painéis solares */
    const panelMat = new THREE.MeshBasicMaterial({
      color: COLORS.brandDim, side: THREE.DoubleSide, transparent: true, opacity: 0.92
    });
    const panelGeo = new THREE.PlaneGeometry(s * 2.6, s * 1.05);
    const panelL = new THREE.Mesh(panelGeo, panelMat);
    panelL.position.set(0, 0, -s * 2.1);
    sat.add(panelL);
    const panelR = new THREE.Mesh(panelGeo, panelMat);
    panelR.position.set(0, 0, s * 2.1);
    sat.add(panelR);

    /* mastro de antena fino */
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 1.2, 5),
      new THREE.MeshBasicMaterial({ color: 0xbfbfbf })
    );
    mast.rotation.z = Math.PI / 2;
    mast.position.set(-s * 1.1, s * 0.3, 0);
    sat.add(mast);

    /* halo de brilho (sprite aditivo) para dar sensação de "luz passando" */
    const haloTex = createGlowSprite();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex, color: COLORS.brandBright, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo.scale.set(s * 6, s * 6, 1);
    sat.add(halo);

    return sat;
  }

  let _glowSpriteTex = null;
  function createGlowSprite() {
    if (_glowSpriteTex) return _glowSpriteTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, 'rgba(134,239,172,0.55)');
    g.addColorStop(1, 'rgba(134,239,172,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    _glowSpriteTex = new THREE.CanvasTexture(c);
    return _glowSpriteTex;
  }

  function createOrbit(rFactor, tiltZ, tiltX, opc, satScale) {
    const g = new THREE.Group();
    g.rotation.z = tiltZ * DEG;
    g.rotation.x = tiltX * DEG;
    globeGroup.add(g);

    const rGeo = new THREE.RingGeometry(GLOBE_RADIUS * rFactor, GLOBE_RADIUS * (rFactor + 0.005), 64);
    const rMesh = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
      color: COLORS.brandDim, side: THREE.DoubleSide, transparent: true, opacity: opc
    }));
    rMesh.rotation.x = Math.PI / 2;
    g.add(rMesh);

    const sat = createSatelliteModel(satScale || 0.02);
    g.add(sat);
    return { group: g, sat, radius: GLOBE_RADIUS * rFactor };
  }

  const orbit1 = createOrbit(1.14, 25, 15, 0.14, 0.022);
  const orbit2 = createOrbit(1.24, -35, -20, 0.12, 0.018);
  const orbit3 = createOrbit(1.36, 55, -8, 0.09, 0.026);

  /* ── FOGUETES SAINDO DA TERRA ── */
  const rockets = [];
  const ROCKET_MAX_ALT = GLOBE_RADIUS * 2.6;
  const ROCKET_LIFE_SEC = 7.5;

  function createRocketModel() {
    const g = new THREE.Group();
    const r = GLOBE_RADIUS * 0.012;

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, r * 7, 8),
      new THREE.MeshBasicMaterial({ color: 0xf5f5f5 })
    );
    body.rotation.x = Math.PI / 2;
    g.add(body);

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(r, r * 2.4, 8),
      new THREE.MeshBasicMaterial({ color: COLORS.brandBright })
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.z = r * 4.7;
    g.add(nose);

    /* chama/exaustão */
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(r * 0.85, r * 3.2, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffb020, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = -r * 5.2;
    g.add(flame);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createGlowSprite(), color: 0xffc060, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(r * 14, r * 14, 1);
    glow.position.z = -r * 6;
    g.add(glow);

    return { group: g, flame, glow };
  }

  function launchRocket() {
    const originState = STATES[Math.floor(Math.random() * STATES.length)];
    const normal = latLonToVector3(originState.lat, originState.lon, 1).normalize();
    const startPos = normal.clone().multiplyScalar(GLOBE_RADIUS * 1.001);

    const { group, flame, glow } = createRocketModel();
    group.position.copy(startPos);
    group.lookAt(normal.clone().multiplyScalar(GLOBE_RADIUS * 5));
    group.rotateX(Math.PI / 2);
    globeGroup.add(group);

    /* leve desvio lateral para a trajetória parecer mais orgânica */
    const wobbleAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();

    /* rastro de partículas (trilha de fumaça/luz) */
    const TRAIL_COUNT = 26;
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(TRAIL_COUNT * 3);
    for (let i = 0; i < TRAIL_COUNT; i++) trailPos.set([startPos.x, startPos.y, startPos.z], i * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    const trailMat = new THREE.PointsMaterial({
      color: COLORS.brandSoft, size: GLOBE_RADIUS * 0.012, transparent: true,
      opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const trail = new THREE.Points(trailGeo, trailMat);
    globeGroup.add(trail);

    rockets.push({
      group, flame, glow, trail, trailGeo, trailPositions: [],
      normal, wobbleAxis, age: 0
    });
  }

  let nextRocketAt = 2.5;

  /* ── ATMOSFERA (Shader) ── */
  const atmMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      void main() {
        float pulse = 0.5 + 0.1 * sin(uTime * 1.8);
        float rim = pow(max(0.0, 0.6 - dot(vNormal, vec3(0,0,1))), 2.5);
        gl_FragColor = vec4(0.14, 0.77, 0.37, 1.0) * rim * pulse;
      }`,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.15, 32, 32), atmMat));

  /* ── PARTÍCULAS ── */
  const STAR_COUNT = 220;
  const starGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = GLOBE_RADIUS * (1.2 + Math.random() * 3.2);
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(Math.random() * 2 - 1);
    sPos[i*3] = r * Math.sin(p) * Math.cos(t);
    sPos[i*3+1] = r * Math.sin(p) * Math.sin(t);
    sPos[i*3+2] = r * Math.cos(p);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: COLORS.brandSoft, size: 0.03, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending
  }));
  globeGroup.add(starField);

  /* ── RIPPLES ── */
  const ripples = [];
  function spawnRipple() {
    if (ripples.length >= 4) return;
    const st = stateMeshes[Math.floor(Math.random() * stateMeshes.length)];
    const pos = st.position.clone().multiplyScalar(1.002);
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.005, 0.12, 16),
      new THREE.MeshBasicMaterial({ color: COLORS.brandBright, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    );
    mesh.position.copy(pos);
    mesh.lookAt(new THREE.Vector3(0,0,0));
    mesh.rotateX(Math.PI / 2);
    globeGroup.add(mesh);
    ripples.push({ mesh, scale: 0.1, opacity: 0.6, speed: 0.015 });
  }

  /* ── ROTAÇÃO E INTERAÇÃO ── */
  const BRASILIA = { lat: -15.798, lon: -47.892 };
  globeGroup.rotation.y = -(BRASILIA.lon + 90) * DEG;
  globeGroup.rotation.x = -(BRASILIA.lat * DEG);

  const BASE_SPEED = 0.0014;
  const HOVER_SPEED = 0.00035;
  let curSpeed = BASE_SPEED, tgtSpeed = BASE_SPEED;
  let dragVY = 0, dragVX = 0;
  let isDragging = false, isHovered = false;
  let hasInteracted = false; // após o primeiro arraste, a rotação volta ao normal por inércia, sem esperar o timer inicial
  let prevMouse = { x: 0, y: 0 };
  const t0 = Date.now();
  let time = 0, highlightState = -1;

  const tip = document.createElement('div');
  tip.className = 'globe-tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);

  /* ── ANIMATION LOOP ── */
  function animate() {
    requestAnimationFrame(animate);
    time += 0.016;

    atmMat.uniforms.uTime.value = time;
    borderMat.opacity = 0.6 + 0.35 * Math.sin(time * 2.2);

    const a1 = time * 0.35;
    orbit1.sat.position.set(Math.cos(a1) * orbit1.radius, 0, Math.sin(a1) * orbit1.radius);
    orbit1.sat.rotation.y = a1 + Math.PI / 2;
    const a2 = -time * 0.28;
    orbit2.sat.position.set(Math.cos(a2) * orbit2.radius, 0, Math.sin(a2) * orbit2.radius);
    orbit2.sat.rotation.y = a2 - Math.PI / 2;
    const a3 = time * 0.5;
    orbit3.sat.position.set(Math.cos(a3) * orbit3.radius, 0, Math.sin(a3) * orbit3.radius);
    orbit3.sat.rotation.y = a3 + Math.PI / 2;

    /* ── foguetes: lançamento periódico e trajetória de saída ── */
    nextRocketAt -= 0.016;
    if (nextRocketAt <= 0 && rockets.length < 3) {
      launchRocket();
      nextRocketAt = 4 + Math.random() * 5;
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const rk = rockets[i];
      rk.age += 0.016;
      const t = Math.min(1, rk.age / ROCKET_LIFE_SEC);
      const eased = t * t * (1.3 - 0.3 * t); // aceleração progressiva
      const dist = GLOBE_RADIUS * 1.001 + eased * (ROCKET_MAX_ALT - GLOBE_RADIUS);
      const wobble = Math.sin(rk.age * 2.2) * 0.05 * t;
      const dir = rk.normal.clone()
        .addScaledVector(rk.wobbleAxis, wobble)
        .normalize();
      const pos = dir.clone().multiplyScalar(dist);
      rk.group.position.copy(pos);
      rk.group.lookAt(dir.clone().multiplyScalar(dist + 5));
      rk.group.rotateX(Math.PI / 2);

      const flick = 0.75 + Math.random() * 0.25;
      rk.flame.scale.set(flick, 1, flick);
      rk.glow.material.opacity = 0.6 + Math.random() * 0.3;

      rk.trailPositions.unshift(pos.clone());
      if (rk.trailPositions.length > 26) rk.trailPositions.pop();
      const arr = rk.trailGeo.attributes.position.array;
      for (let k = 0; k < 26; k++) {
        const p = rk.trailPositions[k] || pos;
        arr[k * 3] = p.x; arr[k * 3 + 1] = p.y; arr[k * 3 + 2] = p.z;
      }
      rk.trailGeo.attributes.position.needsUpdate = true;
      rk.trail.material.opacity = 0.55 * (1 - t);

      if (t >= 1) {
        globeGroup.remove(rk.group);
        globeGroup.remove(rk.trail);
        rk.trailGeo.dispose();
        rockets.splice(i, 1);
      }
    }

    movingParticles.forEach(p => {
      p.t += p.speed;
      if (p.t > 1) { p.t = 0; p.speed = 0.004 + Math.random() * 0.004; }
      p.mesh.position.copy(p.curve.getPointAt(p.t));
    });

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.scale += r.speed * 6; r.opacity -= r.speed;
      r.mesh.scale.set(r.scale, r.scale, 1);
      r.mesh.material.opacity = Math.max(0, r.opacity);
      if (r.opacity <= 0) { globeGroup.remove(r.mesh); ripples.splice(i, 1); }
    }
    if (Math.random() < 0.012) spawnRipple();

    starField.rotation.y += 0.0002;

    stateMeshes.forEach((mesh, idx) => {
      if (idx === highlightState) {
        mesh.scale.set(1.5, 1.5, 1.5);
        mesh.material.color.setHex(COLORS.white);
      } else {
        const p = 1 + 0.12 * Math.sin(time * 3.5 + idx * 0.6);
        mesh.scale.set(p, p, p);
        mesh.material.color.setHex(COLORS.brandBright);
      }
    });

    globalCityMeshes.forEach((mesh, idx) => {
      const p = 1 + 0.22 * Math.sin(time * 1.6 + idx * 1.1);
      mesh.scale.set(p, p, p);
      mesh.material.opacity = 0.65 + 0.3 * Math.sin(time * 1.6 + idx * 1.1);
    });

    const elapsed = Date.now() - t0;

    if (highlightState !== -1 && !isDragging) {
      const s = STATES[highlightState];
      const ty = -(s.lon + 90) * DEG, tx = -(s.lat * DEG);
      let dy = ty - globeGroup.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      globeGroup.rotation.y += dy * 0.06;
      let dx = tx - globeGroup.rotation.x;
      dx = Math.atan2(Math.sin(dx), Math.cos(dx));
      globeGroup.rotation.x += dx * 0.06;
    } else if (isDragging) {
      // controlado pelo mouse/toque
    } else if (Math.abs(dragVY) > 0.00008 || Math.abs(dragVX) > 0.00008) {
      // Inércia natural após soltar o globo — desacelera suavemente até retomar a rotação automática
      globeGroup.rotation.y += dragVY;
      globeGroup.rotation.x += dragVX;
      dragVY *= 0.94; dragVX *= 0.94;
      globeGroup.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, globeGroup.rotation.x));
    } else if (elapsed > 3000 || hasInteracted) {
      tgtSpeed = isHovered ? HOVER_SPEED : BASE_SPEED;
      curSpeed += (tgtSpeed - curSpeed) * 0.05;
      globeGroup.rotation.y += curSpeed;
      globeGroup.rotation.x += (-(BRASILIA.lat * DEG) - globeGroup.rotation.x) * 0.02;
    }

    renderer.render(scene, camera);
  }

  /* ── INPUT ── */
  function onStart(x, y) { isDragging = true; hasInteracted = true; dragVY = 0; dragVX = 0; prevMouse = { x, y }; }
  function onMove(x, y) {
    if (!isDragging) return;
    dragVY = (x - prevMouse.x) * 0.004;
    dragVX = (y - prevMouse.y) * 0.004;
    globeGroup.rotation.y += dragVY;
    globeGroup.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, globeGroup.rotation.x + dragVX));
    prevMouse = { x, y };
  }

  canvas.addEventListener('mouseenter', () => { isHovered = true; });
  canvas.addEventListener('mouseleave', () => { isHovered = false; isDragging = false; highlightState = -1; tip.classList.remove('visible'); });
  canvas.addEventListener('mousedown', e => onStart(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('touchstart', e => { if (e.touches.length) { isHovered = true; onStart(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: true });
  canvas.addEventListener('touchmove', e => { if (e.touches.length) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  canvas.addEventListener('touchend', () => { isDragging = false; isHovered = false; });

  /* ── RAYCASTING ── */
  const raycaster = new THREE.Raycaster();
  const mv = new THREE.Vector2();

  window.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    if (cx < 0 || cx > rect.width || cy < 0 || cy > rect.height) { if (!isDragging) isHovered = false; return; }
    isHovered = true;
    mv.x = (cx / rect.width) * 2 - 1;
    mv.y = -(cy / rect.height) * 2 + 1;
    raycaster.setFromCamera(mv, camera);
    const hits = raycaster.intersectObjects(stateMeshes);
    if (hits.length) {
      const si = hits[0].object.userData.stateIndex;
      highlightState = si;
      canvas.style.cursor = 'pointer';
      const st = STATES[si];
      tip.innerHTML = `<div class="tt-state">${st.state} (${st.abbr})</div><div class="tt-capital">Capital: ${st.capital}</div><div class="tt-events">${st.events} eventos</div>`;
      tip.classList.add('visible');
      let tx = e.clientX + 20, ty = e.clientY + 20;
      const tr = tip.getBoundingClientRect();
      if (tx + tr.width > window.innerWidth - 16) tx = e.clientX - tr.width - 16;
      if (ty + tr.height > window.innerHeight - 16) ty = e.clientY - tr.height - 16;
      tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
    } else if (!isDragging) {
      highlightState = -1; canvas.style.cursor = 'grab'; tip.classList.remove('visible');
    }
  });

  /* ── RESIZE ── */
  const BASE_CONTAINER_PX = 620; // acompanha o tamanho máximo do .globe-container no CSS
  const BASE_CAM_Z = 18;         // distância com margem suficiente para as órbitas não serem cortadas
  function resize() {
    const r = container.getBoundingClientRect();
    renderer.setSize(r.width, r.height);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    camera.position.z = BASE_CAM_Z / Math.min(1, Math.min(r.width, r.height) / BASE_CONTAINER_PX);
  }
  resize();
  window.addEventListener('resize', resize);

  /* ── HUD ── */
  if (statsList) {
    statsList.innerHTML = '';
    [...STATES].map((st, i) => ({ ...st, origIdx: i })).sort((a, b) => b.events - a.events).forEach(st => {
      const el = document.createElement('div');
      el.className = 'globe-stats-item';
      el.innerHTML = `<span class="globe-stats-city"><span class="globe-stats-dot"></span>${st.abbr} — ${st.capital}</span><span class="globe-stats-count">${st.events}</span>`;
      statsList.appendChild(el);
      el.addEventListener('mouseenter', () => { highlightState = st.origIdx; });
      el.addEventListener('mouseleave', () => { highlightState = -1; });
    });
  }

  animate();
})();
