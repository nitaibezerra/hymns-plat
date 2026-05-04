/**
 * Tela 07 · Revisar Hino — bloco de revisão de áudio.
 *
 * - Player: play/pause, scrub via clique no waveform, ±10s, ciclo de velocidade.
 * - Revisão: clicar ✓ Confere / ✗ Não confere → POST. Mostra/esconde quality
 *   ou mismatch block. Ratings, observations e mismatch reasons também
 *   disparam POST individuais.
 *
 * Endpoint: data-review-url no [data-audio-review-root].
 */
(function () {
  var root = document.querySelector('[data-audio-review-root]');
  if (!root) return;

  var url = root.dataset.reviewUrl;
  var audio = root.querySelector('[data-audio-source]');
  var playBtn = root.querySelector('[data-audio-toggle]');
  var iconPlay = root.querySelector('[data-icon-play]');
  var iconPause = root.querySelector('[data-icon-pause]');
  var waveform = root.querySelector('[data-audio-waveform]');
  var currentEl = root.querySelector('[data-audio-current]');
  var speedBtn = root.querySelector('[data-audio-speed]');

  // ===== Helpers =====
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
  }

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  async function postReview(payload) {
    if (!url) return;
    try {
      var res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  // ===== Waveform render =====
  function renderWaveform() {
    if (!waveform) return;
    var peaksAttr = audio ? audio.dataset.peaks : '[]';
    var peaks = [];
    try { peaks = JSON.parse(peaksAttr || '[]'); } catch (_) { peaks = []; }
    if (!peaks.length) {
      // Fake bars com altura senoidal estável quando não há peaks reais.
      for (var i = 0; i < 64; i++) {
        peaks.push(0.3 + 0.5 * Math.abs(Math.sin(i * 0.7)));
      }
    }
    var html = '';
    peaks.forEach(function (p) {
      var h = Math.max(2, Math.round(p * 28)); // 2..30px
      html += '<div class="bar" style="height:' + h + 'px"></div>';
    });
    waveform.innerHTML = html;
  }
  renderWaveform();

  function refreshPlayedBars() {
    if (!waveform || !audio || !audio.duration) return;
    var ratio = audio.currentTime / audio.duration;
    var bars = waveform.querySelectorAll('.bar');
    var cutoff = Math.floor(ratio * bars.length);
    bars.forEach(function (bar, i) {
      bar.classList.toggle('played', i < cutoff);
    });
  }

  // ===== Play / pause =====
  if (playBtn && audio) {
    playBtn.addEventListener('click', function () {
      if (audio.paused) audio.play();
      else audio.pause();
    });
    audio.addEventListener('play', function () {
      if (iconPlay) iconPlay.classList.add('hidden');
      if (iconPause) iconPause.classList.remove('hidden');
    });
    audio.addEventListener('pause', function () {
      if (iconPlay) iconPlay.classList.remove('hidden');
      if (iconPause) iconPause.classList.add('hidden');
    });
    audio.addEventListener('timeupdate', function () {
      if (currentEl) currentEl.textContent = fmt(audio.currentTime);
      refreshPlayedBars();
    });
  }

  // ===== Scrub via waveform =====
  if (waveform && audio) {
    waveform.addEventListener('click', function (e) {
      if (!audio.duration) return;
      var rect = waveform.getBoundingClientRect();
      var ratio = (e.clientX - rect.left) / rect.width;
      audio.currentTime = ratio * audio.duration;
    });
  }

  // ===== Skip ±10s =====
  root.querySelectorAll('[data-audio-skip]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!audio) return;
      var delta = parseInt(btn.dataset.audioSkip, 10);
      audio.currentTime = Math.max(0, audio.currentTime + delta);
    });
  });

  // ===== Velocidade =====
  var speeds = [1, 1.25, 1.5, 0.75];
  var speedIdx = 0;
  if (speedBtn && audio) {
    speedBtn.addEventListener('click', function () {
      speedIdx = (speedIdx + 1) % speeds.length;
      var s = speeds[speedIdx];
      audio.playbackRate = s;
      speedBtn.textContent = s + '×';
    });
  }

  // ===== Match (Sim/Não) =====
  var qualityBlock = root.querySelector('[data-quality-block]');
  var mismatchBlock = root.querySelector('[data-mismatch-block]');

  function setActive(selector, valueAttr, value) {
    root.querySelectorAll(selector).forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute(valueAttr) === String(value));
    });
  }

  function applyState(state) {
    if (state == null) return;
    if ('is_match' in state) {
      setActive('[data-audio-match]', 'data-audio-match', state.is_match === null ? '' : String(state.is_match));
      if (qualityBlock) qualityBlock.toggleAttribute('hidden', state.is_match !== true);
      if (mismatchBlock) mismatchBlock.toggleAttribute('hidden', state.is_match !== false);
    }
    if ('quality_rating' in state) {
      var r = state.quality_rating || 0;
      root.querySelectorAll('[data-quality-rating]').forEach(function (el) {
        el.classList.toggle('is-active', parseInt(el.dataset.qualityRating, 10) <= r);
      });
    }
    if ('quality_observations' in state) {
      var obs = state.quality_observations || [];
      root.querySelectorAll('[data-observation]').forEach(function (el) {
        el.classList.toggle('is-active', obs.indexOf(el.dataset.observation) >= 0);
      });
    }
    if ('mismatch_reason' in state) {
      setActive('[data-mismatch-reason]', 'data-mismatch-reason', state.mismatch_reason || '');
    }
  }

  root.querySelectorAll('[data-audio-match]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var v = btn.dataset.audioMatch === 'true';
      var state = await postReview({ is_match: v });
      applyState(state || { is_match: v });
    });
  });

  root.querySelectorAll('[data-quality-rating]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var v = parseInt(btn.dataset.qualityRating, 10);
      var state = await postReview({ quality_rating: v });
      applyState(state || { quality_rating: v });
    });
  });

  // Observations: toggle individual chip; envia lista atualizada.
  root.querySelectorAll('[data-observation]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      btn.classList.toggle('is-active');
      var current = [];
      root.querySelectorAll('[data-observation].is-active').forEach(function (el) {
        current.push(el.dataset.observation);
      });
      var state = await postReview({ quality_observations: current });
      applyState(state || { quality_observations: current });
    });
  });

  root.querySelectorAll('[data-mismatch-reason]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var v = btn.dataset.mismatchReason;
      var state = await postReview({ mismatch_reason: v });
      applyState(state || { mismatch_reason: v });
    });
  });
})();
