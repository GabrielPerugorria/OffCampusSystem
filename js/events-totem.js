/**
 * EVOTECH EVENTS — CARROSSEL CINEMATOGRÁFICO DE TELAS PANORÂMICAS
 * Gerencia a alternância das 3 telas horizontais exclusivamente pelas setas
 * de navegação, desfoque de profundidade, botões e swipe no mobile.
 */

(function () {
  'use strict';

  function initCinemaCarousel() {
    const stage = document.querySelector('.cinema-viewport');
    if (!stage) return;

    const cards = Array.from(document.querySelectorAll('.cinema-card'));
    const dots = Array.from(document.querySelectorAll('.cinema-dot'));
    const btnPrev = document.querySelector('.cinema-nav-prev');
    const btnNext = document.querySelector('.cinema-nav-next');
    const btnInfo = document.getElementById('totemBtnInfo');
    const btnAll = document.getElementById('totemBtnAll');

    if (cards.length === 0) return;

    let currentIndex = 0;
    const total = cards.length; // 3 telas

    function updateCarousel(newIndex) {
      currentIndex = ((newIndex % total) + total) % total;

      cards.forEach((card, i) => {
        const diff = (i - currentIndex + total) % total;
        card.classList.remove('pos-center', 'pos-left', 'pos-right');

        if (diff === 0) {
          card.classList.add('pos-center');
          card.setAttribute('aria-hidden', 'false');
        } else if (diff === 1) {
          card.classList.add('pos-right');
          card.setAttribute('aria-hidden', 'true');
        } else if (diff === 2) {
          card.classList.add('pos-left');
          card.setAttribute('aria-hidden', 'true');
        }
      });

      // Atualiza os indicadores (dots)
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === currentIndex);
        dot.setAttribute('aria-current', i === currentIndex ? 'true' : 'false');
      });

      // Atualiza o botão Saber Mais com o evento ativo
      if (btnInfo) {
        btnInfo.setAttribute('data-evento', String(currentIndex));
      }
    }

    // NAVEGAÇÃO: EXCLUSIVAMENTE PELAS SETAS
    // (Os cards laterais possuem pointer-events: none e nenhum clique navega por eles)
    if (btnPrev) {
      btnPrev.addEventListener('click', function (e) {
        e.preventDefault();
        updateCarousel(currentIndex - 1);
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', function (e) {
        e.preventDefault();
        updateCarousel(currentIndex + 1);
      });
    }

    // Ação: Saber Mais (abaixo da tela central)
    if (btnInfo) {
      btnInfo.addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof window.openEvento === 'function') {
          window.openEvento(currentIndex);
        }
      });
    }

    // Ação: Ver todos os eventos (redireciona para o catálogo independente)
    if (btnAll) {
      btnAll.addEventListener('click', function (e) {
        // Redireciona diretamente para a rota da página de eventos
        window.location.href = 'eventos.html';
      });
    }

    // Navegação EXCLUSIVAMENTE pelas setas:
    // O swipe de arrastar o dedo foi desativado conforme solicitado para permitir
    // a rolagem vertical natural do site e garantir controle unicamente pelas setas.

    // Suporte a teclado (setas esquerda/direita)
    document.addEventListener('keydown', function (e) {
      const section = document.getElementById('events');
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      if (isVisible) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          updateCarousel(currentIndex - 1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          updateCarousel(currentIndex + 1);
        }
      }
    });

    // Inicia na tela central (0)
    updateCarousel(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCinemaCarousel);
  } else {
    initCinemaCarousel();
  }
})();
