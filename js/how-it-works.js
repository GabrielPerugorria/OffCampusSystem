/* ============================================================
   Seção "Como funciona" — ciclo das notificações que emergem das
   telas. Usa apenas a Web Animations API (sem dependências):
   - entrada com impulso e expansão a partir da borda da tela;
   - flutuação suave enquanto visível;
   - saída discreta antes de reiniciar o ciclo;
   - pausa quando a seção sai da tela ou a aba fica oculta;
   - respeita prefers-reduced-motion (notificações ficam estáticas).
   ============================================================ */
(function () {
  'use strict';

  var stage = document.getElementById('hiw-stage');
  if (!stage || typeof stage.animate !== 'function') return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce && reduce.matches) return; // CSS já mantém as notificações visíveis

  var notifs = {
    tablet: stage.querySelector('.hiw-notif-tablet'),
    phone: stage.querySelector('.hiw-notif-phone'),
    laptop: stage.querySelector('.hiw-notif-laptop')
  };
  if (!notifs.tablet || !notifs.phone || !notifs.laptop) return;

  /* Quando cada notificação entra e sai (ms), dentro de um ciclo de 12s.
     Desktop: entradas escalonadas com leve sobreposição.
     Mobile: uma notificação por vez, para nunca cobrirem umas às outras.
     Todas já saíram antes do reinício. */
  var CYCLE = 12000;
  var compact = window.matchMedia ? window.matchMedia('(max-width: 760px)') : { matches: false };

  function buildSchedule() {
    var t = compact.matches
      ? { tablet: [600, 3600], phone: [4200, 7200], laptop: [7800, 10800] }
      : { tablet: [600, 5200], phone: [3000, 7600], laptop: [5400, 10200] };
    return [
      { el: notifs.tablet, from: { x: 18, y: 22 },  enter: t.tablet[0], exit: t.tablet[1] },
      { el: notifs.phone,  from: { x: -14, y: 26 }, enter: t.phone[0],  exit: t.phone[1] },
      { el: notifs.laptop, from: { x: 0, y: 24 },   enter: t.laptop[0], exit: t.laptop[1] }
    ];
  }

  var running = false;
  var timers = [];
  var anims = [];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function track(a) { anims.push(a); return a; }

  function enter(item) {
    var el = item.el;
    var card = el.firstElementChild;
    /* deslocamento inicial em % da própria largura/altura: parece sair da tela */
    var fx = item.from.x + '%';
    var fy = item.from.y + '%';

    track(el.animate([
      { opacity: 0, transform: 'translate(' + fx + ',' + fy + ') scale(0.55)' },
      { opacity: 1, transform: 'translate(0,0) scale(1)' }
    ], {
      duration: 780,
      easing: 'cubic-bezier(0.2, 0.9, 0.25, 1.28)', // leve impulso além do ponto final
      fill: 'forwards'
    }));

    /* flutuação suave após aparecer */
    later(function () {
      if (!running) return;
      track(card.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(-5px)' },
        { transform: 'translateY(0)' }
      ], { duration: 4200, iterations: Infinity, easing: 'ease-in-out' }));
    }, 780);
  }

  function exit(item) {
    var el = item.el;
    var card = el.firstElementChild;
    track(el.animate([
      { opacity: 1, transform: 'translate(0,0) scale(1)' },
      { opacity: 0, transform: 'translate(0,-6px) scale(0.97)' }
    ], { duration: 520, easing: 'ease-in', fill: 'forwards' }));
    later(function () {
      // encerra a flutuação desta notificação depois que ela sumiu
      card.getAnimations().forEach(function (a) { a.cancel(); });
    }, 540);
  }

  function clearAll() {
    timers.forEach(clearTimeout);
    timers = [];
    anims.forEach(function (a) { try { a.cancel(); } catch (e) { } });
    anims = [];
    Object.keys(notifs).forEach(function (k) {
      notifs[k].getAnimations().forEach(function (a) { a.cancel(); });
      notifs[k].firstElementChild.getAnimations().forEach(function (a) { a.cancel(); });
    });
  }

  function runCycle() {
    if (!running) return;
    anims = anims.filter(function (a) { return a.playState === 'running'; });
    buildSchedule().forEach(function (item) {
      later(function () { if (running) enter(item); }, item.enter);
      later(function () { if (running) exit(item); }, item.exit);
    });
    later(runCycle, CYCLE);
  }

  function start() {
    if (running) return;
    running = true;
    runCycle();
  }

  function stop() {
    running = false;
    clearAll();
  }

  stage.classList.add('is-animated'); // notificações começam ocultas e entram pelo ciclo

  /* Só anima enquanto a composição está visível e a aba está ativa */
  var visible = false;
  function sync() {
    if (visible && !document.hidden) start(); else stop();
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.25 }).observe(stage);
  } else {
    visible = true;
    sync();
  }

  document.addEventListener('visibilitychange', sync);

  /* Se o usuário ativar "reduzir movimento" durante a navegação */
  if (reduce && reduce.addEventListener) {
    reduce.addEventListener('change', function () {
      if (reduce.matches) {
        stop();
        stage.classList.remove('is-animated');
      } else {
        stage.classList.add('is-animated');
        sync();
      }
    });
  }
})();
