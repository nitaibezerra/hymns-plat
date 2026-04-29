// Audio player custom (Marco 2 — design da Fase 2).
//
// Identifica todo `[data-audio-card]` e cuida de:
//   - render das barras da waveform a partir de data-peaks (lista de 0..1).
//   - botão play/pause (toggle ícone, aria-label).
//   - timeupdate atualiza tempo + clip-path animado da camada "tocada".
//   - click na waveform faz seek.
//   - tecla Espaço quando o card tem foco → play/pause.
//   - persistência da posição em localStorage.

(function () {
  'use strict';

  const BAR_COUNT_DEFAULT = 80;

  function fmtTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function fallbackPeaks(n) {
    // Sem peaks reais → barras de altura uniforme (~50%) para manter ritmo visual.
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = 0.5;
    return out;
  }

  function renderBars(svg, peaks) {
    const baseG = svg.querySelector('[data-audio-bars-base]');
    const playedG = svg.querySelector('[data-audio-bars-played]');
    if (!baseG || !playedG) return;
    baseG.innerHTML = '';
    playedG.innerHTML = '';

    const total = peaks.length;
    const slot = 240 / total;          // largura por barra (incluindo gap)
    const barW = Math.max(1.2, slot * 0.55);

    for (let i = 0; i < total; i++) {
      const h = Math.max(2, peaks[i] * 32);  // altura mínima 2px para não sumir
      const y = (36 - h) / 2;
      const x = i * slot + (slot - barW) / 2;

      const r1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r1.setAttribute('x', x.toFixed(2));
      r1.setAttribute('y', y.toFixed(2));
      r1.setAttribute('width', barW.toFixed(2));
      r1.setAttribute('height', h.toFixed(2));
      r1.setAttribute('rx', '0.8');
      r1.setAttribute('fill', 'currentColor');
      baseG.appendChild(r1);

      const r2 = r1.cloneNode(false);
      playedG.appendChild(r2);
    }
  }

  function setupCard(card) {
    const audio = card.querySelector('[data-audio-source]');
    const btn = card.querySelector('[data-audio-toggle]');
    const playIcon = card.querySelector('[data-icon="play"]');
    const pauseIcon = card.querySelector('[data-icon="pause"]');
    const svg = card.querySelector('[data-audio-waveform-svg]');
    const waveBtn = card.querySelector('[data-audio-waveform]');
    const playedRect = card.querySelector('[data-audio-played-rect]');
    const tCur = card.querySelector('[data-audio-current]');
    const tTotal = card.querySelector('[data-audio-total]');

    if (!audio || !btn || !svg || !playedRect) return;

    let peaks;
    try {
      peaks = JSON.parse(card.dataset.peaks || '[]');
    } catch (e) {
      peaks = [];
    }
    if (!Array.isArray(peaks) || peaks.length === 0) {
      peaks = fallbackPeaks(BAR_COUNT_DEFAULT);
    }
    renderBars(svg, peaks);

    const id = card.dataset.audioId;
    const storageKey = 'audio_position_' + id;
    const savedPos = parseFloat(localStorage.getItem(storageKey) || '0');
    if (savedPos > 0) {
      audio.addEventListener(
        'loadedmetadata',
        () => { audio.currentTime = savedPos; },
        { once: true },
      );
    }

    function setPlaying(playing) {
      playIcon.classList.toggle('hidden', playing);
      pauseIcon.classList.toggle('hidden', !playing);
      btn.setAttribute('aria-label', playing ? 'Pausar áudio' : 'Tocar áudio');
    }

    btn.addEventListener('click', () => {
      if (audio.paused) audio.play(); else audio.pause();
    });

    audio.addEventListener('play', () => setPlaying(true));
    audio.addEventListener('pause', () => setPlaying(false));
    audio.addEventListener('ended', () => {
      setPlaying(false);
      audio.currentTime = 0;
      updatePlayed(0);
      localStorage.removeItem(storageKey);
    });

    audio.addEventListener('loadedmetadata', () => {
      if (tTotal && audio.duration) tTotal.textContent = fmtTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      if (tCur) tCur.textContent = fmtTime(audio.currentTime);
      const ratio = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
      updatePlayed(ratio);
      if (!audio.paused) localStorage.setItem(storageKey, audio.currentTime);
    });

    function updatePlayed(ratio) {
      const w = Math.max(0, Math.min(1, ratio)) * 240;
      playedRect.setAttribute('width', w.toFixed(2));
    }

    waveBtn.addEventListener('click', (e) => {
      const rect = svg.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      if (audio.duration) audio.currentTime = ratio * audio.duration;
    });

    card.tabIndex = 0;
    card.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        btn.click();
      } else if (e.key === 'ArrowLeft' && e.ctrlKey) {
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 5);
      } else if (e.key === 'ArrowRight' && e.ctrlKey) {
        e.preventDefault();
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-audio-card]').forEach(setupCard);
  });
})();
