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
    queueOpen: false,
    workMode: false,
    sleepMinutes: 0,       // 0 = off | 15 | 30 | 60
    sleepUntilTs: 0,       // epoch ms; 0 = no timer
  };

  let sleepTimerId = null;

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

    // Queue drawer
    const drawer = $('#player-queue');
    if (drawer) {
      drawer.classList.toggle('hidden', !state.queueOpen);
      if (state.queueOpen) renderQueueList(drawer);
    }
    const qToggle = $('[data-queue-toggle]', root);
    if (qToggle) qToggle.setAttribute('aria-expanded', String(state.queueOpen));

    // Work mode
    const wm = $('#player-workmode');
    if (wm) {
      wm.classList.toggle('hidden', !state.workMode);
      if (state.workMode) {
        const num = String(t.n).padStart(2, '0');
        $('[data-workmode-position]', wm).textContent = state.book ? `HINO ${num} · ${state.book.name.toUpperCase()}` : `HINO ${num}`;
        $('[data-workmode-title]', wm).textContent = t.title;
        const wmSeek = $('[data-seek-wm]', wm);
        if (wmSeek) {
          const ratio = dur ? (cur / dur) : 0;
          wmSeek.value = String(Math.round(ratio * 1000));
          wmSeek.style.backgroundSize = `${ratio * 100}% 100%`;
        }
      }
    }

    // Sleep button highlight
    const sleepBtn = $('[data-sleep-toggle]', root);
    if (sleepBtn) sleepBtn.dataset.active = String(state.sleepMinutes > 0);
  }

  function renderQueueList(drawer) {
    const eb = $('[data-queue-eyebrow]', drawer);
    if (eb && state.book) eb.textContent = `FILA · ${state.book.name.toUpperCase()}`;
    const stats = $('[data-queue-stats]', drawer);
    if (stats) stats.textContent = `${state.queue.length} hino${state.queue.length === 1 ? '' : 's'} na fila`;
    const list = $('[data-queue-list]', drawer);
    if (!list) return;
    list.innerHTML = '';
    state.queue.forEach((track, i) => {
      const li = document.createElement('li');
      li.dataset.idx = String(i);
      li.dataset.state = i < state.currentIdx ? 'played' : i === state.currentIdx ? 'current' : 'next';
      li.innerHTML = `
        <span class="q-num">${i === state.currentIdx ? '▶' : String(track.n).padStart(2, '0')}</span>
        <span class="q-title">${escapeHtml(track.title)}</span>
        <span class="q-dur">${track.duration ? fmt(track.duration) : ''}</span>
      `;
      li.addEventListener('click', () => jumpTo(i));
      list.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
      updateMediaSession();
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
    updateMediaSession();
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
    updateMediaSession();
  }

  function expand() { set({ expanded: true }); }
  function collapse() { set({ expanded: false }); }
  function openQueue() { set({ queueOpen: true }); }
  function closeQueue() { set({ queueOpen: false }); }
  function toggleQueue() { set({ queueOpen: !state.queueOpen }); }

  function enterWorkMode() {
    set({ workMode: true });
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').catch(() => {});
    }
  }
  function exitWorkMode() { set({ workMode: false }); }
  function toggleWorkMode() {
    if (state.workMode) exitWorkMode(); else enterWorkMode();
  }

  function jumpTo(i) {
    if (i < 0 || i >= state.queue.length) return;
    set({ currentIdx: i, progress: 0 });
    loadTrackIntoAudio(0);
    audio.play().catch(() => {});
    updateMediaSession();
  }

  function setSleepTimer(minutes) {
    if (sleepTimerId) {
      clearTimeout(sleepTimerId);
      sleepTimerId = null;
    }
    if (!minutes) {
      set({ sleepMinutes: 0, sleepUntilTs: 0 });
      return;
    }
    const ms = minutes * 60 * 1000;
    set({ sleepMinutes: minutes, sleepUntilTs: Date.now() + ms });
    sleepTimerId = setTimeout(() => {
      // Fade out 4s
      const startVol = audio.volume;
      const startTs = Date.now();
      const fadeDur = 4000;
      const fadeIv = setInterval(() => {
        const elapsed = Date.now() - startTs;
        const ratio = Math.max(0, 1 - elapsed / fadeDur);
        audio.volume = startVol * ratio;
        if (ratio <= 0) {
          clearInterval(fadeIv);
          audio.pause();
          audio.volume = startVol;
          set({ sleepMinutes: 0, sleepUntilTs: 0 });
        }
      }, 80);
    }, ms);
  }

  // ===== MediaSession API (lockscreen / Bluetooth headset controls) =====
  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const t = currentTrack();
    if (!t || !state.book) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: state.book.owner || '',
        album: state.book.name || '',
      });
      navigator.mediaSession.setActionHandler('play', () => togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
    } catch (e) { /* not supported on iOS Safari < 15 etc */ }
  }

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
    $$('[data-seek], [data-seek-big], [data-seek-wm]', root).forEach(input => {
      input.addEventListener('input', e => {
        const ratio = parseInt(e.target.value, 10) / 1000;
        seekTo(ratio);
      });
    });
    $$('[data-queue-toggle]', root).forEach(b => b.addEventListener('click', toggleQueue));
    $$('[data-queue-close]', root).forEach(b => b.addEventListener('click', closeQueue));
    $$('[data-workmode-toggle]', root).forEach(b => b.addEventListener('click', toggleWorkMode));
    $$('[data-workmode-exit]', root).forEach(b => b.addEventListener('click', exitWorkMode));
    $$('[data-sleep-toggle]', root).forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const menu = $('[data-sleep-menu]', root);
      if (menu) menu.classList.toggle('hidden');
    }));
    $$('[data-sleep-set]', root).forEach(b => b.addEventListener('click', e => {
      const min = parseInt(e.currentTarget.dataset.sleepSet, 10);
      setSleepTimer(min);
      const menu = $('[data-sleep-menu]', root);
      if (menu) menu.classList.add('hidden');
    }));
    document.addEventListener('click', e => {
      const menu = $('[data-sleep-menu]', root);
      if (menu && !menu.classList.contains('hidden') && !e.target.closest('.player-sleep-wrap')) {
        menu.classList.add('hidden');
      }
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
    // Esc fecha overlays na ordem: workmode → expanded → queue (cascata).
    // Espaço alterna play/pause em qualquer página (ignora foco em
    // input/textarea/contenteditable, ou se sem player ativo).
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (state.workMode) { e.preventDefault(); exitWorkMode(); return; }
        if (state.expanded) { e.preventDefault(); collapse(); return; }
        if (state.queueOpen) { e.preventDefault(); closeQueue(); return; }
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
      updateMediaSession();
    }
    // Reset effemeral overlays no boot.
    state.queueOpen = false;
    state.workMode = false;
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Expor pra debug
  window.HinariaPlayer = {
    state, set, startBook, togglePlay, next, prev,
    openQueue, closeQueue, enterWorkMode, exitWorkMode, setSleepTimer,
  };
})();
