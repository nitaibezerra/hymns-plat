// Mobile drawer menu — open via [data-mobile-menu-toggle], close via close button,
// click on backdrop, ESC, or navigating away. Respects prefers-reduced-motion via CSS.

(function () {
  var menu = document.querySelector('[data-mobile-menu]');
  var backdrop = document.querySelector('[data-mobile-menu-backdrop]');
  var toggle = document.querySelector('[data-mobile-menu-toggle]');
  var close = document.querySelector('[data-mobile-menu-close]');
  if (!menu || !backdrop || !toggle) return;

  function open() {
    menu.classList.remove('translate-x-full');
    menu.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('opacity-100');
    document.body.style.overflow = 'hidden';
    // Move focus to the menu so screen readers/keyboard users land inside.
    menu.focus({ preventScroll: true });
  }

  function shut() {
    menu.classList.add('translate-x-full');
    menu.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    backdrop.classList.remove('opacity-100');
    document.body.style.overflow = '';
    toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', open);
  if (close) close.addEventListener('click', shut);
  backdrop.addEventListener('click', shut);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.getAttribute('aria-hidden') === 'false') shut();
  });
  // Close when navigating to a link inside the drawer (so clicking a nav item
  // doesn't leave a stuck-open menu in single-page-style transitions).
  menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', shut);
  });
})();
