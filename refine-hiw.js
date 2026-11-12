const fs = require('fs');
const path = require('path');

// 1. UPDATE CSS in css/brand-story.css
const cssPath = path.join(__dirname, 'css', 'brand-story.css');
let css = fs.readFileSync(cssPath, 'utf8');

const oldCssRegex = /\/\* -+\r?\n\s+COMO FUNCIONA [^\r\n]+\r?\n\s+-+ \*\/[\s\S]*?(?=\/\* -+\r?\n\s+ANTES vs DEPOIS)/;

const newCss = `/* ------------------------------------------------------------
   COMO FUNCIONA — ecossistema conectado em múltiplos dispositivos
   ------------------------------------------------------------ */
.how-it-works {
  padding: 50px 24px 55px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.how-it-works::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 70% 50% at 50% 25%, rgba(34, 197, 94, 0.13), transparent 70%);
  pointer-events: none;
}

.hiw-inner {
  width: 100%;
  max-width: 1140px;
  margin: 0 auto;
  position: relative;
  text-align: center;
}

.how-it-works .section-label {
  margin-bottom: 8px;
}

.how-it-works .section-heading {
  margin-bottom: 10px;
  font-size: clamp(1.8rem, 3.2vw, 2.5rem);
  line-height: 1.15;
}

.how-it-works .section-sub {
  max-width: 680px;
  margin: 0 auto 16px;
  font-size: clamp(0.9rem, 1.4vw, 1.02rem);
  line-height: 1.5;
  color: #9ca3af;
}

/* Palco da composição de aparelhos — compacto e integrado ao viewport */
.hiw-stage {
  position: relative;
  width: 100%;
  max-width: 980px;
  height: 480px;
  margin: 10px auto 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  perspective: 1400px;
}

/* Ambient glow focal atrás do notebook */
.hiw-stage::before {
  content: '';
  position: absolute;
  width: 560px;
  height: 260px;
  top: 25%;
  left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at center, rgba(34, 197, 94, 0.22) 0%, rgba(34, 197, 94, 0.05) 55%, transparent 75%);
  filter: blur(45px);
  pointer-events: none;
  z-index: 1;
}

/* Base de todos os dispositivos */
.hiw-device {
  position: absolute;
  user-select: none;
  transition: transform .4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ============================================================
   1. NOTEBOOK (Principal, ao fundo, proporções reais 16:10)
   ============================================================ */
.hiw-device-laptop {
  width: 660px;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  filter: drop-shadow(0 32px 60px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 25px rgba(34, 197, 94, 0.07));
}

.hiw-laptop-lid {
  background: linear-gradient(180deg, #18221b 0%, #0e1611 100%);
  border: 1.5px solid rgba(255, 255, 255, 0.16);
  border-bottom: 2px solid #0a110c;
  border-radius: 16px 16px 0 0;
  padding: 8px 8px 10px;
  position: relative;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.25);
}

.hiw-camera-dot {
  width: 6px;
  height: 6px;
  background: #020603;
  border: 1px solid #1f2d23;
  border-radius: 50%;
  margin: 0 auto 6px;
  position: relative;
}
.hiw-camera-dot::after {
  content: '';
  position: absolute;
  width: 2px;
  height: 2px;
  background: #10b981;
  border-radius: 50%;
  top: 1px;
  left: 1px;
  opacity: 0.8;
}

.hiw-screen-laptop {
  background: #040805;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
  height: 335px;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Reflexo sutil de vidro na tela */
.hiw-screen-laptop::after,
.hiw-screen-tablet::after,
.hiw-screen-phone::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(125deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 30%, transparent 60%);
  pointer-events: none;
  z-index: 10;
}

/* Topbar da plataforma no laptop */
.hiw-laptop-topbar {
  background: rgba(8, 17, 11, 0.95);
  backdrop-filter: blur(12px);
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hiw-window-dots {
  display: flex;
  gap: 5px;
}
.hiw-window-dots span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
}

.hiw-laptop-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  color: #ffffff;
  font-size: 0.72rem;
  letter-spacing: -0.01em;
}

.hiw-brand-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 8px var(--primary);
}

.hiw-laptop-event {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--secondary);
  font-size: 0.68rem;
  background: rgba(34, 197, 94, 0.12);
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(34, 197, 94, 0.28);
}

.hiw-live-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
  animation: hiwPulse 2s infinite ease-in-out;
}

@keyframes hiwPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.8); }
}

/* Conteúdo interno do Dashboard EvoTech */
.hiw-laptop-content {
  display: flex;
  flex: 1;
  min-height: 0;
}

.hiw-laptop-sidebar {
  width: 40px;
  background: rgba(5, 12, 7, 0.85);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 14px;
}

.hiw-side-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #64748b;
}

.hiw-side-btn.active {
  background: rgba(34, 197, 94, 0.18);
  color: var(--primary);
  border: 1px solid rgba(34, 197, 94, 0.35);
}

.hiw-laptop-main {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  text-align: left;
}

.hiw-laptop-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.hiw-kpi-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hiw-kpi-label {
  font-size: 0.62rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.hiw-kpi-val {
  font-size: 0.98rem;
  font-weight: 800;
  color: #ffffff;
  font-family: 'Plus Jakarta Sans', sans-serif;
  letter-spacing: -0.02em;
}

.hiw-kpi-val.is-green {
  color: var(--secondary);
}

.hiw-kpi-sub {
  font-size: 0.58rem;
  color: #64748b;
}

.hiw-laptop-chart-row {
  flex: 1;
  min-height: 0;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
}

.hiw-chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.68rem;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 6px;
}

.hiw-chart-badge {
  font-size: 0.58rem;
  color: var(--primary);
  background: rgba(34, 197, 94, 0.14);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.hiw-chart-svg {
  width: 100%;
  flex: 1;
  min-height: 75px;
  max-height: 105px;
  display: block;
}

/* Base de alumínio chanfrada do laptop */
.hiw-laptop-base {
  width: calc(100% + 54px);
  height: 12px;
  margin: 0 -27px;
  background: linear-gradient(180deg, #253329 0%, #101812 60%, #070d09 100%);
  border-radius: 0 0 14px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.95), 0 2px 4px rgba(0, 0, 0, 0.7);
  position: relative;
  display: flex;
  justify-content: center;
}

.hiw-laptop-notch {
  width: 86px;
  height: 4px;
  background: #050a06;
  border-radius: 0 0 4px 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-top: none;
}

/* ============================================================
   2. TABLET (Integrado, à esquerda, sobreposição realista)
   ============================================================ */
.hiw-device-tablet {
  width: 260px;
  height: 355px;
  bottom: 20px;
  left: calc(50% - 410px);
  z-index: 3;
  transform: rotate(-3.5deg);
  transform-origin: center bottom;
  filter: drop-shadow(0 26px 50px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 20px rgba(34, 197, 94, 0.06));
}

.hiw-tablet-frame {
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, #1b261e 0%, #0c140e 100%);
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  border-radius: 24px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.22);
}

.hiw-tablet-cam {
  width: 5px;
  height: 5px;
  background: #020603;
  border: 1px solid #1e2d22;
  border-radius: 50%;
  margin: 0 auto 5px;
}

.hiw-screen-tablet {
  background: #040a06;
  border-radius: 16px;
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.07);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  position: relative;
  text-align: left;
}

.hiw-tablet-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 7px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.hiw-tablet-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: #ffffff;
  font-family: 'Plus Jakarta Sans', sans-serif;
}

.hiw-tablet-status {
  font-size: 0.58rem;
  color: var(--secondary);
  background: rgba(34, 197, 94, 0.14);
  border: 1px solid rgba(34, 197, 94, 0.26);
  padding: 2px 6px;
  border-radius: 999px;
  font-weight: 600;
}

.hiw-tablet-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.hiw-tablet-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.hiw-tablet-sec-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  color: var(--muted);
}

.hiw-tablet-sec-head strong.is-green {
  color: var(--secondary);
  font-weight: 700;
}

.hiw-prog-bar {
  width: 100%;
  height: 5px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  overflow: hidden;
}

.hiw-prog-fill {
  height: 100%;
  background: linear-gradient(90deg, #15803d, #22c55e);
  border-radius: 999px;
}

.hiw-prog-fill.is-full {
  background: #22c55e;
}

.hiw-tablet-stock {
  margin-top: auto;
  background: rgba(34, 197, 94, 0.06);
  border: 1px dashed rgba(34, 197, 94, 0.3);
  border-radius: 8px;
  padding: 7px 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.62rem;
}

.hiw-stock-label {
  color: #cbd5e1;
  font-weight: 600;
}

.hiw-stock-tag {
  color: var(--secondary);
  font-weight: 700;
}

/* ============================================================
   3. SMARTPHONE (Primeiro plano, à direita, acabamento premium)
   ============================================================ */
.hiw-device-phone {
  width: 185px;
  height: 365px;
  bottom: 0px;
  right: calc(50% - 395px);
  z-index: 4;
  transform: rotate(2.5deg);
  transform-origin: center bottom;
  filter: drop-shadow(0 30px 60px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 20px rgba(34, 197, 94, 0.08));
}

.hiw-phone-frame {
  width: 100%;
  height: 100%;
  background: linear-gradient(160deg, #212e24 0%, #0d1510 100%);
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  border-radius: 32px;
  padding: 7px;
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.28);
}

.hiw-phone-island {
  width: 52px;
  height: 12px;
  background: #000000;
  border-radius: 999px;
  margin: 1px auto 5px;
  z-index: 12;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.hiw-screen-phone {
  background: #040905;
  border-radius: 25px;
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.07);
  padding: 9px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
  position: relative;
  text-align: left;
}

.hiw-phone-top {
  display: flex;
  justify-content: space-between;
  font-size: 0.55rem;
  color: #94a3b8;
  font-weight: 600;
  padding: 0 4px;
}

.hiw-phone-app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.hiw-app-logo {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.68rem;
  color: #ffffff;
}

.hiw-app-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--primary);
}

.hiw-app-live {
  font-size: 0.52rem;
  background: rgba(34, 197, 94, 0.15);
  color: var(--secondary);
  border: 1px solid rgba(34, 197, 94, 0.28);
  padding: 1px 5px;
  border-radius: 999px;
  font-weight: 700;
}

.hiw-phone-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(34, 197, 94, 0.24);
  border-radius: 10px;
  padding: 8px 9px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hiw-card-sub {
  font-size: 0.58rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.hiw-card-num {
  font-size: 1.05rem;
  font-weight: 800;
  color: #ffffff;
  font-family: 'Plus Jakarta Sans', sans-serif;
}

.hiw-card-num small {
  font-size: 0.62rem;
  color: #64748b;
  font-weight: 500;
}

.hiw-card-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.58rem;
  color: var(--secondary);
  margin-top: 1px;
}

.hiw-pulse-mini {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--primary);
}

.hiw-phone-feed {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.hiw-feed-item {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 7px;
  padding: 5px 7px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.hiw-feed-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--primary);
  flex-shrink: 0;
}

.hiw-feed-t {
  font-size: 0.58rem;
  color: #ffffff;
  font-weight: 600;
}

.hiw-feed-s {
  font-size: 0.52rem;
  color: #64748b;
}

.hiw-phone-dock {
  margin-top: auto;
  display: flex;
  justify-content: center;
  gap: 10px;
  font-size: 0.45rem;
  color: rgba(255, 255, 255, 0.2);
  padding-top: 2px;
}

.hiw-phone-dock span.active {
  color: var(--primary);
}

/* ============================================================
   4. NOTIFICAÇÕES ANIMADAS (Efeito Pop saindo de dentro da tela)
   ============================================================ */
.hiw-notif {
  position: absolute;
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 9px;
  background: rgba(8, 18, 12, 0.96);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(34, 197, 94, 0.4);
  border-radius: 12px;
  padding: 8px 12px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.85), 0 0 20px rgba(34, 197, 94, 0.2);
  pointer-events: none;
  white-space: nowrap;
  opacity: 0;
  text-align: left;
}

.hiw-notif-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.16);
  border: 1px solid rgba(34, 197, 94, 0.45);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hiw-notif-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.hiw-notif-title {
  font-size: 0.74rem;
  font-weight: 700;
  color: #ffffff;
  font-family: 'Plus Jakarta Sans', sans-serif;
  letter-spacing: -0.01em;
}

.hiw-notif-desc {
  font-size: 0.64rem;
  color: #94a3b8;
}

.hiw-notif-badge {
  font-size: 0.58rem;
  font-weight: 600;
  color: var(--secondary);
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.3);
  padding: 2px 6px;
  border-radius: 999px;
  margin-left: 3px;
}

/* Pulso de estouro na tela (Screen burst wave) */
.hiw-burst {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--primary);
  pointer-events: none;
  opacity: 0;
  z-index: 20;
}

/* --- Notificação 1: Smartphone ("Nova venda realizada") --- */
.hiw-notif-phone {
  top: 40px;
  left: -65px;
  animation: notifCyclePhone 9s infinite cubic-bezier(0.16, 1, 0.3, 1);
}

.hiw-burst-phone {
  top: 85px;
  left: 15px;
  animation: burstPhone 9s infinite ease-out;
}

@keyframes notifCyclePhone {
  0%, 2% {
    opacity: 0;
    transform: translate(35px, 45px) scale(0.15);
  }
  6% {
    opacity: 1;
    transform: translate(-10px, -20px) scale(1.08);
  }
  10% {
    opacity: 1;
    transform: translate(0, -12px) scale(1);
  }
  11%, 19% {
    opacity: 1;
    transform: translate(0, -17px) scale(1);
  }
  27% {
    opacity: 1;
    transform: translate(0, -10px) scale(1);
  }
  32% {
    opacity: 0;
    transform: translate(0, -24px) scale(0.92);
  }
  33%, 100% {
    opacity: 0;
    transform: translate(35px, 45px) scale(0.15);
  }
}

@keyframes burstPhone {
  0%, 2% { opacity: 0; transform: scale(0.2); }
  4% { opacity: 0.85; transform: scale(1.4); }
  7% { opacity: 0; transform: scale(2.2); }
  8%, 100% { opacity: 0; transform: scale(0.2); }
}

/* --- Notificação 2: Tablet ("Check-in validado") --- */
.hiw-notif-tablet {
  top: 50px;
  right: -55px;
  animation: notifCycleTablet 9s infinite cubic-bezier(0.16, 1, 0.3, 1);
}

.hiw-burst-tablet {
  top: 95px;
  right: 35px;
  animation: burstTablet 9s infinite ease-out;
}

@keyframes notifCycleTablet {
  0%, 33% {
    opacity: 0;
    transform: translate(-25px, 45px) scale(0.15);
  }
  37% {
    opacity: 1;
    transform: translate(12px, -20px) scale(1.08);
  }
  41% {
    opacity: 1;
    transform: translate(0, -12px) scale(1);
  }
  42%, 50% {
    opacity: 1;
    transform: translate(0, -17px) scale(1);
  }
  58% {
    opacity: 1;
    transform: translate(0, -10px) scale(1);
  }
  63% {
    opacity: 0;
    transform: translate(0, -24px) scale(0.92);
  }
  64%, 100% {
    opacity: 0;
    transform: translate(-25px, 45px) scale(0.15);
  }
}

@keyframes burstTablet {
  0%, 33% { opacity: 0; transform: scale(0.2); }
  35% { opacity: 0.85; transform: scale(1.4); }
  38% { opacity: 0; transform: scale(2.2); }
  39%, 100% { opacity: 0; transform: scale(0.2); }
}

/* --- Notificação 3: Notebook ("Atualização de faturamento") --- */
.hiw-notif-laptop {
  top: 10px;
  right: 40px;
  animation: notifCycleLaptop 9s infinite cubic-bezier(0.16, 1, 0.3, 1);
}

.hiw-burst-laptop {
  top: 75px;
  right: 130px;
  animation: burstLaptop 9s infinite ease-out;
}

@keyframes notifCycleLaptop {
  0%, 65% {
    opacity: 0;
    transform: translate(-10px, 45px) scale(0.15);
  }
  69% {
    opacity: 1;
    transform: translate(14px, -20px) scale(1.08);
  }
  73% {
    opacity: 1;
    transform: translate(0, -12px) scale(1);
  }
  74%, 82% {
    opacity: 1;
    transform: translate(0, -17px) scale(1);
  }
  90% {
    opacity: 1;
    transform: translate(0, -10px) scale(1);
  }
  95% {
    opacity: 0;
    transform: translate(0, -24px) scale(0.92);
  }
  96%, 100% {
    opacity: 0;
    transform: translate(-10px, 45px) scale(0.15);
  }
}

@keyframes burstLaptop {
  0%, 65% { opacity: 0; transform: scale(0.2); }
  67% { opacity: 0.85; transform: scale(1.4); }
  70% { opacity: 0; transform: scale(2.2); }
  71%, 100% { opacity: 0; transform: scale(0.2); }
}

/* ============================================================
   RESPONSIVIDADE E ACESSIBILIDADE
   ============================================================ */
@media (max-width: 1080px) {
  .hiw-stage {
    transform: scale(0.88);
    transform-origin: center bottom;
    height: 440px;
  }
}

@media (max-width: 900px) {
  .how-it-works {
    padding: 40px 18px 45px;
  }
  .hiw-stage {
    transform: scale(0.74);
    transform-origin: center bottom;
    height: 380px;
    margin-top: 5px;
  }
  .hiw-device-tablet {
    left: calc(50% - 350px);
  }
  .hiw-device-phone {
    right: calc(50% - 330px);
  }
}

@media (max-width: 680px) {
  .how-it-works {
    padding: 35px 16px 40px;
  }
  .hiw-stage {
    transform: scale(0.56);
    transform-origin: center bottom;
    height: 300px;
    margin-top: 0;
  }
  .hiw-device-tablet {
    left: calc(50% - 290px);
  }
  .hiw-device-phone {
    right: calc(50% - 270px);
  }
}

@media (max-width: 440px) {
  .hiw-stage {
    transform: scale(0.44);
    transform-origin: center bottom;
    height: 240px;
  }
  .hiw-device-tablet {
    left: calc(50% - 240px);
  }
  .hiw-device-phone {
    right: calc(50% - 230px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hiw-notif-phone,
  .hiw-notif-tablet,
  .hiw-notif-laptop {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .hiw-burst {
    display: none;
  }
}

`;

if (!oldCssRegex.test(css)) {
  console.error('Regex did not match in css/brand-story.css');
  process.exit(1);
}

css = css.replace(oldCssRegex, newCss.replace(/\n/g, '\r\n'));
fs.writeFileSync(cssPath, css, 'utf8');
console.log('css/brand-story.css updated successfully!');
