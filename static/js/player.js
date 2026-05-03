/* Hinaria audio player Spotify-style.
 *
 * Estado global em localStorage (chave 'hinaria-player'). Sobrevive a:
 *  - navegação HTMX (hx-boost troca <main>; #player-root fica intacto).
 *  - reload completo (state restaurado, mas autoplay policy → playing=false).
 *
 * Spec: _design/PLAYER_DESIGN.md.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'hinaria-player';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const root = $('#player-root');
  if (!root) return;
  const audio = $('#player-audio');

  const state = {
    visible: false,
    playing: false,
    book: null,            // {slug, name, owner}
    queue: [],             // [{n, title, audioUrl, duration, style}] only hasAudio
    currentIdx: 0,
    progress: 0,           // 0..1
    expanded: false,
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      Object.assign(state, saved, { playing: false, expanded: false });
    } catch (e) { /* ignore */ }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        visible: state.visible,
        book: state.book,
        queue: state.queue,
        currentIdx: state.currentIdx,
        progress: state.progress,
      }));
    } catch (e) { /* ignore */ }
  }

  function set(patch) {
    Object.assign(state, patch);
    save();
    render();
  }

  function fmt(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function currentTrack() {
    return state.queue[state.currentIdx] || null;
  }

  function render() {
    document.body.classList.toggle('player-active', state.visible);
    root.classList.toggle('hidden', !state.visible);
    if (!state.visible) return;

    const t = currentTrack();
    if (!t) return;

    // Now-playing column
    const cover = $('[data-cover]', root);
    if (cover) $('[data-cover-num]', cover).textContent = String(t.n).padStart(2, '0');
    const titleEl = $('[data-title]', root);
    if (titleEl) titleEl.textContent = t.title;
    const subEl = $('[data-sub]', root);
    if (subEl && state.book) subEl.textContent = `${state.book.name} · ${state.book.owner || ''}`.replace(/ · $/, '');

    // Play/pause toggle via data-state (CSS swap dos SVGs). Aplica em todos
    // os data-play (bar, expanded, e workmode quando estiver carregado).
    $$('[data-play]').forEach(btn => {
      btn.dataset.state = state.playing ? 'playing' : 'paused';
      btn.setAttribute('aria-pressed', String(state.playing));
      btn.setAttribute('aria-label', state.playing ? 'Pausar' : 'Tocar');
    });
    // Mesma lógica nos botões ▶ do índice — só o hino ATUAL e tocando vira ⏸.
    const trackN = t.n;
    const trackSlug = state.book && state.book.slug;
    $$('[data-player-play-hymn]').forEach(btn => {
      const isCurrent = state.visible
        && trackSlug
        && btn.dataset.slug === trackSlug
        && parseInt(btn.dataset.n, 10) === trackN;
      btn.dataset.state = (isCurrent && state.playing) ? 'playing' : 'paused';
      btn.setAttribute('aria-label',
        isCurrent && state.playing ? `Pausar hino ${btn.dataset.n}` : `Tocar hino ${btn.dataset.n}`);
    });

    // Time + seek
    const dur = audio.duration || t.duration || 0;
    const cur = audio.currentTime || (state.progress * (dur || 1));
    $$('[data-current], [data-current-big]').forEach(el => el.textContent = fmt(cur));
    $$('[data-total], [data-total-big]').forEach(el => el.textContent = dur ? fmt(dur) : '—');
    $$('[data-seek], [data-seek-big]').forEach(input => {
      const ratio = dur ? (cur / dur) : 0;
      input.value = String(Math.round(ratio * 1000));
      input.style.backgroundSize = `${ratio * 100}% 100%`;
    });

    // Expanded view
    const exp = $('#player-expanded');
    if (exp) {
      exp.classList.toggle('hidden', !state.expanded);
      if (state.expanded) {
        $('[data-cover-big-num]', exp).textContent = String(t.n).padStart(2, '0');
        const eb = $('[data-expanded-eyebrow]', exp);
        if (eb && state.book) eb.textContent = `${state.book.name.toUpperCase()} · HINO ${String(t.n).padStart(2, '0')}`;
        $('[data-expanded-title]', exp).textContent = t.title;
        const lyrics = $('[data-lyrics]', exp);
        if (lyrics) lyrics.textContent = t.text || '';
        const pos = $('[data-position]', exp);
        if (pos && state.queue.length) pos.textContent = `${state.currentIdx + 1} de ${state.queue.length}`;
      }
    }
  }

  // ===== AUDIO ELEMENT WIRING =====

  function loadTrackIntoAudio(seekRatio) {
    const t = currentTrack();
    if (!t || !t.audioUrl) return;
    if (audio.src !== t.audioUrl) {
      audio.src = t.audioUrl;
    }
    if (typeof seekRatio === 'number' && isFinite(seekRatio)) {
      const onMeta = () => {
        try { audio.currentTime = seekRatio * (audio.duration || 0); } catch (e) {}
        audio.removeEventListener('loadedmetadata', onMeta);
      };
      if (audio.readyState >= 1 && audio.duration) {
        try { audio.currentTime = seekRatio * audio.duration; } catch (e) {}
      } else {
        audio.addEventListener('loadedmetadata', onMeta);
      }
    }
  }

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    state.progress = audio.currentTime / audio.duration;
    save();
    render();
  });
  audio.addEventListener('ended', () => {
    next();
  });
  audio.addEventListener('play', () => { state.playing = true; render(); });
  audio.addEventListener('pause', () => { state.playing = false; render(); });

  // ===== ACTIONS =====

  async function startBook(slug, fromHymnNumber) {
    try {
      const r = await fetch(`/api/hinarios/${slug}/queue/`, { credentials: 'same-origin' });
      if (!r.ok) return;
      const data = await r.json();
      const queue = (data.hymns || []).filter(h => h.hasAudio);
      if (!queue.length) {
        alert('Esse hinário ainda não tem gravações.');
        return;
      }
      let idx = 0;
      if (fromHymnNumber) {
        const hit = queue.findIndex(h => h.n === fromHymnNumber);
        if (hit >= 0) idx = hit;
      }
      set({
        visible: true,
        book: data.book,
        queue,
        currentIdx: idx,
        progress: 0,
      });
      loadTrackIntoAudio(0);
      audio.play().catch(() => {/* autoplay blocked */});
    } catch (e) {
      console.error('player startBook failed', e);
    }
  }

  function togglePlay() {
    if (!state.visible || !currentTrack()) return;
    if (audio.paused) {
      if (!audio.src) loadTrackIntoAudio(state.progress);
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  function next() {
    if (!state.queue.length) return;
    const nextIdx = state.currentIdx + 1;
    if (nextIdx >= state.queue.length) {
      audio.pause();
      set({ currentIdx: 0, progress: 0 });
      loadTrackIntoAudio(0);
      return;
    }
    set({ currentIdx: nextIdx, progress: 0 });
    loadTrackIntoAudio(0);
    audio.play().catch(() => {});
  }
  function prev() {
    if (!state.queue.length) return;
    if (audio.currentTime > 3) {
      try { audio.currentTime = 0; } catch (e) {}
      return;
    }
    const prevIdx = Math.max(0, state.currentIdx - 1);
    set({ currentIdx: prevIdx, progress: 0 });
    loadTrackIntoAudio(0);
    audio.play().catch(() => {});
  }

  function expand() { set({ expanded: true }); }
  function collapse() { set({ expanded: false }); }

  function close() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    set({ visible: false, playing: false, queue: [], currentIdx: 0, progress: 0, book: null });
  }

  function seekTo(ratio) {
    if (!audio.duration) return;
    try { audio.currentTime = ratio * audio.duration; } catch (e) {}
    state.progress = ratio;
    save();
    render();
  }

  // ===== DOM EVENTS =====

  function bind() {
    $$('[data-prev]', root).forEach(b => b.addEventListener('click', prev));
    $$('[data-next]', root).forEach(b => b.addEventListener('click', next));
    $$('[data-play]', root).forEach(b => b.addEventListener('click', togglePlay));
    $$('[data-expand]', root).forEach(b => b.addEventListener('click', expand));
    $$('[data-collapse]', root).forEach(b => b.addEventListener('click', collapse));
    $$('[data-close]', root).forEach(b => b.addEventListener('click', close));
    $$('[data-seek], [data-seek-big]', root).forEach(input => {
      input.addEventListener('input', e => {
        const ratio = parseInt(e.target.value, 10) / 1000;
        seekTo(ratio);
      });
    });
    // Tap na barra de now-playing → expand
    const now = $('[data-now]', root);
    if (now) now.addEventListener('click', expand);

    // Botões de "Tocar hinário" e "▶" por hino — espalhados pelo app.
    document.addEventListener('click', e => {
      const startBtn = e.target.closest('[data-player-start]');
      if (startBtn) {
        e.preventDefault();
        const slug = startBtn.dataset.playerStart;
        const n = startBtn.dataset.playerStartN ? parseInt(startBtn.dataset.playerStartN, 10) : null;
        startBook(slug, n);
        return;
      }
      const playHymnBtn = e.target.closest('[data-player-play-hymn]');
      if (playHymnBtn) {
        e.preventDefault();
        const slug = playHymnBtn.dataset.slug;
        const n = parseInt(playHymnBtn.dataset.n, 10);
        const t = currentTrack();
        const isCurrent = state.visible && t && state.book && state.book.slug === slug && t.n === n;
        if (isCurrent) togglePlay();
        else startBook(slug, n);
      }
    });

    // Atalhos globais.
    // Esc fecha expanded (cascata maior é tratada em PR #22 com workmode/queue).
    // Espaço alterna play/pause em qualquer página (ignora se foco em
    // input/textarea/contenteditable, ou se sem player ativo).
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.expanded) {
        e.preventDefault();
        collapse();
        return;
      }
      if (e.code === 'Space' || e.key === ' ') {
        const tgt = e.target;
        const isFormField = tgt && (
          tgt.matches('input, textarea, select, [contenteditable], [contenteditable="true"]')
        );
        if (isFormField) return;
        if (!state.visible) return;
        e.preventDefault();
        togglePlay();
      }
    });
  }

  // ===== BOOT =====

  function boot() {
    load();
    bind();
    if (state.visible && currentTrack()) {
      // Restaurar posição do áudio sem auto-play (browser policy).
      loadTrackIntoAudio(state.progress);
    }
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Expor pra debug
  window.HinariaPlayer = { state, set, startBook, togglePlay, next, prev };
})();
