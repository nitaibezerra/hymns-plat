/**
 * Tela 07 · Revisar Hino — preview ao vivo + caret highlight.
 *
 * A prévia (coluna direita) reusa o template tag `render_hymn_body` (via
 * endpoint `editor_preview_render`) — exatamente o mesmo markup das telas
 * públicas (corrido/carrossel/hymn_detail). Ao mudar o textarea ou o input
 * de repetições, JS faz fetch debounced ao endpoint e troca o innerHTML.
 *
 * Caret highlight: cada `.hymn-line` carrega `data-line="N"` (índice da row
 * no texto). JS escuta keyup/click/select no textarea, calcula a linha do
 * cursor e aplica `.is-active` no match.
 */
(function () {
  var form = document.querySelector('[data-revise-form]');
  if (!form) return;

  var textarea = form.querySelector('[data-revise-textarea]');
  var repsInput = form.querySelector('[data-revise-reps]');
  var titleInput = form.querySelector('input[name="title"]');
  var numberInput = form.querySelector('input[name="number"]');
  var previewTitle = document.querySelector('[data-preview-title]');
  var previewBody = document.querySelector('[data-preview-body]');
  var caretLineEl = document.querySelector('[data-caret-line]');
  var caretTotalEl = document.querySelector('[data-caret-total]');

  if (!textarea || !previewBody) return;

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
  }

  var renderUrl = previewBody.dataset.renderUrl;

  // ===== Live preview via server render =====
  var renderTimer;
  function scheduleRerender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(rerender, 250);
  }

  async function rerender() {
    if (!renderUrl) return;
    try {
      var res = await fetch(renderUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          text: textarea.value,
          repetitions: repsInput ? repsInput.value : '',
        }),
      });
      if (!res.ok) return;
      var data = await res.json();
      previewBody.innerHTML = data.html || '';
      updateActiveLine();
    } catch (_) {
      // Falha silenciosa — a prévia volta ao último estado renderizado.
    }
  }

  function updateActiveLine() {
    var pos = textarea.selectionStart || 0;
    var idx = textarea.value.slice(0, pos).split('\n').length - 1;
    var total = textarea.value.split('\n').length;
    previewBody.querySelectorAll('.hymn-line.is-active').forEach(function (el) {
      el.classList.remove('is-active');
    });
    var target = previewBody.querySelector('[data-line="' + idx + '"]');
    if (target) target.classList.add('is-active');
    if (caretLineEl) caretLineEl.textContent = idx + 1;
    if (caretTotalEl) caretTotalEl.textContent = total;
  }

  function updateTitle() {
    if (!previewTitle) return;
    var n = numberInput ? numberInput.value : '';
    var t = titleInput ? titleInput.value : '';
    previewTitle.textContent = (n ? n + ' - ' : '') + t;
  }

  textarea.addEventListener('input', scheduleRerender);
  textarea.addEventListener('keyup', updateActiveLine);
  textarea.addEventListener('click', updateActiveLine);
  textarea.addEventListener('select', updateActiveLine);
  if (repsInput) repsInput.addEventListener('input', scheduleRerender);
  if (titleInput) titleInput.addEventListener('input', updateTitle);
  if (numberInput) numberInput.addEventListener('input', updateTitle);

  // Initial caret state — preview já vem do server.
  updateActiveLine();
})();
