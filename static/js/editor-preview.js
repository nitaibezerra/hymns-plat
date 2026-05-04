/**
 * Tela 07 · Revisar Hino — preview ao vivo + caret highlight.
 *
 * Re-renderiza a coluna direita (prévia carrossel-style) sempre que o
 * textarea ou o campo `repetitions` mudam. Sincroniza a linha ativa
 * (cursor no textarea ↔ destaque dourado na prévia).
 *
 * Mantém em sync com `apps/hymns/services/preview.py::build_preview_stanzas`
 * (mesma lógica de stanzas + repetition bars). Se mudar um, mude o outro.
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

  var lineHeightPx = parseInt(previewBody.dataset.lineHeight || '26', 10);

  function parseReps(value) {
    if (!value) return [];
    var out = [];
    value.split(',').forEach(function (segment) {
      var m = segment.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
      if (!m) return;
      var a = parseInt(m[1], 10);
      var b = parseInt(m[2], 10);
      if (a > 0 && b >= a) out.push([a, b]);
    });
    return out;
  }

  function buildStanzas(text) {
    var stanzas = [];
    var current = [];
    var globalIdx = 0;
    (text || '').split('\n').forEach(function (raw) {
      if (raw.trim() === '') {
        if (current.length) { stanzas.push(current); current = []; }
        globalIdx += 1;
        return;
      }
      current.push({ text: raw, globalIdx: globalIdx });
      globalIdx += 1;
    });
    if (current.length) stanzas.push(current);
    return stanzas;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderPreview() {
    var text = textarea.value;
    var stanzas = buildStanzas(text);
    var ranges = parseReps(repsInput ? repsInput.value : '');

    // flatPositions: idx (1-based) → [stanzaIdx, lineInStanza]
    var flat = [];
    stanzas.forEach(function (st, si) {
      st.forEach(function (_ln, li) { flat.push([si, li]); });
    });

    if (stanzas.length === 0) {
      previewBody.innerHTML = '<p class="preview-empty">— sem texto ainda —</p>';
      return;
    }

    var html = '';
    stanzas.forEach(function (stanza, si) {
      html += '<div class="preview-stanza">';
      stanza.forEach(function (ln) {
        html += '<div class="preview-line" data-line="' + ln.globalIdx + '">' + escapeHtml(ln.text) + '</div>';
      });
      ranges.forEach(function (r) {
        if (r[0] - 1 >= flat.length || r[1] - 1 >= flat.length) return;
        var startPos = flat[r[0] - 1];
        var endPos = flat[r[1] - 1];
        if (startPos[0] !== si || endPos[0] !== si) return;
        var fromLine = startPos[1];
        var toLine = endPos[1];
        var top = fromLine * lineHeightPx + 4;
        var height = (toLine - fromLine + 1) * lineHeightPx - 8;
        html += '<div class="repetition-bar" style="top: ' + top + 'px; height: ' + height + 'px"></div>';
      });
      html += '</div>';
    });
    previewBody.innerHTML = html;
  }

  function updateActiveLine() {
    if (!textarea) return;
    var pos = textarea.selectionStart || 0;
    var idx = textarea.value.slice(0, pos).split('\n').length - 1;
    var total = textarea.value.split('\n').length;

    previewBody.querySelectorAll('.preview-line.is-active').forEach(function (el) {
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

  // Listeners
  textarea.addEventListener('input', function () {
    renderPreview();
    updateActiveLine();
  });
  textarea.addEventListener('keyup', updateActiveLine);
  textarea.addEventListener('click', updateActiveLine);
  textarea.addEventListener('select', updateActiveLine);
  if (repsInput) repsInput.addEventListener('input', renderPreview);
  if (titleInput) titleInput.addEventListener('input', updateTitle);
  if (numberInput) numberInput.addEventListener('input', updateTitle);

  // Inicial: render já vem do server, mas updateActiveLine para alinhar caret
  // (caso o cursor já esteja em algum lugar específico).
  updateActiveLine();
})();
