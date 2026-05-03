(function () {
  var carousel = document.querySelector('[data-carousel]');
  if (!carousel) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scrollBehavior = reduced ? 'auto' : 'smooth';

  var slides = carousel.querySelectorAll('article');
  var total = slides.length;
  if (total === 0) return;

  var dots = document.querySelectorAll('[data-carousel-dot]');
  var prevBtn = document.querySelector('[data-carousel-prev]');
  var nextBtn = document.querySelector('[data-carousel-next]');

  // Janela proporcional: máximo 11 dots; se hinário tem <11, oculta excedentes
  // (1:1 mapping). Caso contrário, cada dot representa um "bucket" da régua
  // total para indicar posição relativa (início/meio/fim).
  var MAX_DOTS = 11;
  var dotsCount = Math.min(MAX_DOTS, total);
  dots.forEach(function (d, idx) {
    d.style.display = idx < dotsCount ? '' : 'none';
  });

  function currentIndex() {
    var w = carousel.clientWidth;
    if (!w) return 0;
    return Math.round(carousel.scrollLeft / w);
  }

  // Mapeia índice do hino [0..total-1] → posição do dot [0..dotsCount-1].
  // Para hinários grandes (>11), usa floor(idx * dotsCount / total). Para
  // hinários pequenos (≤11), é 1:1 (idx === pos).
  function dotPositionForIndex(i) {
    if (total <= dotsCount) return i;
    return Math.min(dotsCount - 1, Math.floor((i * dotsCount) / total));
  }

  // Inverso: dado um dot ativo, retorna o índice do hino representado por ele
  // (centro do bucket). Usado no click handler.
  function indexForDotPosition(pos) {
    if (total <= dotsCount) return pos;
    return Math.min(total - 1, Math.floor(((pos + 0.5) * total) / dotsCount));
  }

  // Em hinários grandes (total > dotsCount), o dot ativo cresce proporcional-
  // mente ao progresso DENTRO do bucket — fornece feedback visual a cada hino
  // mesmo quando 1 dot representa ~11 hinos. Width vai de 8px (início do
  // bucket) até 32px (fim).
  function activeDotWidth(i, dotPos) {
    if (total <= dotsCount) return null; // sem ajuste; CSS controla
    var bucketStart = Math.floor((dotPos * total) / dotsCount);
    var bucketEnd = Math.floor(((dotPos + 1) * total) / dotsCount);
    var bucketSize = Math.max(1, bucketEnd - bucketStart);
    var fraction = (i - bucketStart) / bucketSize;
    if (fraction < 0) fraction = 0;
    if (fraction > 1) fraction = 1;
    return Math.round(8 + fraction * 24);
  }

  function slideContentHeight(slide) {
    if (!slide) return 0;
    // Altura natural do conteúdo do slide (inner div com pílula + card +
    // paddings). offsetHeight do article não basta porque o flex container
    // pode estar ditando altura via height.
    var inner = slide.firstElementChild;
    return inner ? inner.offsetHeight : slide.offsetHeight;
  }

  function syncContainerHeight(i) {
    if (!carousel) return;
    var h = slideContentHeight(slides[i]);
    if (h > 0) carousel.style.height = h + 'px';
  }

  function update() {
    var i = currentIndex();
    var activeDotPos = dotPositionForIndex(i);
    var activeWidth = activeDotWidth(i, activeDotPos);
    dots.forEach(function (d, idx) {
      var isActive = idx === activeDotPos;
      d.dataset.active = String(isActive);
      // Width custom só pro ativo em hinários grandes; resto fica com CSS.
      d.style.width = isActive && activeWidth !== null ? activeWidth + 'px' : '';
    });
    if (prevBtn) prevBtn.disabled = i === 0;
    if (nextBtn) nextBtn.disabled = i === total - 1;
    syncContainerHeight(i);
  }

  function goTo(i) {
    var clamped = Math.max(0, Math.min(total - 1, i));
    carousel.scrollTo({ left: clamped * carousel.clientWidth, behavior: scrollBehavior });
  }

  carousel.addEventListener('click', function (e) {
    if (e.target.closest('a, button, input, textarea, select')) return;
    var rect = carousel.getBoundingClientRect();
    var x = e.clientX - rect.left;
    goTo(currentIndex() + (x < rect.width / 2 ? -1 : 1));
  });

  var raf;
  carousel.addEventListener('scroll', function () {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  });

  dots.forEach(function (d) {
    d.addEventListener('click', function () {
      var pos = parseInt(d.dataset.dotPosition, 10);
      goTo(indexForDotPosition(pos));
    });
  });

  if (prevBtn) prevBtn.addEventListener('click', function () { goTo(currentIndex() - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { goTo(currentIndex() + 1); });

  function isCarouselVisible() {
    var pane = carousel.closest('[data-mode-pane="carrossel"]');
    return pane && !pane.classList.contains('hidden');
  }

  document.addEventListener('keydown', function (e) {
    if (!isCarouselVisible()) return;
    if (e.target && e.target.matches && e.target.matches('input, textarea, select, [contenteditable]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(currentIndex() - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(currentIndex() + 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      window.location.search = '?mode=indice';
    }
  });

  window.addEventListener('resize', function () {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  });

  update();

  // Re-sincronizar altura do container quando fonts carregarem (font-display
  // swap muda métricas tipográficas → altura do card cresce/encolhe).
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { update(); });
  }
})();
