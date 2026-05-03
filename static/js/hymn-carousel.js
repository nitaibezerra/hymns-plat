(function () {
  var carousel = document.querySelector('[data-carousel]');
  if (!carousel) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scrollBehavior = reduced ? 'auto' : 'smooth';

  var slides = carousel.querySelectorAll('article');
  var total = slides.length;
  if (total === 0) return;

  var counter = document.querySelector('[data-carousel-counter]');
  var progress = document.querySelector('[data-carousel-progress]');
  var dots = document.querySelectorAll('[data-carousel-dot]');
  var prevBtn = document.querySelector('[data-carousel-prev]');
  var nextBtn = document.querySelector('[data-carousel-next]');
  var hymnbookName = (document.querySelector('h1') || {}).textContent || '';
  hymnbookName = hymnbookName.trim().toUpperCase();

  function currentIndex() {
    var w = carousel.clientWidth;
    if (!w) return 0;
    return Math.round(carousel.scrollLeft / w);
  }

  function update() {
    var i = currentIndex();
    var slide = slides[i];
    var hymnNumber = slide ? (slide.id || '').replace('hymn-slide-', '') : String(i + 1);
    var label = 'HINO ' + String(hymnNumber).padStart(2, '0') + ' · DE ' + total;
    if (counter) counter.textContent = label;
    if (progress) progress.style.width = (((i + 1) / total) * 100).toFixed(2) + '%';
    dots.forEach(function (d, idx) {
      var active = idx === i;
      d.dataset.active = String(active);
      d.classList.toggle('bg-gold', active);
      d.classList.toggle('bg-ink/20', !active);
      d.classList.toggle('w-3', active);
      d.classList.toggle('h-3', active);
      d.classList.toggle('w-2', !active);
      d.classList.toggle('h-2', !active);
    });
    if (prevBtn) prevBtn.disabled = i === 0;
    if (nextBtn) nextBtn.disabled = i === total - 1;
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
    d.addEventListener('click', function () { goTo(parseInt(d.dataset.index, 10)); });
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
})();
