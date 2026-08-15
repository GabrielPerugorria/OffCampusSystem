/* ============================================================
   BRAND STORY — animações de entrada (scroll reveal) e contadores
   animados do dashboard ao vivo. Isolado do main.js para não
   interferir no restante da aplicação; falha graciosamente se
   IntersectionObserver não existir.
   ============================================================ */
(function () {
  'use strict';

  const revealTargets = document.querySelectorAll('.reveal, [data-reveal-group]');

  if (!revealTargets.length) return;

  if (!('IntersectionObserver' in window)) {
    revealTargets.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -60px 0px' });

  revealTargets.forEach(el => io.observe(el));

  /* ── Contadores animados do painel "Dashboard ao vivo" ── */
  const counters = document.querySelectorAll('[data-count-to]');
  if (counters.length && 'IntersectionObserver' in window) {
    const countIo = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        countIo.unobserve(el);
        const target = parseFloat(el.getAttribute('data-count-to'));
        const prefix = el.getAttribute('data-count-prefix') || '';
        const suffix = el.getAttribute('data-count-suffix') || '';
        const decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
        const duration = 1400;
        const start = performance.now();

        function tick(now) {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          const value = target * eased;
          el.textContent = prefix + value.toLocaleString('pt-BR', {
            minimumFractionDigits: decimals, maximumFractionDigits: decimals
          }) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });

    counters.forEach(el => countIo.observe(el));
  }
})();
