/* ============================================================
   3D ROTATING HOLOGRAPHIC GLOBE — Canvas 2D Point Cloud
   Ultra-detailed dot matrix with real satellite texture sampling
   and instant procedural fallback.
   ============================================================ */
(function () {
  'use strict';

  const canvas = document.getElementById('globeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('globeContainer');
  const statsList = document.getElementById('globeStatsList');

  /* ---- Colors ---- */
  const PRIMARY = '#22c55e'; // Green
  const PRIMARY_A = (a) => `rgba(34,197,94,${a})`;
  const ACCENT = '#4ade80'; // Bright electric green
  const WORLD_DOT_COLOR = 'rgba(34, 197, 94, 0.16)'; // Subtle green for rest of the world
  
  /* ---- All 27 Brazilian States (26 states + DF) ---- */
  const states = [
    // Norte
    { state: 'Amazonas', abbr: 'AM', capital: 'Manaus', lat: -3.1190, lon: -60.0217, events: 12 },
    { state: 'Pará', abbr: 'PA', capital: 'Belém', lat: -1.4558, lon: -48.5024, events: 18 },
    { state: 'Acre', abbr: 'AC', capital: 'Rio Branco', lat: -9.9754, lon: -67.8100, events: 5 },
    { state: 'Rondônia', abbr: 'RO', capital: 'Porto Velho', lat: -8.7612, lon: -63.9004, events: 7 },
    { state: 'Roraima', abbr: 'RR', capital: 'Boa Vista', lat: 2.8195, lon: -60.6714, events: 4 },
    { state: 'Amapá', abbr: 'AP', capital: 'Macapá', lat: 0.0349, lon: -51.0694, events: 3 },
    { state: 'Tocantins', abbr: 'TO', capital: 'Palmas', lat: -10.1689, lon: -48.3317, events: 8 },
    // Nordeste
    { state: 'Maranhão', abbr: 'MA', capital: 'São Luís', lat: -2.5297, lon: -44.2825, events: 14 },
    { state: 'Piauí', abbr: 'PI', capital: 'Teresina', lat: -5.0892, lon: -42.8019, events: 9 },
    { state: 'Ceará', abbr: 'CE', capital: 'Fortaleza', lat: -3.7172, lon: -38.5433, events: 28 },
    { state: 'Rio G. do Norte', abbr: 'RN', capital: 'Natal', lat: -5.7945, lon: -35.2110, events: 15 },
    { state: 'Paraíba', abbr: 'PB', capital: 'João Pessoa', lat: -7.1195, lon: -34.8450, events: 11 },
    { state: 'Pernambuco', abbr: 'PE', capital: 'Recife', lat: -8.0476, lon: -34.8770, events: 32 },
    { state: 'Alagoas', abbr: 'AL', capital: 'Maceió', lat: -9.6658, lon: -35.7353, events: 10 },
    { state: 'Sergipe', abbr: 'SE', capital: 'Aracaju', lat: -10.9091, lon: -37.0677, events: 8 },
    { state: 'Bahia', abbr: 'BA', capital: 'Salvador', lat: -12.9714, lon: -38.5124, events: 35 },
    // Centro-Oeste
    { state: 'Goiás', abbr: 'GO', capital: 'Goiânia', lat: -16.6869, lon: -49.2648, events: 20 },
    { state: 'Mato Grosso', abbr: 'MT', capital: 'Cuiabá', lat: -15.6014, lon: -56.0979, events: 13 },
    { state: 'Mato G. do Sul', abbr: 'MS', capital: 'Campo Grande', lat: -20.4697, lon: -54.6201, events: 11 },
    { state: 'Distrito Federal', abbr: 'DF', capital: 'Brasília', lat: -15.7975, lon: -47.8919, events: 42 },
    // Sudeste
    { state: 'São Paulo', abbr: 'SP', capital: 'São Paulo', lat: -23.5505, lon: -46.6333, events: 85 },
    { state: 'Rio de Janeiro', abbr: 'RJ', capital: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729, events: 65 },
    { state: 'Minas Gerais', abbr: 'MG', capital: 'Belo Horizonte', lat: -19.9191, lon: -43.9386, events: 38 },
    { state: 'Espírito Santo', abbr: 'ES', capital: 'Vitória', lat: -20.3155, lon: -40.3128, events: 14 },
    // Sul
    { state: 'Paraná', abbr: 'PR', capital: 'Curitiba', lat: -25.4284, lon: -49.2733, events: 30 },
    { state: 'Santa Catarina', abbr: 'SC', capital: 'Florianópolis', lat: -27.5949, lon: -48.5482, events: 25 },
    { state: 'Rio G. do Sul', abbr: 'RS', capital: 'Porto Alegre', lat: -30.0346, lon: -51.2177, events: 38 },
  ];

  /* ---- Geometry Data ---- */
  const DEG = Math.PI / 180;

  // Precise Brazil Border Coordinates for solid outline and highlight
  const BRAZIL = [
    [5.27, -51.0], [4.4, -51.1], [4.3, -50.3], [2.8, -50.8], [2.2, -50.0],
    [1.8, -49.9], [1.2, -49.9], [0.7, -50.0], [0.4, -49.6], [-0.1, -49.5],
    [-1.0, -48.5], [-1.7, -48.8], [-2.5, -48.6], [-2.8, -48.5], [-2.6, -44.3],
    [-2.9, -41.5], [-3.0, -39.0], [-3.7, -38.5], [-5.0, -36.7], [-5.5, -35.5],
    [-6.5, -35.0], [-7.1, -34.8], [-8.3, -35.0], [-9.4, -35.5], [-10.5, -36.4],
    [-11.5, -37.4], [-12.9, -38.4], [-13.4, -38.9], [-14.8, -39.1], [-15.4, -39.0],
    [-16.0, -39.2], [-17.8, -39.4], [-18.3, -39.7], [-19.9, -40.0], [-20.3, -40.3],
    [-22.0, -41.0], [-22.9, -41.9], [-23.0, -43.2], [-23.4, -44.7], [-23.8, -45.4],
    [-24.0, -46.1], [-25.3, -48.0], [-25.5, -48.5], [-26.3, -48.6], [-27.6, -48.6],
    [-28.6, -49.0], [-29.3, -49.7], [-29.4, -50.3], [-30.0, -51.0], [-31.0, -51.0],
    [-32.1, -52.0], [-33.0, -52.4], [-33.75, -53.4], [-33.5, -53.5], [-33.2, -54.0],
    [-32.0, -55.1], [-31.0, -56.0], [-30.0, -57.6], [-29.7, -57.5], [-28.7, -56.0],
    [-28.2, -55.5], [-27.5, -55.8], [-27.0, -55.4], [-26.0, -54.6], [-25.3, -54.6],
    [-24.0, -54.6], [-23.4, -55.4], [-22.3, -56.0], [-22.0, -57.8], [-20.5, -57.9],
    [-18.3, -57.6], [-17.8, -57.8], [-16.5, -58.4], [-16.0, -60.0], [-14.0, -60.0],
    [-13.5, -61.8], [-12.0, -63.0], [-11.0, -62.5], [-10.5, -65.3], [-10.0, -66.0],
    [-9.5, -66.0], [-9.0, -67.1], [-8.0, -69.5], [-7.5, -72.9], [-5.0, -70.2],
    [-4.2, -69.9], [-2.5, -69.9], [-1.7, -69.4], [-1.0, -69.6], [0.0, -69.2],
    [1.0, -68.0], [1.2, -67.1], [2.0, -66.9], [2.0, -64.0], [3.4, -64.0],
    [3.8, -63.4], [4.0, -63.0], [3.9, -61.0], [3.6, -60.0], [5.0, -60.5],
    [5.27, -60.0], [4.5, -58.0], [4.5, -56.1], [3.0, -55.0], [2.5, -54.6],
    [2.2, -54.0], [2.3, -53.0], [2.8, -52.9], [3.5, -52.0], [5.27, -51.0]
  ];

  // Simplified Continents (used for immediate offline fallback point-cloud generation)
  const NORTH_AMERICA = [
    [50.0, -60.0], [47.0, -53.0], [45.0, -56.0], [44.0, -59.5], [43.5, -65.5],
    [42.0, -70.0], [40.5, -74.0], [38.5, -75.5], [35.0, -75.5], [30.0, -81.5],
    [25.5, -80.0], [25.0, -81.0], [24.5, -82.0], [26.0, -82.0], [27.0, -83.0],
    [28.5, -84.5], [29.0, -89.0], [30.0, -89.0], [29.5, -91.0], [29.0, -94.0],
    [26.0, -97.0], [23.0, -97.5], [22.0, -98.0], [19.0, -96.0], [18.0, -95.0],
    [16.0, -94.5], [15.0, -92.0], [14.0, -87.5], [12.0, -86.0], [10.0, -84.0],
    [8.0, -83.0], [8.0, -77.5], [9.0, -76.0], [11.0, -75.0], [12.0, -72.0],
    [12.5, -71.5], [10.7, -66.0], [10.0, -64.0], [10.7, -62.0], [10.5, -61.0],
    [15.5, -61.5], [18.0, -63.0], [18.5, -66.0], [18.4, -67.0], [19.0, -69.0],
    [20.0, -73.0], [23.0, -82.0], [25.0, -78.0], [25.5, -80.0], [30.0, -81.5],
    [31.0, -81.2], [32.5, -79.5], [34.5, -77.0], [37.0, -76.0], [39.0, -74.0],
    [40.5, -74.0], [41.0, -72.0], [42.0, -70.0], [43.5, -69.8], [44.5, -67.0],
    [45.5, -62.0], [46.0, -60.0], [47.5, -59.0], [49.0, -58.0], [50.0, -56.0],
    [52.0, -56.0], [55.0, -58.0], [55.5, -60.0], [53.5, -59.0], [52.0, -57.5],
    [50.0, -60.0]
  ];

  const SOUTH_AMERICA_REST = [
    [12.5, -71.5], [12.0, -72.0], [11.0, -75.0], [9.0, -76.0], [8.0, -77.0],
    [7.0, -77.8], [4.0, -77.5], [1.5, -78.8], [0.0, -80.0], [-1.0, -80.1],
    [-2.2, -80.9], [-4.0, -81.2], [-5.5, -81.0], [-6.5, -80.0], [-8.0, -79.5],
    [-10.0, -78.0], [-12.0, -77.0], [-14.0, -76.0], [-16.0, -75.0], [-18.0, -71.0],
    [-20.0, -70.0], [-22.0, -70.0], [-24.0, -70.5], [-27.0, -70.5], [-29.0, -71.0],
    [-33.0, -71.5], [-36.0, -73.0], [-38.0, -73.5], [-42.0, -73.0], [-46.0, -75.5],
    [-48.0, -75.5], [-50.0, -74.5], [-52.0, -72.0], [-53.0, -71.0], [-54.0, -69.0],
    [-55.0, -68.5], [-55.5, -66.5], [-54.8, -64.5], [-52.4, -69.0], [-51.5, -69.3],
    [-50.0, -68.5], [-47.0, -66.0], [-44.0, -65.5], [-42.0, -63.5], [-39.0, -62.0],
    [-37.0, -57.0], [-35.0, -56.5], [-34.5, -55.0], [-33.0, -52.4], [12.5, -71.5]
  ];

  const AFRICA = [
    [37.0, -6.0], [36.0, -2.0], [35.5, 0.0], [37.0, 10.0], [33.0, 12.0],
    [32.0, 15.0], [31.5, 25.0], [31.0, 30.0], [30.0, 33.0], [27.0, 34.0],
    [22.0, 37.0], [18.0, 38.5], [15.0, 42.0], [12.0, 44.0], [11.0, 51.0],
    [2.0, 45.5], [0.0, 42.0], [-2.0, 41.0], [-4.5, 39.5], [-10.0, 40.5],
    [-15.0, 40.5], [-18.0, 37.0], [-23.0, 35.5], [-26.0, 33.0], [-29.0, 31.0],
    [-34.0, 26.0], [-34.5, 20.0], [-33.0, 18.0], [-31.0, 17.0], [-29.0, 16.5],
    [-23.0, 14.5], [-17.0, 12.0], [-12.5, 13.5], [-9.0, 13.0], [-6.0, 12.0],
    [-4.5, 10.0], [-5.0, 7.0], [-5.0, 4.0], [-4.0, 2.5], [-1.5, 1.0],
    [0.0, 1.0], [2.5, 3.0], [4.0, 5.5], [6.0, 7.0], [6.5, 3.5], [6.0, 2.5],
    [4.0, 2.5], [4.0, 1.0], [5.5, -1.0], [5.0, -4.0], [6.0, -5.0],
    [7.5, -5.0], [10.0, -3.5], [10.5, -1.0], [11.0, 0.0], [13.0, 2.0],
    [15.0, -2.0], [15.0, -11.0], [18.0, -16.0], [20.0, -17.0], [21.0, -17.0],
    [24.0, -16.0], [26.0, -14.5], [28.0, -13.0], [33.0, -8.5], [35.5, -6.0],
    [35.5, -2.0], [36.5, -3.0], [37.0, -6.0]
  ];

  const EUROPE = [
    [36.0, -6.0], [36.5, -3.0], [37.0, -2.0], [38.0, -0.5], [39.0, 0.0],
    [40.5, 0.5], [42.0, 3.0], [43.0, 5.0], [43.5, 7.5], [44.0, 8.5],
    [45.5, 13.5], [42.0, 15.0], [40.5, 18.5], [39.5, 20.0], [38.0, 24.0],
    [38.0, 26.0], [41.0, 29.0], [42.0, 28.0], [43.0, 28.5], [45.5, 29.5],
    [46.5, 30.5], [46.0, 33.0], [44.5, 34.0], [45.5, 36.5], [47.0, 38.0],
    [50.0, 36.5], [52.0, 37.0], [54.0, 38.0], [56.0, 37.0], [57.5, 40.0],
    [60.0, 38.0], [62.0, 35.0], [65.0, 30.0], [68.0, 27.0], [70.0, 28.0],
    [71.0, 25.0], [70.5, 20.0], [68.0, 16.0], [65.0, 14.0], [63.0, 11.0],
    [61.0, 5.0], [58.0, 7.0], [56.5, 8.0], [55.0, 8.5], [54.5, 10.0],
    [55.5, 13.0], [54.5, 13.5], [53.5, 10.0], [51.5, 7.0], [51.0, 4.0],
    [51.5, 3.5], [51.0, 1.5], [50.5, -1.5], [49.0, -1.5], [48.5, -5.0],
    [47.5, -2.5], [46.5, -1.8], [43.5, -1.5], [42.5, -9.0], [43.0, -9.0],
    [43.5, -8.0], [44.5, -1.2], [46.5, -1.5], [47.5, -2.5], [48.5, -5.0],
    [48.0, -5.5], [46.0, -6.5], [43.5, -8.2], [42.5, -9.0], [40.0, -8.5],
    [37.0, -8.0], [36.5, -6.5], [36.0, -6.0]
  ];

  const ASIA = [
    [42.0, 29.0], [41.0, 36.0], [37.0, 36.0], [35.0, 36.0], [33.5, 35.5],
    [31.0, 34.5], [29.5, 35.0], [28.0, 36.0], [26.0, 36.0], [22.0, 39.5],
    [16.0, 42.5], [13.0, 45.0], [12.5, 51.0], [11.0, 51.0], [12.0, 44.0],
    [10.0, 45.0], [5.0, 46.0], [2.0, 45.5], [0.0, 49.0], [-2.0, 50.0],
    [0.0, 55.0], [3.0, 60.0], [5.0, 65.0], [8.0, 73.0], [10.0, 76.0],
    [8.0, 77.0], [7.0, 79.5], [6.0, 80.0], [10.0, 80.0], [13.0, 80.0],
    [15.0, 80.0], [20.0, 87.0], [22.0, 89.0], [22.0, 97.0], [20.0, 100.0],
    [18.0, 103.0], [16.0, 108.0], [12.0, 109.0], [10.5, 107.0], [8.0, 105.0],
    [3.0, 104.0], [1.5, 103.5], [1.0, 110.0], [-2.0, 115.0], [-5.0, 120.0],
    [-8.0, 115.0], [-8.5, 140.0], [-6.0, 141.0], [-4.0, 138.0], [-2.0, 134.0],
    [0.0, 128.0], [2.0, 126.0], [5.0, 125.0], [7.0, 122.0], [13.0, 121.0],
    [15.0, 120.0], [18.0, 121.0], [22.0, 121.0], [23.0, 117.0], [25.0, 119.0],
    [28.0, 121.0], [30.0, 122.0], [35.0, 128.0], [38.0, 129.0], [40.0, 130.0],
    [42.0, 131.0], [45.0, 135.0], [46.0, 140.0], [50.0, 140.0], [53.0, 142.0],
    [58.0, 140.0], [60.0, 150.0], [62.0, 160.0], [64.0, 170.0], [65.0, 180.0],
    [68.0, 170.0], [69.0, 160.0], [68.0, 140.0], [68.5, 100.0], [70.0, 80.0],
    [72.0, 70.0], [70.0, 60.0], [68.0, 55.0], [66.0, 50.0], [62.0, 38.0],
    [60.0, 38.0], [56.0, 37.0], [54.0, 38.0], [52.0, 37.0], [50.0, 36.5],
    [47.0, 38.0], [45.5, 36.5], [44.5, 34.0], [46.0, 33.0], [46.5, 30.5],
    [45.5, 29.5], [43.0, 28.5], [42.0, 29.0]
  ];

  const AUSTRALIA = [
    [-12.0, 130.0], [-12.0, 136.0], [-14.0, 136.0], [-14.5, 129.0], [-15.5, 129.0],
    [-15.0, 124.0], [-17.0, 122.5], [-20.0, 119.0], [-22.0, 114.0], [-26.0, 113.0],
    [-29.0, 114.0], [-31.5, 116.0], [-34.0, 116.0], [-35.0, 117.5], [-34.5, 119.0],
    [-34.0, 121.5], [-34.0, 136.0], [-36.0, 137.0], [-38.0, 141.0], [-39.0, 146.0],
    [-37.5, 150.0], [-34.0, 151.5], [-32.0, 152.5], [-28.5, 153.5], [-25.0, 153.0],
    [-23.0, 150.5], [-19.0, 146.5], [-16.0, 145.5], [-14.5, 144.0], [-12.5, 142.0],
    [-11.0, 142.5], [-12.0, 141.5], [-14.0, 141.0], [-14.0, 138.5], [-12.0, 136.0],
    [-12.0, 130.0]
  ];

  const continents = [
    { path: NORTH_AMERICA },
    { path: SOUTH_AMERICA_REST },
    { path: AFRICA },
    { path: EUROPE },
    { path: ASIA },
    { path: AUSTRALIA }
  ];

  /* ---- Point-in-Polygon Check (Ray-Casting) ---- */
  function isPointInPolygon(lat, lon, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][1], yi = polygon[i][0];
      const xj = polygon[j][1], yj = polygon[j][0];
      const intersect = ((yi > lat) !== (yj > lat))
          && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /* ---- State ---- */
  let W, H, R;
  let rotY = -51 * DEG; // Focused on South America
  let rotX = 16 * DEG;  // Tilt to see states better
  let autoSpeed = 0.0016;
  let mouseActive = false;
  let mouseX = 0, mouseY = 0;
  let highlightState = -1;
  let time = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Arrays to hold coordinates of land points
  let landPoints = [];

  /* ---- Tooltip ---- */
  const tooltip = document.createElement('div');
  tooltip.className = 'globe-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(tooltip);

  /* ---- 3D Projection ---- */
  function project(lat, lon) {
    const phi = lat * DEG;
    const lambda = lon * DEG;
    const cosLat = Math.cos(phi);
    const x = cosLat * Math.sin(lambda - rotY);
    const y = Math.sin(phi) * Math.cos(rotX) - cosLat * Math.cos(lambda - rotY) * Math.sin(rotX);
    const z = Math.sin(phi) * Math.sin(rotX) + cosLat * Math.cos(lambda - rotY) * Math.cos(rotX);
    return {
      x: W / 2 + x * R,
      y: H / 2 - y * R,
      z: z,
      visible: z > 0
    };
  }

  /* ---- Quick Procedural Point-Cloud Generator (Instant/Fallback) ---- */
  function generateFallbackPoints() {
    const points = [];
    // 2.2 degrees step for good density without lagging offline
    const step = 2.2;
    for (let lat = -80; lat <= 80; lat += step) {
      for (let lon = -180; lon < 180; lon += step) {
        // Quick raycast check
        let isLand = false;
        if (isPointInPolygon(lat, lon, BRAZIL)) {
          isLand = true;
        } else {
          for (const c of continents) {
            if (isPointInPolygon(lat, lon, c.path)) {
              isLand = true;
              break;
            }
          }
        }
        if (isLand) {
          points.push({
            lat,
            lon,
            isBrazil: isPointInPolygon(lat, lon, BRAZIL)
          });
        }
      }
    }
    return points;
  }

  // Set initial points
  landPoints = generateFallbackPoints();

  /* ---- Texture-based World Map Loader (Ultra Detail) ---- */
  const worldImg = new Image();
  worldImg.crossOrigin = 'anonymous';
  // Standard black & white / silhouette earth texture
  worldImg.src = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg';
  
  worldImg.onload = () => {
    try {
      const offscreen = document.createElement('canvas');
      const offCtx = offscreen.getContext('2d');
      // Low enough resolution for fast load, high enough for detail
      const w = 240;
      const h = 120;
      offscreen.width = w;
      offscreen.height = h;
      offCtx.drawImage(worldImg, 0, 0, w, h);
      const imgData = offCtx.getImageData(0, 0, w, h).data;
      
      const newPoints = [];
      const density = 1.4; // Degrees step for texture grid
      
      for (let y = 0; y < h; y += density) {
        const lat = 90 - (y / h) * 180;
        for (let x = 0; x < w; x += density) {
          const lon = (x / w) * 360 - 180;
          const idx = Math.floor(y) * w * 4 + Math.floor(x) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          // Determine if pixel is land by checking average brightness
          const val = (r + g + b) / 3;
          if (val > 45) { // Land threshold
            newPoints.push({
              lat,
              lon,
              isBrazil: isPointInPolygon(lat, lon, BRAZIL)
            });
          }
        }
      }
      if (newPoints.length > 1000) {
        landPoints = newPoints;
        console.log('Globe loaded high-res textures successfully!');
      }
    } catch (e) {
      console.warn('CORS error or loading issue with texture map image. Using high fidelity offline fallback.');
    }
  };

  /* ---- Starfield Particles (Cosmic Effect) ---- */
  const stars = [];
  for (let i = 0; i < 40; i++) {
    stars.push({
      x: (Math.random() - 0.5) * 2.2,
      y: (Math.random() - 0.5) * 2.2,
      z: (Math.random() - 0.5) * 2.2,
      size: 0.4 + Math.random() * 0.8
    });
  }

  function drawStars() {
    stars.forEach(st => {
      // Rotate stars slowly on Y axis
      const cos = Math.cos(time * 0.03);
      const sin = Math.sin(time * 0.03);
      const rx = st.x * cos - st.z * sin;
      const rz = st.x * sin + st.z * cos;

      // Project onto 2D screen
      const x = W / 2 + rx * R * 1.3;
      const y = H / 2 - st.y * R * 1.3;
      
      // Depth shading (brighter in front, darker in back)
      const alpha = Math.max(0.05, (rz + 1.1) * 0.15);
      
      ctx.beginPath();
      ctx.arc(x, y, st.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    });
  }

  /* ---- Dynamic Floating Signal Particles ---- */
  const signals = [];
  function addSignal() {
    if (signals.length >= 8) return;
    const randomState = states[Math.floor(Math.random() * states.length)];
    signals.push({
      lat: randomState.lat,
      lon: randomState.lon,
      radius: 0.1,
      maxRadius: 25 + Math.random() * 20,
      opacity: 0.7,
      speed: 0.4 + Math.random() * 0.3
    });
  }

  function drawSignals() {
    if (Math.random() < 0.015) addSignal();
    
    for (let i = signals.length - 1; i >= 0; i--) {
      const sig = signals[i];
      sig.radius += sig.speed;
      sig.opacity = Math.max(0, 0.7 - sig.radius / sig.maxRadius);
      
      if (sig.opacity <= 0) {
        signals.splice(i, 1);
        continue;
      }
      
      const p = project(sig.lat, sig.lon);
      if (!p.visible) continue;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, sig.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(74, 222, 128, ${sig.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /* ---- Resize ---- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, H) * 0.42;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---- Draw Atmosphere Glow ---- */
  function drawAtmosphere() {
    const cx = W / 2, cy = H / 2;

    // Atmospheric layer (Outer glow)
    const grad = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.35);
    grad.addColorStop(0, PRIMARY_A(0.0));
    grad.addColorStop(0.1, PRIMARY_A(0.05));
    grad.addColorStop(0.4, PRIMARY_A(0.02));
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    
    // Core soft silhouette highlight (Inner glow)
    const innerGrad = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R);
    innerGrad.addColorStop(0, 'rgba(0,0,0,0)');
    innerGrad.addColorStop(0.8, PRIMARY_A(0.01));
    innerGrad.addColorStop(1, PRIMARY_A(0.08));
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = innerGrad;
    ctx.fill();
  }

  /* ---- Draw Globe Sphere Backing ---- */
  function drawGlobeOutline() {
    const cx = W / 2, cy = H / 2;

    // Dark space backing
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    const bgGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
    bgGrad.addColorStop(0, 'rgba(4, 20, 11, 0.95)');
    bgGrad.addColorStop(1, 'rgba(2, 8, 4, 0.98)');
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Subtle edge ring
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = PRIMARY_A(0.12);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ---- Draw Dot Matrix Landmasses ---- */
  function drawPoints() {
    // We sort points by Z to draw further points first, but since we only draw visible (z > 0),
    // they are all in the front hemisphere.
    landPoints.forEach(pt => {
      const p = project(pt.lat, pt.lon);
      if (!p.visible) return;

      // Perspective scale: points near edges fade out and shrink
      const alpha = p.z * (pt.isBrazil ? 0.85 : 0.28);
      const radius = (pt.isBrazil ? 1.4 : 0.8) * Math.max(0.5, p.z);

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = pt.isBrazil ? ACCENT : WORLD_DOT_COLOR;
      ctx.fill();
      
      // Extra tiny glow for Brazil points
      if (pt.isBrazil && p.z > 0.6) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = PRIMARY_A(0.15 * p.z);
        ctx.fill();
      }
    });
  }

  /* ---- Draw Detailed Brazil Polygon Outline ---- */
  function drawBrazilOutline() {
    let visibleCount = 0;
    const projected = BRAZIL.map(([lat, lon]) => {
      const p = project(lat, lon);
      if (p.visible) visibleCount++;
      return p;
    });

    if (visibleCount < 3) return;

    ctx.beginPath();
    let started = false;
    for (const p of projected) {
      if (p.visible) {
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
    }
    ctx.closePath();

    // Pulse brightness
    const pulse = Math.sin(time * 2.5) * 0.15 + 0.55;
    ctx.strokeStyle = PRIMARY_A(pulse);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /* ---- Draw State Capitals (Glowing Nodes) ---- */
  function drawStates() {
    const projectedStates = states.map((st, i) => ({
      ...st,
      ...project(st.lat, st.lon),
      index: i
    }));

    // Draw capital dots
    projectedStates.forEach((st) => {
      if (!st.visible) return;

      const isHighlight = st.index === highlightState;
      const pulse = Math.sin(time * 3 + st.index * 0.7) * 0.5 + 0.5;
      const baseR = isHighlight ? 4.5 : 2.5;
      const r = baseR + pulse * 1;

      // 1. Outer wave ring
      ctx.beginPath();
      ctx.arc(st.x, st.y, r + 4 + pulse * 3, 0, Math.PI * 2);
      ctx.fillStyle = PRIMARY_A(0.04 + pulse * 0.05);
      ctx.fill();

      // 2. Middle glow
      ctx.beginPath();
      ctx.arc(st.x, st.y, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = PRIMARY_A(0.15 + pulse * 0.1);
      ctx.fill();

      // 3. Core dot
      ctx.shadowColor = PRIMARY;
      ctx.shadowBlur = isHighlight ? 25 : 12;
      ctx.beginPath();
      ctx.arc(st.x, st.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isHighlight ? '#fff' : ACCENT;
      ctx.fill();
      ctx.shadowBlur = 0;

      // 4. Shiny white center
      ctx.beginPath();
      ctx.arc(st.x, st.y, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      // Draw hover label directly on canvas
      if (isHighlight) {
        ctx.font = '700 11px Inter, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(`${st.state} (${st.abbr})`, st.x, st.y - r - 12);
      }
    });
  }

  /* ---- Main Render Pipeline ---- */
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 1. Starfield background
    drawStars();

    // 2. Atmosphere glow (behind globe outline)
    drawAtmosphere();

    // 3. Globe body sphere backing
    drawGlobeOutline();

    // 4. Dot matrix continents
    drawPoints();

    // 5. Solid Brazil outline
    drawBrazilOutline();

    // 6. Waves/Signals from active states
    drawSignals();

    // 7. Glowing state capitals
    drawStates();
  }

  /* ---- Loop ---- */
  function animate() {
    time += 0.016;

    // Smooth inertia-like rotation
    if (!mouseActive) {
      rotY += autoSpeed;
    } else {
      rotY += autoSpeed * 0.12;
    }

    draw();
    requestAnimationFrame(animate);
  }

  /* ---- Mouse & Drag Interaction ---- */
  let lastMouseX = 0, lastMouseY = 0;
  let isDragging = false;

  canvas.addEventListener('mouseenter', () => { mouseActive = true; });
  canvas.addEventListener('mouseleave', () => {
    mouseActive = false;
    isDragging = false;
    highlightState = -1;
    tooltip.classList.remove('visible');
  });

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener('mouseup', () => { isDragging = false; });

  canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (isDragging) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      rotY += dx * 0.005;
      rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotX - dy * 0.005));
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }

    // Check state hover
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    let found = -1;

    states.forEach((st, i) => {
      const p = project(st.lat, st.lon);
      if (!p.visible) return;
      const dx = p.x - cx;
      const dy = p.y - cy;
      if (Math.sqrt(dx * dx + dy * dy) < 14) {
        found = i;
      }
    });

    highlightState = found;

    if (found >= 0) {
      canvas.style.cursor = 'pointer';
      const st = states[found];
      tooltip.innerHTML = `
        <div class="tt-state">${st.state} (${st.abbr})</div>
        <div class="tt-capital">Capital: ${st.capital}</div>
        <div class="tt-events">${st.events} eventos realizados</div>
      `;
      tooltip.classList.add('visible');
      let tx = e.clientX + 18;
      let ty = e.clientY + 18;
      const tr = tooltip.getBoundingClientRect();
      if (tx + tr.width > window.innerWidth - 18) tx = e.clientX - tr.width - 18;
      if (ty + tr.height > window.innerHeight - 18) ty = e.clientY - tr.height - 18;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';
    } else {
      canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
      tooltip.classList.remove('visible');
    }
  });

  /* ---- Touch Support ---- */
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    mouseActive = true;
    isDragging = true;
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const dx = e.touches[0].clientX - lastMouseX;
    const dy = e.touches[0].clientY - lastMouseY;
    rotY += dx * 0.005;
    rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotX - dy * 0.005));
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    isDragging = false;
    mouseActive = false;
  });

  /* ---- Stats Panel Sync ---- */
  if (statsList) {
    // Sort states by events descending for list panel
    const sortedStates = states.map((st, i) => ({ ...st, originalIndex: i }))
      .sort((a, b) => b.events - a.events);

    sortedStates.forEach((st) => {
      const item = document.createElement('div');
      item.className = 'globe-stats-item';
      item.innerHTML = `
        <span class="globe-stats-city"><span class="globe-stats-dot"></span>${st.abbr} — ${st.capital}</span>
        <span class="globe-stats-count">${st.events}</span>
      `;
      statsList.appendChild(item);

      item.addEventListener('mouseenter', () => { highlightState = st.originalIndex; });
      item.addEventListener('mouseleave', () => { highlightState = -1; });
    });
  }

  /* ---- Initial Start ---- */
  animate();
})();
