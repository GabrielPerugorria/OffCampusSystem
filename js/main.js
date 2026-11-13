'use strict';

/* ── XSS Protection Utilities ── */
function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeURL(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;
  // Allow relative paths (no protocol) for local assets.
  // Rejeita "//host/..." (protocol-relative, carregaria de outro domínio).
  if (/^[a-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/i.test(s) && !s.includes(':') && !s.startsWith('//')) return s;
  return '';
}

/* Converte para número finito; qualquer outra coisa vira o fallback.
   Garante que valores vindos da API nunca levem texto para os templates. */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* ============================================================
   HEADER — scroll, progress, active link
   ============================================================ */
const header = document.getElementById('mainHeader');
const progressBar = document.getElementById('progressBar');
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const menu = document.querySelector('.menu');
const menuLinks = menu ? Array.from(menu.querySelectorAll('a')) : [];

const state = { activeLink: menu?.querySelector('a.active') || menuLinks[0] };

// Filter only links pointing to real sections
const sectionLinks = menuLinks.filter(link => {
    const href = link.getAttribute('href');
    return href && href.startsWith('#') && href.length > 1 && document.querySelector(href);
});
const sectionTargets = sectionLinks.map(link => document.querySelector(link.getAttribute('href')));

// Nav indicator (active pill)
const updateIndicator = (link) => {
    if (!link || !menu) return;
    const menuRect = menu.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    menu.style.setProperty('--menu-indicator-left', `${linkRect.left - menuRect.left}px`);
    menu.style.setProperty('--menu-indicator-width', `${linkRect.width}px`);
    menu.classList.add('indicator-ready');
};
const refreshIndicator = () => requestAnimationFrame(() => updateIndicator(state.activeLink));

// Active link on scroll
const updateActiveLinkOnScroll = () => {
    const scrollPos = window.scrollY + window.innerHeight * 0.2;
    let current = sectionLinks[0];
    sectionTargets.forEach((section, i) => {
        if (section && scrollPos >= section.offsetTop) current = sectionLinks[i];
    });
    if (current && current !== state.activeLink) {
        state.activeLink?.classList.remove('active');
        current.classList.add('active');
        state.activeLink = current;
        refreshIndicator();
    }
};

window.addEventListener('load', () => { refreshIndicator(); updateActiveLinkOnScroll(); });
window.addEventListener('resize', () => { refreshIndicator(); updateActiveLinkOnScroll(); });

window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 50);
    const total = document.documentElement.scrollHeight - window.innerHeight;
    if (total > 0 && progressBar) progressBar.style.width = `${(window.scrollY / total) * 100}%`;
    updateActiveLinkOnScroll();
}, { passive: true });

// Hamburger
function closeMobileMenu(returnFocus) {
    if (!mobileMenu.classList.contains('open')) return;
    if (mobileMenu.contains(document.activeElement)) document.activeElement.blur();
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', false);
    mobileMenu.setAttribute('aria-hidden', true);
    document.body.classList.remove('nav-open');
    if (returnFocus) hamburger.focus();
}

hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !mobileMenu.classList.contains('open');
    if (open) {
        mobileMenu.classList.add('open');
        hamburger.classList.add('active');
        hamburger.setAttribute('aria-expanded', true);
        mobileMenu.setAttribute('aria-hidden', false);
        document.body.classList.add('nav-open');
    } else {
        closeMobileMenu(false);
    }
});

document.addEventListener('click', (e) => {
    if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
        closeMobileMenu(false);
    }
});

// Close mobile menu on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        closeMobileMenu(true);
    }
});

// Desktop menu link clicks
menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
            e.preventDefault();
            if (href === '#' || href === '#hero') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const target = document.querySelector(href);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
        if (state.activeLink !== link) {
            state.activeLink?.classList.remove('active');
            link.classList.add('active');
            state.activeLink = link;
            refreshIndicator();
        }
    });
});

// Mobile menu link clicks
mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        closeMobileMenu(false);
    });
});

// Smooth scroll for all anchor links
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.length > 1) {
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });
});

if (window.ResizeObserver && menu) {
    new ResizeObserver(refreshIndicator).observe(menu);
}


/* ============================================================
   CAROUSEL
   ============================================================ */
const carousel = document.querySelector('.banner-carousel');
const slider = document.querySelector('.banner-list');
const slides = Array.from(document.querySelectorAll('.banner-slide'));
const dots = Array.from(document.querySelectorAll('.banner-dot'));
const prevButton = document.querySelector('.banner-arrow.prev');
const nextButton = document.querySelector('.banner-arrow.next');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let currentSlide = 0;
let autoplayTimer = null;
let interactionTimer = null;
let isUserInteracting = false;
let isPointerDown = false;
let dragStartX = 0;
let dragDeltaX = 0;
const SLIDE_COUNT = slides.length;
const AUTOPLAY_DELAY = 4000;
const SWIPE_THRESHOLD = 60;
const DRAG_THRESHOLD = 8;

const setActiveSlide = (index) => {
    const next = ((index % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
    slides.forEach((slide, i) => {
        const active = i === next;
        slide.classList.toggle('active', active);
        slide.setAttribute('aria-hidden', String(!active));
        slide.tabIndex = active ? 0 : -1;
    });
    dots.forEach((dot, i) => {
        const selected = i === next;
        dot.classList.toggle('active', selected);
        dot.setAttribute('aria-selected', String(selected));
        dot.tabIndex = selected ? 0 : -1;
    });
    currentSlide = next;
};

const stopAutoplay = () => { clearInterval(autoplayTimer); autoplayTimer = null; };
const startAutoplay = () => {
    if (SLIDE_COUNT < 2 || document.hidden || reduceMotion) return;
    stopAutoplay();
    autoplayTimer = setInterval(() => showSlide(currentSlide + 1), AUTOPLAY_DELAY);
};

const holdInteraction = () => {
    stopAutoplay();
    isUserInteracting = true;
    clearTimeout(interactionTimer);
};

const releaseInteraction = (delay = 1400) => {
    clearTimeout(interactionTimer);
    interactionTimer = setTimeout(() => {
        isUserInteracting = false;
        if (!document.hidden) scheduleAutoplay();
    }, delay);
};

const scheduleAutoplay = () => {
    if (autoplayTimer || isUserInteracting || SLIDE_COUNT < 2 || document.hidden) return;
    startAutoplay();
};

const clearSliderOffset = () => {
    if (!slider) return;
    slider.style.transition = '';
    slider.style.transform = '';
};

const showSlide = (index) => {
    setActiveSlide(index);
    clearSliderOffset();
    if (!isUserInteracting) scheduleAutoplay();
};

// Pointer drag (touch)
const onPointerDown = (e) => {
    if (!slider || SLIDE_COUNT < 2) return;
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    if (e.target.closest('button, a')) return;
    e.preventDefault();
    holdInteraction();
    isPointerDown = true;
    dragStartX = e.clientX;
    dragDeltaX = 0;
    slider.style.transition = 'none';
    carousel.setPointerCapture?.(e.pointerId);
    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
};

const onPointerMove = (e) => {
    if (!isPointerDown) return;
    dragDeltaX = e.clientX - dragStartX;
    if (Math.abs(dragDeltaX) > DRAG_THRESHOLD) {
        e.preventDefault();
        if (slider) slider.style.transform = `translateX(${dragDeltaX}px)`;
    }
};

const onPointerUp = (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    carousel.releasePointerCapture?.(e?.pointerId);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
    if (Math.abs(dragDeltaX) > SWIPE_THRESHOLD) {
        dragDeltaX < 0 ? showSlide(currentSlide + 1) : showSlide(currentSlide - 1);
    } else {
        if (slider) {
            slider.style.transition = 'transform .24s cubic-bezier(.22,.61,.36,1)';
            slider.style.transform = '';
            setTimeout(() => { if (slider) { slider.style.transition = ''; } }, 260);
        }
    }
    releaseInteraction();
};

const initCarousel = () => {
    if (!carousel || SLIDE_COUNT === 0) return;
    setActiveSlide(0);

    carousel.addEventListener('pointerenter', () => holdInteraction());
    carousel.addEventListener('pointerleave', () => releaseInteraction(900));
    carousel.addEventListener('pointerdown', onPointerDown, { passive: false });

    carousel.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); holdInteraction(); showSlide(currentSlide + 1); releaseInteraction(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); holdInteraction(); showSlide(currentSlide - 1); releaseInteraction(); }
    });

    prevButton?.addEventListener('click', () => { holdInteraction(); showSlide(currentSlide - 1); releaseInteraction(); });
    nextButton?.addEventListener('click', () => { holdInteraction(); showSlide(currentSlide + 1); releaseInteraction(); });

    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => { holdInteraction(); showSlide(i); releaseInteraction(); });
    });

    document.addEventListener('visibilitychange', () => {
        document.hidden ? stopAutoplay() : releaseInteraction(400);
    });

    scheduleAutoplay();
};

initCarousel();


/* ============================================================
   BRAZIL MAP
   ============================================================ */
const brazilContainer = document.getElementById('brazilContainer');
const brazilInner = document.getElementById('brazilInner');
const brazilSvg = document.getElementById('brazilSvg');
const brazilOverlay = document.getElementById('brazilOverlay');
const brazilStatsList = document.getElementById('brazilStatsList');

if (brazilContainer && brazilSvg && brazilOverlay) {
    const ns = 'http://www.w3.org/2000/svg';
    let bTime = 0;
    let targetRotX = 0, targetRotY = 0;
    let currentRotX = 0, currentRotY = 0;
    let bMouseX = 0.5, bMouseY = 0.5;

    const MAP_W = 613, MAP_H = 639;
    const MIN_LON = -73.98, MAX_LON = -34.79;
    const MIN_LAT = -33.75, MAX_LAT = 5.27;

    const geoToSvg = (lat, lon) => ({
        x: (lon - MIN_LON) / (MAX_LON - MIN_LON) * MAP_W,
        y: (MAX_LAT - lat) / (MAX_LAT - MIN_LAT) * MAP_H,
    });

    const cities = [
        { name: 'Porto Alegre', lat: -30.0346, lon: -51.2177, events: 38, category: 'Corporativos e Feiras' },
        { name: 'Caxias do Sul', lat: -29.1678, lon: -51.1794, events: 22, category: 'Festivais e Shows' },
        { name: 'Novo Hamburgo', lat: -29.6783, lon: -51.1304, events: 15, category: 'Eventos Corporativos' },
        { name: 'Pelotas', lat: -31.7654, lon: -52.3376, events: 12, category: 'Feiras e Exposições' },
        { name: 'Santa Maria', lat: -29.6842, lon: -53.8069, events: 18, category: 'Eventos Acadêmicos' },
        { name: 'Florianópolis', lat: -27.5949, lon: -48.5482, events: 45, category: 'Congressos e Feiras' },
        { name: 'Joinville', lat: -26.3044, lon: -48.8487, events: 28, category: 'Festivais Culturais' },
        { name: 'Blumenau', lat: -26.9187, lon: -49.066, events: 20, category: 'Oktoberfest e Feiras' },
        { name: 'Chapecó', lat: -27.1004, lon: -52.6152, events: 14, category: 'Eventos Agropecuários' },
        { name: 'Balneário Camboriú', lat: -26.9926, lon: -48.6352, events: 19, category: 'Shows e Eventos VIP' },
    ].map(c => ({ ...c, ...geoToSvg(c.lat, c.lon) }));

    // Connection lines
    for (let i = 0; i < cities.length; i++) {
        for (let j = i + 1; j < cities.length; j++) {
            const dx = cities[i].x - cities[j].x;
            const dy = cities[i].y - cities[j].y;
            if (Math.sqrt(dx * dx + dy * dy) < 42) {
                const line = document.createElementNS(ns, 'line');
                line.setAttribute('x1', cities[i].x); line.setAttribute('y1', cities[i].y);
                line.setAttribute('x2', cities[j].x); line.setAttribute('y2', cities[j].y);
                line.classList.add('brazil-line');
                brazilOverlay.appendChild(line);
            }
        }
    }

    // Pulse lines
    for (let k = 0; k < 3; k++) {
        const idx = Math.floor(Math.random() * cities.length);
        const jdx = (idx + 1 + Math.floor(Math.random() * 3)) % cities.length;
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', cities[idx].x); line.setAttribute('y1', cities[idx].y);
        line.setAttribute('x2', cities[jdx].x); line.setAttribute('y2', cities[jdx].y);
        line.classList.add('brazil-line', 'pulse');
        line.style.animationDelay = `${k * 1.2}s`;
        brazilOverlay.appendChild(line);
    }

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'brazil-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);

    const showTip = (e, city) => {
        tooltip.innerHTML = `
      <div class="tt-city">${escapeHTML(city.name)}</div>
      <div class="tt-events">${city.events} eventos realizados</div>
      <div class="tt-category">${escapeHTML(city.category)}</div>
    `;
        tooltip.classList.add('visible');
        moveTip(e);
    };
    const hideTip = () => tooltip.classList.remove('visible');
    const moveTip = (e) => {
        const pad = 18;
        let x = e.clientX + pad, y = e.clientY + pad;
        const tr = tooltip.getBoundingClientRect();
        if (x + tr.width > window.innerWidth - pad) x = e.clientX - tr.width - pad;
        if (y + tr.height > window.innerHeight - pad) y = e.clientY - tr.height - pad;
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    };

    // City markers
    cities.forEach((city, idx) => {
        const g = document.createElementNS(ns, 'g');
        g.classList.add('brazil-city');
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-label', `${city.name}: ${city.events} eventos`);

        const ring = document.createElementNS(ns, 'circle');
        ring.setAttribute('cx', city.x); ring.setAttribute('cy', city.y);
        ring.setAttribute('r', 11); ring.classList.add('brazil-city-ring');

        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', city.x); dot.setAttribute('cy', city.y);
        dot.setAttribute('r', 3); dot.classList.add('brazil-city-dot');
        dot.style.animationDelay = `${idx * 0.28}s`;

        const kf = document.createElementNS(ns, 'style');
        kf.textContent = `
      .brazil-city:nth-child(${idx + 4}) .brazil-city-dot {
        animation: bcp${idx} 2.6s ease-in-out infinite;
      }
      @keyframes bcp${idx} {
        0%, 100% { r: 3; opacity: .7; }
        50%       { r: 4.5; opacity: 1; filter: drop-shadow(0 0 10px rgba(34,197,94,.8)); }
      }
    `;

        g.appendChild(kf); g.appendChild(ring); g.appendChild(dot);
        brazilOverlay.appendChild(g);

        g.addEventListener('mouseenter', (e) => showTip(e, city));
        g.addEventListener('mouseleave', hideTip);
        g.addEventListener('mousemove', moveTip);
        g.addEventListener('focus', (e) => showTip(e, city));
        g.addEventListener('blur', hideTip);

        // Stats list
        if (brazilStatsList) {
            const item = document.createElement('div');
            item.className = 'brazil-stats-item';
            item.innerHTML = `
        <span class="brazil-stats-city"><span class="brazil-stats-dot"></span>${escapeHTML(city.name)}</span>
        <span class="brazil-stats-count">${city.events}</span>
      `;
            brazilStatsList.appendChild(item);

            item.addEventListener('mouseenter', () => { dot.setAttribute('r', 5); ring.style.opacity = '1'; });
            item.addEventListener('mouseleave', () => { dot.setAttribute('r', 3); ring.style.opacity = ''; });
        }
    });

    // Parallax
    brazilContainer.addEventListener('mousemove', (e) => {
        const rect = brazilContainer.getBoundingClientRect();
        bMouseX = (e.clientX - rect.left) / rect.width;
        bMouseY = (e.clientY - rect.top) / rect.height;
    });
    brazilContainer.addEventListener('mouseleave', () => { bMouseX = 0.5; bMouseY = 0.5; });

    const animateBrazil = () => {
        bTime += 0.016;
        const autoRot = Math.sin(bTime * 0.005) * 1.8;
        targetRotX = (bMouseY - 0.5) * -6;
        targetRotY = (bMouseX - 0.5) * 8 + autoRot;
        currentRotX += (targetRotX - currentRotX) * 0.06;
        currentRotY += (targetRotY - currentRotY) * 0.06;
        if (brazilInner) {
            brazilInner.style.transform = `rotateX(${currentRotX}deg) rotateY(${currentRotY}deg)`;
        }
        requestAnimationFrame(animateBrazil);
    };
    animateBrazil();

    // Zoom south
    const ZOOM_FULL = { x: 0, y: 0, w: 613, h: 639 };
    const ZOOM_SOUTH = { x: 215, y: 450, w: 220, h: 210 };

    const lerpViewBox = (from, to, duration, cb) => {
        const start = performance.now();
        const step = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const e = 1 - Math.pow(1 - t, 3);
            brazilSvg.setAttribute('viewBox',
                `${from.x + (to.x - from.x) * e} ${from.y + (to.y - from.y) * e} ${from.w + (to.w - from.w) * e} ${from.h + (to.h - from.h) * e}`
            );
            if (t < 1) requestAnimationFrame(step);
            else if (cb) cb();
        };
        requestAnimationFrame(step);
    };

    if (!reduceMotion) {
        setTimeout(() => {
            lerpViewBox(ZOOM_FULL, ZOOM_SOUTH, 1100, () => {
                brazilContainer.addEventListener('mouseenter', () => {
                    lerpViewBox(ZOOM_SOUTH, ZOOM_FULL, 500);
                }, { once: true });
            });
        }, 2800);
    }
}


/* ============================================================
   PARTICLES
   ============================================================ */
const pCanvas = document.getElementById('particlesCanvas');
if (pCanvas && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const pCtx = pCanvas.getContext('2d');
    let particles = [];
    const P_COUNT = 36;

    const resizeParticles = () => {
        const hero = pCanvas.parentElement;
        pCanvas.width = hero.offsetWidth;
        pCanvas.height = hero.offsetHeight;
    };

    const initParticles = () => {
        resizeParticles();
        particles = Array.from({ length: P_COUNT }, () => ({
            x: Math.random() * pCanvas.width,
            y: Math.random() * pCanvas.height,
            vx: (Math.random() - 0.5) * 0.28,
            vy: (Math.random() - 0.5) * 0.28 - 0.08,
            r: Math.random() * 1.4 + 0.4,
            a: Math.random() * 0.28 + 0.08,
        }));
    };

    const drawParticles = () => {
        pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = pCanvas.width;
            if (p.x > pCanvas.width) p.x = 0;
            if (p.y < 0) p.y = pCanvas.height;
            if (p.y > pCanvas.height) p.y = 0;
            pCtx.fillStyle = `rgba(34,197,94,${p.a})`;
            pCtx.beginPath();
            pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            pCtx.fill();
        });
        requestAnimationFrame(drawParticles);
    };

    window.addEventListener('resize', resizeParticles, { passive: true });
    initParticles();
    drawParticles();
}


/* ============================================================
   MÓDULOS — TABS
   ============================================================ */
const modTabs = Array.from(document.querySelectorAll('.mod-tab'));
const modPanels = Array.from(document.querySelectorAll('.mod-panel'));

modTabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
        modTabs.forEach((t, j) => {
            const active = j === i;
            t.classList.toggle('active', active);
            t.setAttribute('aria-selected', active);
            t.tabIndex = active ? 0 : -1;
        });
        modPanels.forEach((panel, j) => {
            const active = j === i;
            panel.classList.toggle('active', active);
            if (active) panel.removeAttribute('hidden');
            else panel.setAttribute('hidden', '');
        });
    });

    // Keyboard nav for tabs
    tab.addEventListener('keydown', (e) => {
        let nextIdx = i;
        if (e.key === 'ArrowRight') nextIdx = (i + 1) % modTabs.length;
        if (e.key === 'ArrowLeft') nextIdx = (i - 1 + modTabs.length) % modTabs.length;
        if (nextIdx !== i) {
            e.preventDefault();
            modTabs[nextIdx].click();
            modTabs[nextIdx].focus();
        }
    });
});


/* ============================================================
   FORM VALIDATION
   ============================================================ */
const form = document.querySelector('.contato-form');
const formSuccess = document.getElementById('formSuccess');

const MASKS = {
    telefone: (v) => {
        v = v.replace(/\D/g, '').slice(0, 11);
        if (v.length > 10) return v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        if (v.length > 6) return v.replace(/^(\d{2})(\d{4})(\d*)$/, '($1) $2-$3');
        if (v.length > 2) return v.replace(/^(\d{2})(\d*)$/, '($1) $2');
        return v;
    },
};

const telefoneInput = document.getElementById('telefone');
if (telefoneInput) {
    telefoneInput.addEventListener('input', (e) => {
        const pos = e.target.selectionStart;
        const raw = e.target.value.replace(/\D/g, '');
        e.target.value = MASKS.telefone(raw);
        // keep caret reasonable
        try { e.target.setSelectionRange(pos, pos); } catch (_) { }
    });
}

const validators = {
    nome: (v) => v.trim().length >= 3 ? '' : 'Por favor, informe seu nome completo.',
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'E-mail inválido.',
    telefone: (v) => v.replace(/\D/g, '').length >= 10 ? '' : 'Informe um telefone válido com DDD.',
};

const showError = (fieldId, msg) => {
    const input = document.getElementById(fieldId);
    const errEl = document.getElementById(`${fieldId}-error`);
    if (!input || !errEl) return;
    errEl.textContent = msg;
    if (msg) input.classList.add('error');
    else input.classList.remove('error');
};

if (form) {
    // Live validation on blur
    Object.keys(validators).forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('blur', () => {
                showError(id, validators[id](input.value));
            });
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) showError(id, validators[id](input.value));
            });
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        let valid = true;

        Object.entries(validators).forEach(([id, fn]) => {
            const input = document.getElementById(id);
            if (!input) return;
            const err = fn(input.value);
            showError(id, err);
            if (err) valid = false;
        });

        if (!valid) {
            // Focus first error
            const firstError = form.querySelector('.error');
            firstError?.focus();
            return;
        }

        // Simulate submission
        const submitBtn = form.querySelector('[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando…';

        setTimeout(() => {
            form.reset();
            submitBtn.disabled = false;
            submitBtn.textContent = 'Solicitar Acesso';
            if (formSuccess) {
                formSuccess.hidden = false;
                requestAnimationFrame(() => formSuccess.classList.add('visible'));
                formSuccess.focus();
                clearTimeout(formSuccess._hideTimer);
                formSuccess._hideTimer = setTimeout(() => {
                    formSuccess.classList.remove('visible');
                    setTimeout(() => { formSuccess.hidden = true; }, 320);
                }, 6000);
            }
        }, 1200);
    });
}

/* ============================================================
   EVOTECH MVP — AUTH, MODALS, DASHBOARD, COMPRA
   ============================================================ */

/* ---------- DATA ---------- */
// Catálogo de eventos. Antes era um array fixo neste arquivo; agora é
// preenchido por GET /api/public/events. O FORMATO dos objetos foi mantido
// para que todas as telas e funções existentes continuem funcionando.
let EVENTOS = [];

// Imagens dos banners ficam no frontend (são assets do repositório).
// O banner_url do banco tem prioridade quando estiver preenchido.
const IMAGENS_EVENTO = {
    'OFFCampus na Copa': 'imagens/offcampushexa.png',
    'Resenha do Portes': 'imagens/resenhadoportes.png',
    'Halloween OffCampus': 'imagens/halloween.png',
};

function formatarDataEvento(iso) {
    if (!iso) return 'EM BREVE';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'EM BREVE';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function mapearEvento(ev) {
    return {
        id: ev.id,
        slug: ev.slug,
        nome: String(ev.name ?? ''),
        tipo: String(ev.type || 'Evento'),
        data: formatarDataEvento(ev.eventDate),
        local: String(ev.venue || ''),
        img: String(ev.bannerUrl || IMAGENS_EVENTO[ev.name] || 'imagens/offcampushexa.png'),
        desc: String(ev.description || ''),
        regras: String(ev.rules || ''),
        lotes: (ev.batches || []).map(b => ({
            id: b.id,
            nome: String(b.name ?? ''),
            preco: num(b.price),
            disponivel: num(b.available),
            total: num(b.quantityTotal),
        })),
    };
}

async function carregarEventos() {
    try {
        const data = await EvoAPI.get('/public/events');
        EVENTOS = data.map(mapearEvento);
    } catch (err) {
        // Sem API no ar, a landing page continua navegável; apenas a compra
        // fica indisponível — e o usuário é avisado, em vez de ver dados falsos.
        EVENTOS = [];
        console.warn('Não foi possível carregar os eventos:', err.message);
    }
    return EVENTOS;
}

/* ---------- SESSÃO ---------- */
/* Os dados de negócio saíram do localStorage. O que fica no navegador são
   apenas os tokens da sessão, gerenciados por js/api.js. */
const getSession = () => EvoAPI.session();
const clearSession = () => EvoAPI.store.clearAuth();

// Mostra o erro da API no campo correspondente do formulário.
function aplicarErro(inputId, mensagem) {
    const input = document.getElementById(inputId);
    const alvo = document.getElementById(inputId + '-error');
    if (mensagem) {
        input?.classList.add('error');
        if (alvo) alvo.textContent = mensagem;
    } else {
        input?.classList.remove('error');
        if (alvo) alvo.textContent = '';
    }
}

function ocupado(botao, ocupadoEstado, textoOriginal) {
    if (!botao) return;
    botao.disabled = ocupadoEstado;
    if (ocupadoEstado) {
        botao.dataset.textoOriginal = botao.textContent;
        botao.textContent = 'Aguarde…';
    } else {
        botao.textContent = textoOriginal || botao.dataset.textoOriginal || botao.textContent;
    }
}

/* ---------- MODAL ENGINE ---------- */
const overlay = document.getElementById('modalOverlay');
const modals = {
    login: document.getElementById('modalLogin'),
    cadastro: document.getElementById('modalCadastro'),
    recuperar: document.getElementById('modalRecuperar'),
    participante: document.getElementById('modalParticipante'),
    evento: document.getElementById('modalEvento'),
    compra: document.getElementById('modalCompra'),
};

let activeModal = null;
let modalTrigger = null; // element to return focus to on close
let pendingCloseTimer = null;
let pendingSwitchTimer = null;
const FOCUSABLE_SEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(e) {
    if (e.key !== 'Tab' || !activeModal) return;
    const modal = modals[activeModal];
    const focusables = Array.from(modal.querySelectorAll(FOCUSABLE_SEL)).filter(el => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}

const ModalScrollLock = {
    savedScrollY: 0,
    lockCount: 0,
    lock() {
        this.lockCount += 1;
        if (this.lockCount > 1) return;
        this.savedScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.savedScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
        document.documentElement.classList.add('modal-open');
        document.body.classList.add('modal-open');
    },
    unlock() {
        if (this.lockCount <= 0) return;
        this.lockCount -= 1;
        if (this.lockCount > 0) return;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
        window.scrollTo({
            top: this.savedScrollY,
            left: 0,
            behavior: 'instant'
        });
    }
};

function openModal(name) {
    if (!modals[name]) return;
    
    if (pendingCloseTimer) {
        clearTimeout(pendingCloseTimer);
        pendingCloseTimer = null;
    }
    if (pendingSwitchTimer) {
        clearTimeout(pendingSwitchTimer);
        pendingSwitchTimer = null;
    }

    const prevActive = activeModal;

    // Remember what had focus so we can restore it when the modal closes.
    // If we're switching between modals while the overlay is already open
    // (e.g. login -> cadastro), keep the original trigger instead.
    if (!overlay.classList.contains('open')) {
        modalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        ModalScrollLock.lock();
    }

    const showNewModal = () => {
        Object.entries(modals).forEach(([key, m]) => {
            if (!m) return;
            if (key === name) {
                m.style.display = 'flex';
                // Force layout reflow
                m.offsetHeight;
                m.classList.add('visible');
            } else {
                m.classList.remove('visible');
                m.style.display = 'none';
            }
        });

        overlay.removeAttribute('aria-hidden');
        overlay.classList.add('open');
        activeModal = name;
        document.documentElement.classList.add('modal-open');
        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';
        if (modals[name]) {
            modals[name].querySelectorAll('input[disabled]').forEach(inp => inp.disabled = false);
            modals[name].scrollTop = 0;
        }
        document.addEventListener('keydown', trapFocus, true);

        // Focus first input/control once the modal has visually settled.
        const fi = modals[name].querySelector('input:not([disabled]), button.modal-close');
        window.setTimeout(() => fi?.focus(), 120);
    };

    if (prevActive && prevActive !== name) {
        const prevM = modals[prevActive];
        if (prevM) {
            prevM.classList.remove('visible');
        }
        pendingSwitchTimer = window.setTimeout(() => {
            pendingSwitchTimer = null;
            showNewModal();
        }, 120);
    } else {
        showNewModal();
    }
}

function closeModal() {
    if (!activeModal) return;
    if (pendingSwitchTimer) {
        clearTimeout(pendingSwitchTimer);
        pendingSwitchTimer = null;
    }

    const modal = modals[activeModal];

    if (modal && modal.contains(document.activeElement)) {
        document.activeElement.blur();
    }

    if (modal) {
        modal.classList.remove('visible');
    }

    overlay.classList.remove('open');
    ModalScrollLock.unlock();
    document.removeEventListener('keydown', trapFocus, true);
    document.querySelectorAll('#modalLogin input[type="password"], #modalCadastro input[type="password"]').forEach(inp => {
        inp.disabled = true;
    });

    let finished = false;
    const finishClose = () => {
        if (finished) return;
        finished = true;
        if (pendingCloseTimer) {
            clearTimeout(pendingCloseTimer);
            pendingCloseTimer = null;
        }
        // Se outro modal foi aberto nesse meio tempo, aborta o fechamento definitivo
        if (activeModal !== null) return;

        overlay.setAttribute('aria-hidden', 'true');
        Object.values(modals).forEach(m => {
            if (m) {
                m.style.display = 'none';
                m.classList.remove('visible');
            }
        });
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finishClose();
    } else {
        overlay.addEventListener('transitionend', finishClose, { once: true });
        pendingCloseTimer = window.setTimeout(finishClose, 300);
    }

    activeModal = null;
    document.body.style.overflow = '';

    const trigger = modalTrigger;
    window.setTimeout(() => {
        if (trigger && document.body.contains(trigger)) {
            trigger.focus();
        } else {
            const fallback = document.getElementById('navAvatarBtn') || document.getElementById('btnEntrar');
            fallback?.focus();
        }
    }, 50);
    modalTrigger = null;
}

// Close on overlay click
overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && activeModal) closeModal(); });

// Close buttons
document.getElementById('modalLoginClose')?.addEventListener('click', closeModal);
document.getElementById('modalCadastroClose')?.addEventListener('click', closeModal);
document.getElementById('modalRecuperarClose')?.addEventListener('click', closeModal);
document.getElementById('modalParticipanteClose')?.addEventListener('click', closeModal);
document.getElementById('modalEventoClose')?.addEventListener('click', closeModal);
document.getElementById('modalCompraClose')?.addEventListener('click', closeModal);

/* ---------- NAV TRIGGERS ---------- */
const navActions = document.getElementById('navActions');

function updateNavUI() {
    const session = getSession();
    if (!session) {
        navActions.innerHTML = `
      <a href="#" class="btn-secondary" id="btnEntrar">Entrar</a>
      <a href="#" class="btn-primary" id="btnCadastro"><span class="dot"></span> Cadastrar</a>`;
        document.getElementById('btnEntrar')?.addEventListener('click', e => { e.preventDefault(); openModal('login'); });
        document.getElementById('btnCadastro')?.addEventListener('click', e => { e.preventDefault(); openModal('cadastro'); });
    } else {
        const nomeSessao = String(session.nome ?? '');
        const initials = nomeSessao.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
        navActions.innerHTML = `
      <div class="nav-user-info">
        <div class="nav-user-avatar" id="navAvatarBtn" role="button" title="${escapeHTML(nomeSessao)}" tabindex="0">${escapeHTML(initials)}</div>
        <span>${escapeHTML(nomeSessao.split(' ')[0])}</span>
      </div>
      <button type="button" class="btn-secondary btn-sm" id="btnSairNav">Sair</button>`;
        document.getElementById('navAvatarBtn')?.addEventListener('click', () => abrirAreaLogada());
        document.getElementById('navAvatarBtn')?.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); }
        });
        document.getElementById('btnSairNav')?.addEventListener('click', encerrarSessao);
    }
    updateMobileActions(session);
}

// Avatar: admin vai para o painel; participante abre a própria área.
// Revalida a sessão no clique: se os tokens sumiram, volta ao login em vez de
// navegar para o painel (o admin-guard devolveria para a home, parecendo um "refresh").
function abrirAreaLogada() {
    const session = getSession();
    if (!session) { updateNavUI(); openModal('login'); return; }
    if (session.role === 'admin') { window.location.href = 'admin.html'; }
    else { openModal('participante'); buildParticipante(session); }
}

// Encerra a sessão (revoga o refresh token no servidor, limpa o navegador) e
// atualiza a interface. Usado pelo botão Sair da barra, do menu mobile e da
// área do participante.
async function encerrarSessao() {
    try { await EvoAPI.logout(); } finally {
        updateNavUI();
        closeMobileMenu(false);
        closeModal();
    }
}

// O menu mobile também precisa refletir a sessão (a barra .actions some em telas pequenas).
function updateMobileActions(session) {
    const box = mobileMenu?.querySelector('.mobile-actions');
    if (!box) return;
    if (!session) {
        box.innerHTML = `
        <a href="#" class="btn-secondary" id="btnEntrarMobile">Entrar</a>
        <a href="#" class="btn-primary" id="btnCadastroMobile">Cadastrar</a>`;
        document.getElementById('btnEntrarMobile')?.addEventListener('click', e => { e.preventDefault(); closeMobileMenu(false); openModal('login'); });
        document.getElementById('btnCadastroMobile')?.addEventListener('click', e => { e.preventDefault(); closeMobileMenu(false); openModal('cadastro'); });
    } else {
        const rotulo = session.role === 'admin' ? 'Painel administrativo' : 'Minha conta';
        box.innerHTML = `
        <a href="#" class="btn-primary" id="btnContaMobile">${rotulo}</a>
        <a href="#" class="btn-secondary" id="btnSairMobile">Sair</a>`;
        document.getElementById('btnContaMobile')?.addEventListener('click', e => { e.preventDefault(); closeMobileMenu(false); abrirAreaLogada(); });
        document.getElementById('btnSairMobile')?.addEventListener('click', e => { e.preventDefault(); encerrarSessao(); });
    }
}

// Login/logout em outra aba: mantém esta aba coerente.
window.addEventListener('storage', (e) => {
    const K = window.EVO_CONFIG.STORAGE_KEYS;
    if (e.key === null || e.key === K.auth || e.key === K.session) updateNavUI();
});

document.getElementById('btnEntrar')?.addEventListener('click', e => { e.preventDefault(); openModal('login'); });
document.getElementById('btnCadastro')?.addEventListener('click', e => { e.preventDefault(); openModal('cadastro'); });
document.getElementById('btnEntrarMobile')?.addEventListener('click', e => { e.preventDefault(); openModal('login'); });
document.getElementById('btnCadastroMobile')?.addEventListener('click', e => { e.preventDefault(); openModal('cadastro'); });
document.getElementById('heroBtnCadastro')?.addEventListener('click', e => { e.preventDefault(); openModal('cadastro'); });
document.getElementById('btnCriarConta')?.addEventListener('click', e => { e.preventDefault(); openModal('cadastro'); });

// Modal switch links
document.getElementById('linkParaCadastro')?.addEventListener('click', e => { e.preventDefault(); openModal('cadastro'); });
document.getElementById('linkParaLogin')?.addEventListener('click', e => { e.preventDefault(); openModal('login'); });
document.getElementById('linkEsqueci')?.addEventListener('click', e => { e.preventDefault(); openModal('recuperar'); });
document.getElementById('linkVoltarLogin')?.addEventListener('click', e => { e.preventDefault(); openModal('login'); });

// Demo shortcuts
// Atalhos de demonstração: agora fazem login de verdade contra a API,
// usando as contas criadas pelo seed do banco.
async function loginDemo(email, senha, destinoAdmin) {
    try {
        const user = await EvoAPI.login(email, senha);
        if (destinoAdmin && user.role === 'admin') { window.location.href = 'admin.html'; return; }
        updateNavUI();
        closeModal();
    } catch (err) {
        aplicarErro('loginSenha', err.message);
    }
}
document.getElementById('linkDemoAdmin')?.addEventListener('click', e => {
    e.preventDefault();
    loginDemo('admin@evotech.com', 'admin123', true);
});
document.getElementById('linkDemoParticipante')?.addEventListener('click', e => {
    e.preventDefault();
    loginDemo('demo@evotech.com', 'demo123', false);
});

/* ---------- LOGIN ---------- */
document.getElementById('btnLoginSubmit')?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    let ok = true;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        aplicarErro('loginEmail', 'E-mail inválido.'); ok = false;
    } else { aplicarErro('loginEmail', null); }

    if (!senha || senha.length < 4) {
        aplicarErro('loginSenha', 'Informe sua senha.'); ok = false;
    } else { aplicarErro('loginSenha', null); }

    if (!ok) return;

    const botao = document.getElementById('btnLoginSubmit');
    ocupado(botao, true);
    try {
        // A verificação de senha acontece no servidor, contra o hash bcrypt.
        const user = await EvoAPI.login(email, senha);
        if (user.role === 'admin') { window.location.href = 'admin.html'; return; }
        updateNavUI();
        closeModal();
    } catch (err) {
        aplicarErro('loginSenha', err.message);
    } finally {
        ocupado(botao, false, 'Entrar');
    }
});

/* ---------- CADASTRO ---------- */
const maskCpf = (v) => {
    v = v.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    if (v.length > 6) return v.replace(/^(\d{3})(\d{3})(\d*)$/, '$1.$2.$3');
    if (v.length > 3) return v.replace(/^(\d{3})(\d*)$/, '$1.$2');
    return v;
};
const maskTel2 = (v) => {
    v = v.replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) return v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    if (v.length > 6) return v.replace(/^(\d{2})(\d{4})(\d*)$/, '($1) $2-$3');
    if (v.length > 2) return v.replace(/^(\d{2})(\d*)$/, '($1) $2');
    return v;
};

document.getElementById('cadCpf')?.addEventListener('input', e => { e.target.value = maskCpf(e.target.value); });
document.getElementById('cadTel')?.addEventListener('input', e => { e.target.value = maskTel2(e.target.value); });
document.getElementById('compraCpf')?.addEventListener('input', e => { e.target.value = maskCpf(e.target.value); });

// As máscaras de cartão saíram junto com os campos de cartão do modal.

document.getElementById('btnCadastroSubmit')?.addEventListener('click', async () => {
    const nome = document.getElementById('cadNome').value.trim();
    const email = document.getElementById('cadEmail').value.trim();
    const cpf = document.getElementById('cadCpf').value.trim();
    const tel = document.getElementById('cadTel').value.trim();
    const dt = document.getElementById('cadDt').value;
    const senha = document.getElementById('cadSenha').value;

    // Validação local continua (resposta imediata); o servidor valida de novo.
    const erros = {};
    if (nome.length < 3) erros.cadNome = 'Nome muito curto.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.cadEmail = 'E-mail inválido.';
    if (cpf.replace(/\D/g, '').length < 11) erros.cadCpf = 'CPF inválido.';
    if (tel.replace(/\D/g, '').length < 10) erros.cadTel = 'Telefone inválido.';
    if (!dt) erros.cadDt = 'Data obrigatória.';
    if (senha.length < 6) erros.cadSenha = 'Mínimo 6 caracteres.';
    ['cadNome', 'cadEmail', 'cadCpf', 'cadTel', 'cadDt', 'cadSenha']
        .forEach(id => aplicarErro(id, erros[id] || null));
    if (Object.keys(erros).length) return;

    const botao = document.getElementById('btnCadastroSubmit');
    ocupado(botao, true);
    try {
        await EvoAPI.register({ name: nome, email, password: senha, cpf, phone: tel, birthDate: dt });
        updateNavUI();
        closeModal();
    } catch (err) {
        // Erros de validação vindos do servidor caem no campo certo.
        const mapa = { name: 'cadNome', email: 'cadEmail', cpf: 'cadCpf', phone: 'cadTel', birthDate: 'cadDt', password: 'cadSenha' };
        let exibiu = false;
        (err.details || []).forEach(d => {
            if (mapa[d.field]) { aplicarErro(mapa[d.field], d.message); exibiu = true; }
        });
        if (!exibiu) aplicarErro('cadEmail', err.message);
    } finally {
        ocupado(botao, false, 'Criar conta');
    }
});

/* ---------- RECUPERAR SENHA ---------- */
document.getElementById('btnRecuperarSubmit')?.addEventListener('click', () => {
    const email = document.getElementById('recEmail').value.trim();
    const er = document.getElementById('recEmail-error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById('recEmail').classList.add('error');
        er.textContent = 'E-mail inválido.';
        return;
    }
    document.getElementById('recEmail').classList.remove('error');
    er.textContent = '';
    // A API responde a mesma coisa exista ou não o e-mail (não revela cadastros).
    EvoAPI.post('/auth/forgot-password', { email }).catch(() => { });
    document.getElementById('recSuccess').style.display = 'block';
});

/* ---------- LOGOUT ---------- */
document.getElementById('btnLogout')?.addEventListener('click', encerrarSessao);

/* ---------- ÁREA DO PARTICIPANTE ---------- */
async function buildParticipante(user) {
    // Avatar
    const nomeUser = String(user.nome ?? '');
    const initials = nomeUser.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const av = document.getElementById('partAvatar');
    if (av) av.textContent = initials;
    const nm = document.getElementById('partNomeBig');
    if (nm) nm.textContent = nomeUser;
    const em = document.getElementById('partEmailBig');
    if (em) em.textContent = user.email;

    // Perfil
    const pn = document.getElementById('perfilNome');
    if (pn) pn.value = user.name || user.nome || '';
    const pe = document.getElementById('perfilEmail');
    if (pe) pe.value = user.email || '';
    const pt = document.getElementById('perfilTel');
    if (pt) pt.value = user.phone || user.tel || '';

    const ingList = document.getElementById('meusIngressos');
    const histList = document.getElementById('meuHistorico');
    const pedList = document.getElementById('meusPedidos');
    if (ingList) ingList.innerHTML = '<div class="empty-state"><span>⏳</span>Carregando…</div>';
    if (pedList) pedList.innerHTML = '<div class="empty-state"><span>⏳</span>Carregando pedidos…</div>';
    if (histList) histList.innerHTML = '<div class="empty-state"><span>⏳</span>Carregando…</div>';

    let ingressos = [];
    let historico = [];
    let pedidos = [];
    try {
        const [tickets, history, orders] = await Promise.all([
            EvoAPI.get('/me/tickets').catch(() => []),
            EvoAPI.get('/me/history').catch(() => []),
            EvoAPI.get('/me/orders').catch(() => []),
        ]);
        ingressos = (tickets || []).map(t => ({
            evento: t.event_name,
            tipo: t.batch_name,
            data: formatarDataEvento(t.event_date),
            code: t.code,
        }));
        historico = (history || []).map(h => ({
            evento: h.event_name,
            data: new Date(h.checked_in_at).toLocaleDateString('pt-BR'),
            status: 'Compareceu',
        }));
        pedidos = orders || [];
    } catch (err) {
        if (err.status === 401) {
            // Sessão expirada de vez (refresh token inválido): a API já limpou os tokens.
            updateNavUI();
            openModal('login');
            aplicarErro('loginSenha', 'Sua sessão expirou. Entre novamente.');
            return;
        }
        if (ingList) ingList.innerHTML = `<div class="empty-state"><i data-lucide="triangle-alert" style="width:24px;height:24px;margin-bottom:8px;color:var(--yellow)"></i><p>${escapeHTML(err.message)}</p></div>`;
        if (pedList) pedList.innerHTML = '';
        if (histList) histList.innerHTML = '';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // Pedidos
    if (pedList) {
        pedList.innerHTML = '';
        if (!pedidos.length) {
            pedList.innerHTML = '<div class="empty-state"><i data-lucide="shopping-bag" style="width:28px;height:28px;margin-bottom:8px;color:var(--muted)"></i><p>Nenhum pedido realizado até o momento.</p></div>';
        } else {
            const statusLabels = {
                paid: 'Confirmado',
                pending: 'Aguardando Pagamento',
                cancelled: 'Cancelado',
                refunded: 'Estornado',
            };
            pedidos.forEach(p => {
                const total = Number(p.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const data = new Date(p.created_at).toLocaleDateString('pt-BR');
                const stClass = p.status || 'pending';
                const stLabel = statusLabels[p.status] || p.status;
                
                let itensHTML = '';
                if (p.items && p.items.length) {
                    itensHTML = p.items.map(it => `
                      <div>${escapeHTML(it.quantity)}x ${escapeHTML(it.batch_name)} — ${(Number(it.unit_price) * it.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    `).join('');
                }

                let ticketsHTML = '';
                if (p.tickets && p.tickets.length) {
                    ticketsHTML = `
                      <div class="pedido-tickets">
                        <div class="pedido-tickets-title">Ingressos emitidos para este pedido:</div>
                        ${p.tickets.map(t => `
                          <div class="pedido-ticket-row">
                            <span>${escapeHTML(t.holder_name)} (${escapeHTML(t.batch_name)})</span>
                            <span class="pedido-ticket-code">#${escapeHTML(t.code)}</span>
                          </div>
                        `).join('')}
                      </div>
                    `;
                }

                pedList.insertAdjacentHTML('beforeend', `
                  <div class="pedido-card">
                    <div class="pedido-header">
                      <div>
                        <span class="pedido-id">Pedido #${escapeHTML(p.id)}</span>
                        <span style="font-size:0.8rem;color:var(--muted);margin-left:8px;display:inline-flex;align-items:center;gap:4px"><i data-lucide="calendar" style="width:13px;height:13px"></i>${escapeHTML(data)}</span>
                      </div>
                      <span class="pedido-status-badge ${escapeHTML(stClass)}">${escapeHTML(stLabel)}</span>
                    </div>
                    <div style="font-weight:600;font-size:0.95rem;color:var(--text)">${escapeHTML(p.event_name)}</div>
                    <div style="font-size:0.85rem;color:var(--muted)">${itensHTML}</div>
                    <div class="pedido-detalhes">
                      <span>Total do pedido:</span>
                      <span class="pedido-total">${escapeHTML(total)}</span>
                    </div>
                    ${ticketsHTML}
                  </div>
                `);
            });
        }
    }

    // Ingressos
    if (ingList) {
        ingList.innerHTML = '';
        if (!ingressos.length) {
            ingList.innerHTML = '<div class="empty-state"><i data-lucide="ticket" style="width:28px;height:28px;margin-bottom:8px;color:var(--muted)"></i><p>Você ainda não comprou ingressos.</p></div>';
        } else {
            ingressos.forEach(ing => {
                ingList.insertAdjacentHTML('beforeend', `
          <div class="ingresso-card">
            <div class="ingresso-qr"><i data-lucide="ticket" style="width:32px;height:32px;color:var(--primary)"></i></div>
            <div class="ingresso-info">
              <div class="ingresso-evento">${escapeHTML(ing.evento)}</div>
              <div class="ingresso-tipo">${escapeHTML(ing.tipo)}</div>
              <div class="ingresso-data" style="display:flex;align-items:center;gap:4px"><i data-lucide="calendar" style="width:13px;height:13px"></i>${escapeHTML(ing.data)}</div>
              <div class="ingresso-code">#${escapeHTML(ing.code)}</div>
            </div>
          </div>`);
            });
        }
    }

    // Histórico
    if (histList) {
        histList.innerHTML = '';
        if (!historico.length) {
            histList.innerHTML = '<div class="empty-state"><i data-lucide="history" style="width:28px;height:28px;margin-bottom:8px;color:var(--muted)"></i><p>Nenhum evento no histórico ainda.</p></div>';
        } else {
            historico.forEach(h => {
                histList.insertAdjacentHTML('beforeend', `
          <div class="historico-item">
            <div>
              <div class="hist-nome">${escapeHTML(h.evento)}</div>
              <div class="hist-data">${escapeHTML(h.data)}</div>
            </div>
            <div class="hist-status" style="display:inline-flex;align-items:center;gap:4px"><i data-lucide="check" style="width:12px;height:12px"></i>${escapeHTML(h.status)}</div>
          </div>`);
            });
        }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Part tabs
document.querySelectorAll('.part-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.part-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.ptab;
        document.querySelectorAll('.part-panel').forEach(p => p.style.display = 'none');
        const panel = document.getElementById('ptab-' + target);
        if (panel) panel.style.display = 'block';
    });
});

// Salvar perfil via requisição autenticada
document.getElementById('btnSalvarPerfil')?.addEventListener('click', async () => {
    const nome = document.getElementById('perfilNome').value.trim();
    const tel = document.getElementById('perfilTel').value.trim();
    const aviso = document.getElementById('perfilSuccess');
    const botao = document.getElementById('btnSalvarPerfil');
    ocupado(botao, true);
    try {
        const user = await EvoAPI.put('/auth/me', { name: nome || undefined, phone: tel || undefined });
        EvoAPI.store.setSession(user);
        updateNavUI();
        if (aviso) {
            aviso.textContent = 'Perfil atualizado com sucesso!';
            aviso.style.color = 'var(--primary)';
            aviso.style.display = 'block';
            setTimeout(() => { aviso.style.display = 'none'; }, 3500);
        }
    } catch (err) {
        if (aviso) {
            aviso.textContent = err.message || 'Erro ao atualizar perfil.';
            aviso.style.color = '#ef4444';
            aviso.style.display = 'block';
            setTimeout(() => { aviso.style.display = 'none'; }, 4000);
        } else {
            alert(err.message);
        }
    } finally {
        ocupado(botao, false, 'Salvar alterações');
    }
});

// Botão Fechar/Cancelar do perfil: restaura dados originais e fecha modal
document.getElementById('btnCancelarPerfil')?.addEventListener('click', () => {
    const session = EvoAPI.store.getSession() || {};
    const pn = document.getElementById('perfilNome');
    if (pn) pn.value = session.name || session.nome || '';
    const pt = document.getElementById('perfilTel');
    if (pt) pt.value = session.phone || session.tel || '';
    closeModal();
});

/* ---------- DASHBOARD ADMIN ---------- */
/* ---------- EVENTO DETAIL ---------- */
const EVENTOS_FALLBACK = [
    {
        id: 1,
        slug: 'offcampus-na-copa',
        nome: 'OFFCampus na copa?',
        tipo: 'Festa Universitária',
        data: '15 de Novembro de 2025',
        local: 'Espaço Sunset Lounge',
        img: 'imagens/offcampushexa.png',
        desc: 'Música ao vivo, áreas VIP e networking exclusivo. Vamos em busca do hexa com estilo!',
        regras: 'Classificação 18 anos. Obrigatória apresentação de documento oficial com foto.',
        lotes: [
            { id: 101, nome: 'Lote Promocional', preco: 45.0, disponivel: 32, total: 100 },
            { id: 102, nome: 'Área VIP', preco: 90.0, disponivel: 15, total: 50 }
        ]
    },
    {
        id: 2,
        slug: 'resenha-do-portes',
        nome: 'Resenha do Portes',
        tipo: 'Festival de Música Eletrônica',
        data: '22 de Novembro de 2025',
        local: 'Arena Music Park',
        img: 'imagens/resenhadoportes.png',
        desc: 'Festival com line-up exclusivo, produção premium e acesso controlado.',
        regras: 'Classificação 18 anos. Proibida a entrada com bebidas externas.',
        lotes: [
            { id: 201, nome: 'Pista Open Air', preco: 55.0, disponivel: 48, total: 150 },
            { id: 202, nome: 'Camarote Backstage', preco: 120.0, disponivel: 8, total: 30 }
        ]
    },
    {
        id: 3,
        slug: 'halloween-offcampus',
        nome: 'Halloween OffCampus',
        tipo: 'Festa Temática & Open Food',
        data: '31 de Outubro de 2025',
        local: 'Mansão Boulevard',
        img: 'imagens/halloween.png',
        desc: 'Experiência completa para estudantes com open food, música e ambiente VIP temático.',
        regras: 'Fantasia recomendada. Classificação 18 anos.',
        lotes: [
            { id: 301, nome: 'Geral + Open Food', preco: 70.0, disponivel: 20, total: 120 },
            { id: 302, nome: 'VIP Premium Experience', preco: 140.0, disponivel: 12, total: 40 }
        ]
    }
];

function openEvento(idx) {
    const ev = (EVENTOS && EVENTOS[idx]) || EVENTOS_FALLBACK[idx];
    if (!ev) return;
    const cont = document.getElementById('eventoDetailContent');
    if (!cont) return;
    cont.innerHTML = `
    <div class="ev-ribbon">${escapeHTML(ev.tipo)}</div>
    <h2 class="ev-title">${escapeHTML(ev.nome)}</h2>
    <div class="ev-meta">
      <span style="display:inline-flex;align-items:center;gap:4px"><i data-lucide="calendar" style="width:14px;height:14px"></i>${escapeHTML(ev.data)}</span>
      <span style="display:inline-flex;align-items:center;gap:4px"><i data-lucide="map-pin" style="width:14px;height:14px"></i>${escapeHTML(ev.local)}</span>
    </div>
    <p class="ev-desc">${escapeHTML(ev.desc)}</p>
    <p class="ev-desc" style="font-size:.82rem;font-style:italic;display:flex;align-items:center;gap:6px"><i data-lucide="triangle-alert" style="width:14px;height:14px;color:var(--yellow);flex-shrink:0"></i><span>${escapeHTML(ev.regras)}</span></p>
    <div class="ev-lotes-title">Tipos de Ingresso</div>
    <div class="ev-lotes">
      ${ev.lotes.map((l, i) => `
        <div class="ev-lote">
          <div>
            <div class="ev-lote-nome">${escapeHTML(l.nome)}</div>
            <div class="ev-lote-disp">${l.disponivel} disponíveis de ${l.total}</div>
          </div>
          <div class="ev-lote-right">
            <div class="ev-lote-preco">R$ ${l.preco.toFixed(2).replace('.', ',')}</div>
            <button class="ev-lote-btn" data-ev="${idx}" data-lote="${i}">Comprar</button>
          </div>
        </div>`).join('')}
    </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Banner: criado via DOM. A URL passa pela allowlist (http/https ou caminho
    // relativo) e é atribuída como propriedade, nunca interpolada em HTML.
    const banner = document.createElement('img');
    banner.className = 'ev-banner';
    banner.alt = ev.nome;
    const bannerSrc = sanitizeURL(ev.img);
    if (bannerSrc) {
        banner.addEventListener('error', () => { banner.style.display = 'none'; });
        banner.src = bannerSrc;
    } else {
        banner.style.display = 'none';
    }
    cont.prepend(banner);

    // Attach buy buttons
    cont.querySelectorAll('.ev-lote-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const evIdx = parseInt(btn.dataset.ev);
            const loteIdx = parseInt(btn.dataset.lote);
            openCompra(evIdx, loteIdx);
        });
    });
    openModal('evento');
}
window.openEvento = openEvento;

// Banner info buttons
document.querySelectorAll('.banner-info').forEach(btn => {
    btn.addEventListener('click', e => {
        e.preventDefault();
        openEvento(parseInt(btn.dataset.evento));
    });
});

/* ---------- COMPRA DE INGRESSO ---------- */
let compraState = { eventoIdx: null, loteIdx: null };

function openCompra(evIdx, loteIdx) {
    const ev = EVENTOS[evIdx];
    if (!ev) return;
    compraState = { eventoIdx: evIdx, loteIdx: loteIdx };
    document.getElementById('compraTitulo').textContent = 'Selecione o ingresso';
    document.getElementById('compraEvento').textContent = ev.nome;
    document.getElementById('compraSuccess').style.display = 'none';
    document.getElementById('compraForm').style.display = 'none';

    // Pre-fill if user is logged in
    const session = getSession();
    if (session) {
        document.getElementById('compraNome').value = session.nome || '';
        document.getElementById('compraEmail').value = session.email || '';
        document.getElementById('compraCpf').value = session.cpf || '';
    }

    const lotesEl = document.getElementById('compraLotes');
    lotesEl.innerHTML = ev.lotes.map((l, i) => `
    <div class="compra-lote${i === loteIdx ? ' selected' : ''}" data-lote="${i}">
      <div>
        <div class="compra-lote-nome">${escapeHTML(l.nome)}</div>
        <div class="compra-lote-disp">${l.disponivel} disponíveis</div>
      </div>
      <div class="compra-lote-preco">R$ ${l.preco.toFixed(2).replace('.', ',')}</div>
    </div>`).join('');

    lotesEl.querySelectorAll('.compra-lote').forEach(el => {
        el.addEventListener('click', () => {
            lotesEl.querySelectorAll('.compra-lote').forEach(x => x.classList.remove('selected'));
            el.classList.add('selected');
            compraState.loteIdx = parseInt(el.dataset.lote);
            showCompraForm();
        });
    });

    if (loteIdx !== null && loteIdx !== undefined) showCompraForm();
    openModal('compra');
}

function showCompraForm() {
    const ev = EVENTOS[compraState.eventoIdx];
    const lote = ev?.lotes[compraState.loteIdx];
    if (!lote) return;
    document.getElementById('compraTitulo').textContent = 'Finalizar compra';
    document.getElementById('compraResumo').textContent = `${lote.nome} — ${ev.nome} — R$ ${lote.preco.toFixed(2).replace('.', ',')}`;
    document.getElementById('compraForm').style.display = 'block';
}

// Banner buy buttons
document.querySelectorAll('.banner-buy').forEach(btn => {
    btn.addEventListener('click', e => {
        e.preventDefault();
        const evName = btn.dataset.evento;
        const idx = EVENTOS.findIndex(ev => ev.nome === evName);
        if (idx >= 0) openCompra(idx, null);
    });
});

// Plano buttons
document.querySelectorAll('.plano-btn[data-plano]').forEach(btn => {
    btn.addEventListener('click', e => {
        e.preventDefault();
        const session = getSession();
        if (!session) openModal('cadastro');
        else { alert(`Plano ${btn.dataset.plano} selecionado! Em breve a equipe EvoTech entrará em contato.`); }
    });
});

/* ---------- CONFIRMAR COMPRA ---------- */
document.getElementById('btnConfirmarCompra')?.addEventListener('click', async () => {
    const nome = document.getElementById('compraNome').value.trim();
    const email = document.getElementById('compraEmail').value.trim();
    const cpf = document.getElementById('compraCpf').value.trim();
    let ok = true;
    if (!nome || nome.length < 3) { aplicarErro('compraNome', 'Nome obrigatório.'); ok = false; } else { aplicarErro('compraNome', null); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { aplicarErro('compraEmail', 'E-mail inválido.'); ok = false; } else { aplicarErro('compraEmail', null); }
    if (cpf.replace(/\D/g, '').length < 11) { aplicarErro('compraCpf', 'CPF inválido.'); ok = false; } else { aplicarErro('compraCpf', null); }
    if (!ok) return;

    const ev = EVENTOS[compraState.eventoIdx];
    const lote = ev?.lotes[compraState.loteIdx];
    if (!lote) return;

    const botao = document.getElementById('btnConfirmarCompra');
    ocupado(botao, true);

    let pedido;
    try {
        // O servidor é quem define o preço, reserva a vaga no lote e gera o
        // código do ingresso. O frontend não decide nada disso.
        pedido = await EvoAPI.post('/orders', {
            batchId: lote.id,
            quantity: 1,
            buyerName: nome,
            buyerEmail: email,
            buyerCpf: cpf,
        });
    } catch (err) {
        aplicarErro('compraCpf', err.message);
        ocupado(botao, false, 'Confirmar compra');
        return;
    }
    ocupado(botao, false, 'Confirmar compra');

    // Atualiza a disponibilidade exibida com o dado real.
    await carregarEventos();

    const codigo = pedido.tickets?.[0]?.code || '(aguardando confirmação de pagamento)';
    document.getElementById('compraLotes').style.display = 'none';
    document.getElementById('compraForm').style.display = 'none';
    document.getElementById('compraTitulo').style.display = 'none';
    document.getElementById('compraEvento').style.display = 'none';
    document.getElementById('compraTicket').innerHTML = `
    <div class="tk-row"><span>Evento:</span><b>${escapeHTML(pedido.eventName)}</b></div>
    <div class="tk-row"><span>Ingresso:</span><b>${escapeHTML(pedido.batchName)}</b></div>
    <div class="tk-row"><span>Nome:</span><b>${escapeHTML(nome)}</b></div>
    <div class="tk-row"><span>Valor:</span><b>R$ ${Number(pedido.total).toFixed(2).replace('.', ',')}</b></div>
    <div class="tk-code">#${escapeHTML(codigo)}</div>`;
    document.getElementById('compraSuccess').style.display = 'block';
});

document.getElementById('btnVerIngresso')?.addEventListener('click', async () => {
    const session = getSession();
    if (!session) { openModal('login'); return; }
    openModal('participante');
    await buildParticipante(session);
});

/* ---------- INIT ---------- */
// A tela monta primeiro e os dados chegam da API em seguida.
updateNavUI();
carregarEventos().then(() => {
    // Se a API não respondeu, avisa em vez de exibir preços desatualizados.
    if (!EVENTOS.length) {
        document.querySelectorAll('.banner-buy, .banner-info').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                alert('Não foi possível carregar os eventos agora. Tente novamente em instantes.');
            }, { capture: true });
        });
    }
});
