// Toggle de tema light/dark, persistido em localStorage.
// O HTML já carrega o tema no início via inline script no <head>;
// este arquivo cuida do botão de toggle no header.
//
// Os ícones são SVGs inline injetados no <svg data-theme-icon> do header —
// usar emojis (☾ / ☀) renderizava em amarelo no macOS.

(function () {
  var ICON_MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>';
  var ICON_SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>';

  function applyIcon(t) {
    document.querySelectorAll('[data-theme-icon]').forEach(function (el) {
      el.innerHTML = t === 'dark' ? ICON_SUN : ICON_MOON;
    });
  }

  function setTheme(t) {
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'dark');
    document.documentElement.classList.add('theme-' + t);
    if (t === 'dark') document.documentElement.classList.add('dark');
    localStorage.setItem('theme', t);
    applyIcon(t);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    var current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  document.addEventListener('DOMContentLoaded', function () {
    var current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    applyIcon(current);
  });
})();
