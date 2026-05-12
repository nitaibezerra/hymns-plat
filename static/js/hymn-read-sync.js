/* Sincroniza a tela /ler/ com o áudio player.
 *
 * Comportamento:
 *  1. Ao carregar (load OU htmx:load por hx-boost): se `?hino=N` foi passado,
 *     posiciona no hino N (prioridade). Senão, se o player está tocando ESTE
 *     hinário, posiciona no hino atual. Senão fica no hino 1.
 *  2. Em runtime: ao receber `hinaria-player:track` dispatched pelo player,
 *     se o slug bate com o desta página, faz scroll suave para a âncora.
 *
 * No carrossel, "scroll" = goTo(idx) via scrollLeft do container.
 * No corrido, "scroll" = scrollIntoView na âncora `#hymn-N`.
 *
 * Importante: o script é carregado uma única vez no base.html. O listener
 * `htmx:load` cuida da re-inicialização quando a página `/ler/` chega via
 * hx-boost (DOMContentLoaded não dispara em navegações client-side).
 */
(function () {
  'use strict';

  var currentSlug = null; // slug da página /ler/ atualmente carregada

  function readPlayerState() {
    try { return JSON.parse(localStorage.getItem('hinaria-player') || '{}'); }
    catch (e) { return {}; }
  }

  function targetHymnOnLoad(page) {
    var initial = parseInt(page.dataset.initialHymn, 10) || null;
    if (initial) return initial;
    var ps = readPlayerState();
    var slug = page.dataset.bookSlug;
    if (ps && ps.book && ps.book.slug === slug && ps.queue && ps.queue[ps.currentIdx]) {
      return ps.queue[ps.currentIdx].n;
    }
    return null;
  }

  function scrollToHymn(n, smooth) {
    if (!n) return;
    var behavior = smooth ? 'smooth' : 'auto';
    var carousel = document.querySelector('[data-carousel]');
    if (carousel) {
      var slide = document.getElementById('hymn-slide-' + n);
      if (!slide) return;
      var slides = Array.prototype.slice.call(carousel.children);
      var idx = slides.indexOf(slide);
      if (idx < 0) return;
      var w = carousel.clientWidth;
      if (!w) return;
      carousel.scrollTo({ left: idx * w, behavior: behavior });
    } else {
      var anchor = document.getElementById('hymn-' + n);
      if (anchor) anchor.scrollIntoView({ behavior: behavior, block: 'start' });
    }
  }

  function init() {
    var page = document.querySelector('[data-reading-page]');
    if (!page) {
      currentSlug = null;
      return;
    }
    currentSlug = page.dataset.bookSlug;
    // Aguarda um tick para garantir que layout (clientWidth do carrossel,
    // posicionamento das âncoras do corrido) está estabilizado.
    requestAnimationFrame(function () {
      scrollToHymn(targetHymnOnLoad(page), false);
    });
  }

  // Carga inicial.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-inicialização quando a página /ler/ chega via hx-boost (HTMX swap).
  document.body.addEventListener('htmx:load', init);

  // Sincronia em runtime: player avançou de track.
  window.addEventListener('hinaria-player:track', function (ev) {
    if (!ev || !ev.detail) return;
    if (!currentSlug || ev.detail.slug !== currentSlug) return;
    scrollToHymn(ev.detail.n, true);
  });
})();
