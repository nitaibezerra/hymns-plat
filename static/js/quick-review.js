/**
 * Tela 07c · Revisão ágil — atalhos de teclado + sync da prévia.
 *
 * Atalhos (única tela; sem conflito com a revisão completa):
 *   M / V / Z          → Marcha / Valsa / Mazurca
 *   1 / 2 / 3 / 4      → presets de Repetições
 *   ← / →              → navegar Anterior / Próximo (sem salvar)
 *   ⏎                  → submeter (Salvar e ir para o próximo)
 *
 * Pausa quando o input manual de repetições tem foco — assim o usuário
 * pode digitar dígitos sem que `1/2/3/4` mudem o tile ativo.
 */
(function () {
  var form = document.querySelector('[data-quick-review]');
  if (!form) return;

  var styleHidden = form.querySelector('[data-quick-style]');
  var repsInput = form.querySelector('[data-quick-reps]');
  var prevLink = form.querySelector('[data-quick-prev]');
  var nextLink = form.querySelector('[data-quick-next]');
  var previewBody = form.querySelector('[data-preview-body]');

  // ===== Mini-diagramas SVG dentro dos tiles de repetição =====
  // 4 linhas mudas + barras verticais à esquerda; a coluna mais externa
  // (range mais longo) fica à ESQUERDA, alinhada com `apps/hymns/repetitions.py`
  // (smaller-first → col 0 adjacente; englobante → col 1+).
  function parseReps(reps) {
    var out = [];
    (reps || '').split(',').forEach(function (chunk) {
      var m = chunk.trim().match(/(\d+)\s*-\s*(\d+)/);
      if (!m) return;
      var a = parseInt(m[1], 10);
      var b = parseInt(m[2], 10);
      if (a > b) { var t = a; a = b; b = t; }
      if (a > 0 && b >= a) out.push({ start: a, end: b });
    });
    return out;
  }
  function allocateColumns(ranges) {
    // Greedy column packing: ranges menores primeiro (col 0 = adjacente);
    // englobantes empurradas para col 1+ (mais à esquerda visualmente).
    var ordered = ranges.slice().sort(function (a, b) {
      return (a.end - a.start) - (b.end - b.start) || a.start - b.start;
    });
    var cols = [];
    ordered.forEach(function (r) {
      for (var c = 0; c < cols.length; c++) {
        var clash = cols[c].some(function (o) {
          return !(r.end < o.start || r.start > o.end);
        });
        if (!clash) {
          cols[c].push(r);
          r._col = c;
          return;
        }
      }
      cols.push([r]);
      r._col = cols.length - 1;
    });
    return { ranges: ordered, total: cols.length };
  }
  function renderMiniDiagram(host) {
    var reps = host.dataset.repValue || '';
    var W = 60, H = 50;
    var TOP = 7, LINE_GAP = 11, LINE_LEN = 30;
    var alloc = allocateColumns(parseReps(reps));
    var totalCols = Math.max(1, alloc.total);
    var COL_GAP = 3;
    var FIRST_COL_X = 14 - 6 - (totalCols - 1) * COL_GAP;
    var lines = '';
    for (var i = 0; i < 4; i++) {
      var y = TOP + i * LINE_GAP;
      lines += '<rect x="14" y="' + y + '" width="' + LINE_LEN + '" height="2" rx="1" class="quick-mini-line"/>';
    }
    var bars = '';
    alloc.ranges.forEach(function (r) {
      var y = TOP + (r.start - 1) * LINE_GAP - 2;
      var h = (r.end - r.start) * LINE_GAP + 6;
      var colFromRight = (totalCols - 1) - r._col;
      var x = FIRST_COL_X + colFromRight * COL_GAP;
      bars += '<rect x="' + x + '" y="' + y + '" width="1.6" height="' + h + '" rx="0.8" class="quick-mini-bar"/>';
    });
    host.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + lines + bars + '</svg>';
  }
  form.querySelectorAll('[data-rep-value]').forEach(renderMiniDiagram);

  // ===== Estado dos tiles =====
  function setActive(group, value) {
    form.querySelectorAll('[data-quick-tile="' + group + '"]').forEach(function (t) {
      t.dataset.active = String(t.dataset.value === value);
    });
  }
  function flash(tile) {
    tile.classList.add('quick-tile-flash');
    setTimeout(function () { tile.classList.remove('quick-tile-flash'); }, 350);
  }
  function setStyle(value, sourceTile) {
    if (styleHidden) styleHidden.value = value;
    setActive('style', value);
    if (sourceTile) flash(sourceTile);
  }
  function setReps(value, sourceTile) {
    if (repsInput) repsInput.value = value;
    setActive('repetitions', value);
    if (sourceTile) flash(sourceTile);
    schedulePreviewRerender();
  }

  // Cliques nos tiles
  form.addEventListener('click', function (e) {
    var tile = e.target.closest('[data-quick-tile]');
    if (!tile) return;
    e.preventDefault();
    var group = tile.dataset.quickTile;
    var value = tile.dataset.value;
    if (group === 'style') setStyle(value, tile);
    else if (group === 'repetitions') setReps(value, tile);
  });

  // Input manual de reps reflete no tile ativo + reativa preview
  if (repsInput) {
    repsInput.addEventListener('input', function () {
      setActive('repetitions', repsInput.value);
      schedulePreviewRerender();
    });
  }

  // ===== Live preview do server (igual editor-preview.js) =====
  var renderUrl = previewBody && previewBody.dataset.renderUrl;
  var renderTimer;
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
  }
  function schedulePreviewRerender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(rerenderPreview, 150);
  }
  async function rerenderPreview() {
    if (!renderUrl || !previewBody) return;
    try {
      var res = await fetch(renderUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          text: previewBody.dataset.text || previewBody.textContent || '',
          repetitions: repsInput ? repsInput.value : '',
        }),
      });
      if (!res.ok) return;
      var data = await res.json();
      previewBody.innerHTML = data.html || '';
    } catch (_) { /* keep last render */ }
  }
  // Captura o text do hino atual no primeiro load lendo o markup gerado pelo
  // server (linhas com data-line). Usamos isso pra alimentar futuros re-renders.
  (function captureInitialText() {
    if (!previewBody) return;
    var rows = previewBody.querySelectorAll('[data-line]');
    var lines = [];
    rows.forEach(function (el) { lines.push(el.textContent); });
    if (lines.length) previewBody.dataset.text = lines.join('\n');
  })();

  // ===== Atalhos =====
  document.addEventListener('keydown', function (e) {
    // Pausa quando input manual está em foco (digitar dígitos sem ativar 1/2/3/4)
    if (document.activeElement === repsInput) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var k = e.key;
    if (k === 'ArrowLeft') {
      if (prevLink) { e.preventDefault(); prevLink.click(); }
      return;
    }
    if (k === 'ArrowRight') {
      if (nextLink) { e.preventDefault(); nextLink.click(); }
      return;
    }
    if (k === 'Enter') {
      var t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      form.submit();
      return;
    }

    var upper = k.toUpperCase();
    var styleTile = form.querySelector('[data-quick-tile="style"][data-shortcut="' + upper + '"]');
    if (styleTile) {
      e.preventDefault();
      setStyle(styleTile.dataset.value, styleTile);
      return;
    }
    var repTile = form.querySelector('[data-quick-tile="repetitions"][data-shortcut="' + k + '"]');
    if (repTile) {
      e.preventDefault();
      setReps(repTile.dataset.value, repTile);
      return;
    }
  });
})();
