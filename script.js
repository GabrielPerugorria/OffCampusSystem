'use strict';

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
    if (total > 0) progressBar.style.width = `${(window.scrollY / total) * 100}%`;
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
      <div class="tt-city">${city.name}</div>
      <div class="tt-events">${city.events} eventos realizados</div>
      <div class="tt-category">${city.category}</div>
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
        <span class="brazil-stats-city"><span class="brazil-stats-dot"></span>${city.name}</span>
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
const EVENTOS = [
    {
        id: 0,
        nome: 'OFFCampus na Copa',
        tipo: 'Experiência Premium',
        data: 'EM BREVE',
        local: 'Curitiba, PR',
        img: 'imagens/offcampushexa.png',
        desc: 'Música ao vivo, áreas VIP e networking com convidados especiais para quem busca uma experiência premium. Vamos em busca do hexa com estilo e exclusividade! Dress code obrigatório. +18.',
        regras: 'Documento com foto obrigatório. Proibido menores de 18 anos.',
        lotes: [
            { nome: 'Lote Promocional', preco: 49.90, disponivel: 50, total: 100 },
            { nome: '1º Lote', preco: 79.90, disponivel: 200, total: 300 },
            { nome: 'VIP', preco: 149.90, disponivel: 30, total: 50 },
            { nome: 'Open Bar', preco: 199.90, disponivel: 20, total: 30 },
        ]
    },
    {
        id: 1,
        nome: 'Resenha do Portes',
        tipo: 'Festival Eletrônico',
        data: 'EM BREVE',
        local: 'Curitiba, PR',
        img: 'imagens/resenhadoportes.png',
        desc: 'Line-up exclusivo, produção premium e acesso controlado para uma noite inesquecível. Artistas confirmados de diferentes cidades e sets que vão da meia-noite ao amanhecer.',
        regras: 'Documento obrigatório. Não é permitida a entrada de bebidas externas.',
        lotes: [
            { nome: '1º Lote', preco: 69.90, disponivel: 150, total: 250 },
            { nome: '2º Lote', preco: 99.90, disponivel: 100, total: 200 },
            { nome: 'Camarote', preco: 179.90, disponivel: 15, total: 20 },
        ]
    },
    {
        id: 2,
        nome: 'Halloween OffCampus',
        tipo: 'Ambiente VIP',
        data: 'EM BREVE',
        local: 'Curitiba, PR',
        img: 'imagens/halloween.png',
        desc: 'Experience completa para estudantes com open food, música e ambiente vip. A maior festa de Halloween universitária do sul do Brasil. Fantasia obrigatória para desconto.',
        regras: 'Estudantes com carteirinha têm 20% de desconto. Fantasia incentivada.',
        lotes: [
            { nome: 'Lote Estudante', preco: 39.90, disponivel: 80, total: 150 },
            { nome: '1º Lote', preco: 59.90, disponivel: 200, total: 400 },
            { nome: 'VIP + Open Food', preco: 129.90, disponivel: 40, total: 60 },
        ]
    }
];

/* ---------- STORAGE UTILS ---------- */
const LS = {
    get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
    remove: (k) => { try { localStorage.removeItem(k); } catch { } },
};

const getUsers = () => LS.get('evo_users') || [];
const saveUsers = (u) => LS.set('evo_users', u);
const getSession = () => LS.get('evo_session');
const saveSession = (s) => LS.set('evo_session', s);
const clearSession = () => LS.remove('evo_session');

// Seed demo accounts on first load
(function seedDemo() {
    const users = getUsers();
    if (!users.find(u => u.email === 'admin@evotech.com')) {
        users.push({ nome: 'Admin EvoTech', email: 'admin@evotech.com', senha: 'admin123', role: 'admin', cpf: '000.000.000-00', tel: '(41) 99999-9999', dt: '1990-01-01', ingressos: [], historico: [] });
    }
    if (!users.find(u => u.email === 'demo@evotech.com')) {
        users.push({
            nome: 'João Cardoso', email: 'demo@evotech.com', senha: 'demo123', role: 'participante', cpf: '111.111.111-11', tel: '(41) 98888-8888', dt: '1998-05-12', ingressos: [
                { id: 'EVT001', evento: 'Resenha do Portes', tipo: 'VIP', data: 'EM BREVE', code: 'RDP-VIP-7891', compradoEm: '2026-06-10' },
            ], historico: [
                { evento: 'OFFCampus Verão', data: '2025-12-15', status: 'Compareceu' },
                { evento: 'Resenha do Portes', data: '2025-10-20', status: 'Compareceu' },
            ]
        });
    }
    saveUsers(users);
})();

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

function openModal(name) {
    if (!modals[name]) return;
    
    const prevActive = activeModal;

    // Remember what had focus so we can restore it when the modal closes.
    // If we're switching between modals while the overlay is already open
    // (e.g. login -> cadastro), keep the original trigger instead.
    if (!overlay.classList.contains('open')) {
        modalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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

        // aria-hidden is only safe to remove once the overlay is actually in
        // the accessibility tree — do it before moving focus in.
        overlay.removeAttribute('aria-hidden');
        overlay.classList.add('open');
        activeModal = name;
        document.body.style.overflow = 'hidden';
        document.body.classList.add('modal-open');
        document.addEventListener('keydown', trapFocus, true);

        // Focus first input/control once the modal has visually settled.
        const fi = modals[name].querySelector('input:not([disabled]), button.modal-close');
        window.setTimeout(() => fi?.focus(), 120);
    };

    if (prevActive && prevActive !== name) {
        // Switch between modals: fade out prev first
        const prevM = modals[prevActive];
        if (prevM) {
            prevM.classList.remove('visible');
        }
        window.setTimeout(showNewModal, 150); // wait for fade out
    } else {
        showNewModal();
    }
}

function closeModal() {
    if (!activeModal) return;
    const modal = modals[activeModal];

    // Move focus OUT of the modal before hiding it — setting aria-hidden
    // on an ancestor of the focused element is invalid and triggers the
    // "Blocked aria-hidden on an element because its descendant retained
    // focus" console warning. Restoring focus to the trigger also keeps
    // keyboard/screen-reader users oriented.
    if (modal && modal.contains(document.activeElement)) {
        document.activeElement.blur();
    }

    if (modal) {
        modal.classList.remove('visible');
    }

    overlay.classList.remove('open');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', trapFocus, true);

    const finishClose = () => {
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
        // Safety net in case transitionend doesn't fire (e.g. tab backgrounded)
        window.setTimeout(finishClose, 400);
    }

    activeModal = null;
    document.body.style.overflow = '';

    // Defere a restauração do foco para depois de possíveis re-renderizações do DOM
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
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
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
        const initials = session.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
        navActions.innerHTML = `
      <div class="nav-user-info">
        <div class="nav-user-avatar" id="navAvatarBtn" title="${session.nome}" tabindex="0">${initials}</div>
        <span>${session.nome.split(' ')[0]}</span>
      </div>`;
        document.getElementById('navAvatarBtn')?.addEventListener('click', () => {
            if (session.role === 'admin') { window.location.href = 'admin.html'; }
            else { buildParticipante(session); openModal('participante'); }
        });
        document.getElementById('navAvatarBtn')?.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') e.target.click();
        });
    }
}

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
document.getElementById('linkDemoAdmin')?.addEventListener('click', e => {
    e.preventDefault();
    const u = getUsers().find(x => x.email === 'admin@evotech.com');
    if (u) { saveSession(u); window.location.href = 'admin.html'; }
});
document.getElementById('linkDemoParticipante')?.addEventListener('click', e => {
    e.preventDefault();
    const u = getUsers().find(x => x.email === 'demo@evotech.com');
    if (u) { saveSession(u); updateNavUI(); closeModal(); }
});

/* ---------- LOGIN ---------- */
document.getElementById('btnLoginSubmit')?.addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    let ok = true;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById('loginEmail').classList.add('error');
        document.getElementById('loginEmail-error').textContent = 'E-mail inválido.';
        ok = false;
    } else { document.getElementById('loginEmail').classList.remove('error'); document.getElementById('loginEmail-error').textContent = ''; }
    if (!senha || senha.length < 4) {
        document.getElementById('loginSenha').classList.add('error');
        document.getElementById('loginSenha-error').textContent = 'Informe sua senha.';
        ok = false;
    } else { document.getElementById('loginSenha').classList.remove('error'); document.getElementById('loginSenha-error').textContent = ''; }
    if (!ok) return;
    const user = getUsers().find(u => u.email === email && u.senha === senha);
    if (!user) {
        document.getElementById('loginSenha').classList.add('error');
        document.getElementById('loginSenha-error').textContent = 'E-mail ou senha incorretos.';
        return;
    }
    saveSession(user);
    if (user.role === 'admin') { window.location.href = 'admin.html'; return; }
    updateNavUI();
    closeModal();
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

function maskCard(v) {
    return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
}
function maskValidade(v) {
    v = v.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) return v.slice(0, 2) + '/' + v.slice(2);
    return v;
}
document.getElementById('compraCard')?.addEventListener('input', e => { e.target.value = maskCard(e.target.value); });
document.getElementById('compraValidade')?.addEventListener('input', e => { e.target.value = maskValidade(e.target.value); });

document.getElementById('btnCadastroSubmit')?.addEventListener('click', () => {
    const nome = document.getElementById('cadNome').value.trim();
    const email = document.getElementById('cadEmail').value.trim();
    const cpf = document.getElementById('cadCpf').value.trim();
    const tel = document.getElementById('cadTel').value.trim();
    const dt = document.getElementById('cadDt').value;
    const senha = document.getElementById('cadSenha').value;
    const erros = {};
    if (nome.length < 3) erros.cadNome = 'Nome muito curto.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.cadEmail = 'E-mail inválido.';
    if (cpf.replace(/\D/g, '').length < 11) erros.cadCpf = 'CPF inválido.';
    if (tel.replace(/\D/g, '').length < 10) erros.cadTel = 'Telefone inválido.';
    if (!dt) erros.cadDt = 'Data obrigatória.';
    if (senha.length < 6) erros.cadSenha = 'Mínimo 6 caracteres.';
    ['cadNome', 'cadEmail', 'cadCpf', 'cadTel', 'cadDt', 'cadSenha'].forEach(id => {
        const el = document.getElementById(id);
        const er = document.getElementById(id + '-error');
        if (erros[id]) { el?.classList.add('error'); if (er) er.textContent = erros[id]; }
        else { el?.classList.remove('error'); if (er) er.textContent = ''; }
    });
    if (Object.keys(erros).length) return;
    const users = getUsers();
    if (users.find(u => u.email === email)) {
        document.getElementById('cadEmail').classList.add('error');
        document.getElementById('cadEmail-error').textContent = 'E-mail já cadastrado.';
        return;
    }
    const newUser = { nome, email, cpf, tel, dt, senha, role: 'participante', ingressos: [], historico: [] };
    users.push(newUser);
    saveUsers(users);
    saveSession(newUser);
    updateNavUI();
    closeModal();
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
    document.getElementById('recSuccess').style.display = 'block';
});

/* ---------- LOGOUT ---------- */
document.getElementById('btnLogout')?.addEventListener('click', () => { clearSession(); updateNavUI(); closeModal(); });

/* ---------- ÁREA DO PARTICIPANTE ---------- */
function buildParticipante(user) {
    // Avatar
    const initials = user.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const av = document.getElementById('partAvatar');
    if (av) av.textContent = initials;
    const nm = document.getElementById('partNomeBig');
    if (nm) nm.textContent = user.nome;
    const em = document.getElementById('partEmailBig');
    if (em) em.textContent = user.email;

    // Perfil
    const pn = document.getElementById('perfilNome');
    if (pn) pn.value = user.nome;
    const pe = document.getElementById('perfilEmail');
    if (pe) pe.value = user.email;
    const pt = document.getElementById('perfilTel');
    if (pt) pt.value = user.tel || '';

    // Ingressos
    const ingList = document.getElementById('meusIngressos');
    if (ingList) {
        ingList.innerHTML = '';
        const ingressos = user.ingressos || [];
        if (ingressos.length === 0) {
            ingList.innerHTML = '<div class="empty-state"><span>🎫</span>Você ainda não comprou ingressos.</div>';
        } else {
            ingressos.forEach(ing => {
                ingList.insertAdjacentHTML('beforeend', `
          <div class="ingresso-card">
            <div class="ingresso-qr">🎫</div>
            <div class="ingresso-info">
              <div class="ingresso-evento">${ing.evento}</div>
              <div class="ingresso-tipo">${ing.tipo}</div>
              <div class="ingresso-data">📅 ${ing.data}</div>
              <div class="ingresso-code">#${ing.code}</div>
            </div>
          </div>`);
            });
        }
    }

    // Histórico
    const histList = document.getElementById('meuHistorico');
    if (histList) {
        histList.innerHTML = '';
        const historico = user.historico || [];
        if (historico.length === 0) {
            histList.innerHTML = '<div class="empty-state"><span>📋</span>Nenhum evento no histórico ainda.</div>';
        } else {
            historico.forEach(h => {
                histList.insertAdjacentHTML('beforeend', `
          <div class="historico-item">
            <div>
              <div class="hist-nome">${h.evento}</div>
              <div class="hist-data">${h.data}</div>
            </div>
            <div class="hist-status">✓ ${h.status}</div>
          </div>`);
            });
        }
    }
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

// Salvar perfil
document.getElementById('btnSalvarPerfil')?.addEventListener('click', () => {
    const session = getSession();
    if (!session) return;
    const nome = document.getElementById('perfilNome').value.trim();
    const tel = document.getElementById('perfilTel').value.trim();
    const users = getUsers();
    const idx = users.findIndex(u => u.email === session.email);
    if (idx >= 0) {
        users[idx].nome = nome || users[idx].nome;
        users[idx].tel = tel || users[idx].tel;
        saveUsers(users);
        saveSession(users[idx]);
        updateNavUI();
    }
    document.getElementById('perfilSuccess').style.display = 'block';
    setTimeout(() => { document.getElementById('perfilSuccess').style.display = 'none'; }, 3000);
});

/* ---------- DASHBOARD ADMIN ---------- */
/* ---------- EVENTO DETAIL ---------- */
function openEvento(idx) {
    const ev = EVENTOS[idx];
    if (!ev) return;
    const cont = document.getElementById('eventoDetailContent');
    if (!cont) return;
    cont.innerHTML = `
    <img class="ev-banner" src="${ev.img}" alt="${ev.nome}" onerror="this.style.display='none'">
    <div class="ev-ribbon">${ev.tipo}</div>
    <h2 class="ev-title">${ev.nome}</h2>
    <div class="ev-meta">
      <span>📅 ${ev.data}</span>
      <span>📍 ${ev.local}</span>
    </div>
    <p class="ev-desc">${ev.desc}</p>
    <p class="ev-desc" style="font-size:.82rem;font-style:italic">⚠️ ${ev.regras}</p>
    <div class="ev-lotes-title">Tipos de Ingresso</div>
    <div class="ev-lotes">
      ${ev.lotes.map((l, i) => `
        <div class="ev-lote">
          <div>
            <div class="ev-lote-nome">${l.nome}</div>
            <div class="ev-lote-disp">${l.disponivel} disponíveis de ${l.total}</div>
          </div>
          <div class="ev-lote-right">
            <div class="ev-lote-preco">R$ ${l.preco.toFixed(2).replace('.', ',')}</div>
            <button class="ev-lote-btn" data-ev="${idx}" data-lote="${i}">Comprar</button>
          </div>
        </div>`).join('')}
    </div>`;

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
        <div class="compra-lote-nome">${l.nome}</div>
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
    document.getElementById('compraResumo').textContent = `✓ ${lote.nome} — ${ev.nome} — R$ ${lote.preco.toFixed(2).replace('.', ',')}`;
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
document.getElementById('btnConfirmarCompra')?.addEventListener('click', () => {
    const nome = document.getElementById('compraNome').value.trim();
    const email = document.getElementById('compraEmail').value.trim();
    const cpf = document.getElementById('compraCpf').value.trim();
    let ok = true;
    if (!nome || nome.length < 3) { document.getElementById('compraNome').classList.add('error'); document.getElementById('compraNome-error').textContent = 'Nome obrigatório.'; ok = false; } else { document.getElementById('compraNome').classList.remove('error'); document.getElementById('compraNome-error').textContent = ''; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('compraEmail').classList.add('error'); document.getElementById('compraEmail-error').textContent = 'E-mail inválido.'; ok = false; } else { document.getElementById('compraEmail').classList.remove('error'); document.getElementById('compraEmail-error').textContent = ''; }
    if (cpf.replace(/\D/g, '').length < 11) { document.getElementById('compraCpf').classList.add('error'); document.getElementById('compraCpf-error').textContent = 'CPF inválido.'; ok = false; } else { document.getElementById('compraCpf').classList.remove('error'); document.getElementById('compraCpf-error').textContent = ''; }
    if (!ok) return;

    const ev = EVENTOS[compraState.eventoIdx];
    const lote = ev?.lotes[compraState.loteIdx];
    if (!lote) return;

    // Generate ticket
    const code = ev.nome.slice(0, 3).toUpperCase().replace(/ /g, '') + '-' + lote.nome.slice(0, 3).toUpperCase().replace(/ /g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const ticket = { id: code, evento: ev.nome, tipo: lote.nome, data: ev.data, code, compradoEm: new Date().toLocaleDateString('pt-BR') };

    // Save to user
    const session = getSession();
    if (session) {
        const users = getUsers();
        const idx = users.findIndex(u => u.email === session.email);
        if (idx >= 0) {
            users[idx].ingressos = users[idx].ingressos || [];
            users[idx].ingressos.push(ticket);
            saveUsers(users);
            saveSession(users[idx]);
        }
    }

    // Show success
    document.getElementById('compraLotes').style.display = 'none';
    document.getElementById('compraForm').style.display = 'none';
    document.getElementById('compraTitulo').style.display = 'none';
    document.getElementById('compraEvento').style.display = 'none';
    document.getElementById('compraTicket').innerHTML = `
    <div class="tk-row"><span>Evento:</span><b>${ev.nome}</b></div>
    <div class="tk-row"><span>Ingresso:</span><b>${lote.nome}</b></div>
    <div class="tk-row"><span>Nome:</span><b>${nome}</b></div>
    <div class="tk-row"><span>Valor:</span><b>R$ ${lote.preco.toFixed(2).replace('.', ',')}</b></div>
    <div class="tk-code">#${code}</div>`;
    document.getElementById('compraSuccess').style.display = 'block';
});

document.getElementById('btnVerIngresso')?.addEventListener('click', () => {
    const session = getSession();
    if (session) {
        // Reload session
        const freshUser = getUsers().find(u => u.email === session.email);
        if (freshUser) {
            saveSession(freshUser);
            buildParticipante(freshUser);
            openModal('participante');
        }
    } else {
        openModal('login');
    }
});

/* ---------- INIT ---------- */
updateNavUI();
