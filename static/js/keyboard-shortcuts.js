// Atalhos de teclado globais:
//   ⌘K (ou Ctrl+K) → foca o input de busca no header.
//   j / k          → no detalhe de hino, navega para próximo/anterior
//                    (respeita data-prev-url / data-next-url no <main>).
//   ⌘S             → no formulário de revisão, salva como rascunho.

(function () {
  document.addEventListener('keydown', function (e) {
    var meta = e.metaKey || e.ctrlKey;
    var input = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);

    if (meta && (e.key === 'k' || e.key === 'K')) {
      var search = document.querySelector('[data-global-search]');
      if (search) {
        e.preventDefault();
        search.focus();
        search.select && search.select();
      }
    }

    if (!input && (e.key === 'j' || e.key === 'k')) {
      var main = document.querySelector('main');
      if (!main) return;
      var url = e.key === 'j' ? main.dataset.nextUrl : main.dataset.prevUrl;
      if (url) window.location.href = url;
    }

    if (meta && e.key === 's') {
      var form = document.querySelector('[data-revise-form]');
      if (form) {
        e.preventDefault();
        var draft = form.querySelector('[data-action="draft"]');
        if (draft) draft.click();
      }
    }
  });
})();
