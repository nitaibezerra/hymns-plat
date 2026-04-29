// Toggle de tema light/dark, persistido em localStorage.
// O HTML já carrega o tema no início via inline script no <head>;
// este arquivo cuida do botão de toggle no header.

(function () {
  function setTheme(t) {
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'dark');
    document.documentElement.classList.add('theme-' + t);
    if (t === 'dark') document.documentElement.classList.add('dark');
    localStorage.setItem('theme', t);
    document.querySelectorAll('[data-theme-icon]').forEach(function (el) {
      el.textContent = t === 'dark' ? '☀' : '☾';
    });
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    var current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
  // Garante que o ícone reflete o estado atual no carregamento.
  document.addEventListener('DOMContentLoaded', function () {
    var current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    document.querySelectorAll('[data-theme-icon]').forEach(function (el) {
      el.textContent = current === 'dark' ? '☀' : '☾';
    });
  });
})();
