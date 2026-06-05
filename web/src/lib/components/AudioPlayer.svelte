<script lang="ts">
  /**
   * Marco 4.F — Player global persistente.
   *
   * Singleton montado em `+layout.svelte`. Consome `audioState` e renderiza:
   *
   *   - Metadata (number + slug + title) à esquerda.
   *   - Controles play/prev/next + waveform/progress no centro.
   *   - Botões minimizar/fechar à direita.
   *
   * O `<audio>` HTML element vive aqui dentro — uma única instância em toda
   * a aplicação. Como o componente está no layout, **navegar entre rotas
   * não desmonta o `<audio>`**: esse é o teste-âncora do refactor (4F.9).
   *
   * Efeitos:
   *   - $effect sincroniza `isPlaying` → `audio.play()` / `audio.pause()`.
   *   - $effect copia `currentTrack` para `navigator.mediaSession.metadata`
   *     pra integração com lock screen / smart watches / fones bluetooth.
   *   - Listeners no `<audio>` espelham `currentTime`/`duration` no store.
   *
   * UI states:
   *   - `isDismissed=true` → some completamente; recriado quando play() é
   *     chamado de novo (4.D/4.E setam isDismissed=false).
   *   - `isMinimized=true` → barra fina; áudio continua tocando.
   */
  import Waveform from "./Waveform.svelte";
  import { audioPlayer, audioState } from "$lib/stores/audio";

  let audioEl: HTMLAudioElement | undefined = $state();

  // Espelha o store reativo localmente — `audioState` é writable store classic,
  // então usamos `$store` automático pelo Svelte 5 runes. Evitamos o nome
  // `state` por conflitar com a rune `$state`.
  let player = $derived($audioState);

  // 4F.7 — sincroniza isPlaying com o <audio> real.
  $effect(() => {
    if (!audioEl) return;
    if (player.currentTrack && player.isPlaying) {
      // play() retorna Promise — capturamos rejections (autoplay policy etc.)
      const result = audioEl.play();
      if (result && typeof result.catch === "function") {
        result.catch(() => {
          // Autoplay bloqueado pelo browser — mantém store coerente.
          audioPlayer.pause();
        });
      }
    } else if (audioEl) {
      audioEl.pause();
    }
  });

  // 4F.8 — Media Session metadata.
  $effect(() => {
    if (typeof navigator === "undefined") return;
    if (!("mediaSession" in navigator)) return;
    if (!player.currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }
    if (typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: player.currentTrack.title,
      artist: player.currentTrack.uploadedByUsername ?? "",
      album: "Hinária",
    });
  });

  function handleTimeUpdate(event: Event) {
    const target = event.currentTarget as HTMLAudioElement;
    audioPlayer.setCurrentTime(target.currentTime);
  }

  function handleLoadedMetadata(event: Event) {
    const target = event.currentTarget as HTMLAudioElement;
    if (Number.isFinite(target.duration)) {
      audioPlayer.setDuration(target.duration);
    }
  }

  function handleEnded() {
    // Avança fila se houver — senão pausa.
    if (player.queueIndex >= 0 && player.queueIndex < player.queue.length - 1) {
      audioPlayer.playNext();
    } else {
      audioPlayer.pause();
    }
  }

  function handlePlayClick() {
    audioPlayer.togglePlay();
  }

  function handlePrev() {
    audioPlayer.playPrev();
  }

  function handleNext() {
    audioPlayer.playNext();
  }

  function handleMinimize() {
    if (player.isMinimized) {
      audioPlayer.restore();
    } else {
      audioPlayer.minimize();
    }
  }

  function handleClose() {
    audioPlayer.dismiss();
  }

  function handleSeek(ratio: number) {
    const target = ratio * player.duration;
    if (audioEl && Number.isFinite(target)) {
      audioEl.currentTime = target;
    }
    audioPlayer.setCurrentTime(target);
  }

  let progress = $derived(player.duration > 0 ? player.currentTime / player.duration : 0);
  let isVisible = $derived(!!player.currentTrack && !player.isDismissed);
  let displayPeaks = $derived(player.currentTrack?.waveformPeaks ?? []);
</script>

<!--
  Sempre que `currentTrack` existir, mantemos o <audio> no DOM mesmo quando
  o usuário "fecha" (dismiss) — isso evita reset de buffer. Quando dismiss,
  apenas escondemos a barra.
-->
{#if player.currentTrack}
  <audio
    bind:this={audioEl}
    src={player.currentTrack.url}
    preload="metadata"
    data-testid="audio-player-audio"
    ontimeupdate={handleTimeUpdate}
    onloadedmetadata={handleLoadedMetadata}
    onended={handleEnded}
    onplay={() => audioPlayer.setPlaying(true)}
    onpause={() => audioPlayer.setPlaying(false)}
  ></audio>
{/if}

{#if isVisible}
  <div
    class="audio-player-bar"
    class:minimized={player.isMinimized}
    data-testid="audio-player-bar"
  >
    <div class="meta-col" data-testid="audio-player-meta">
      <div class="cover" aria-hidden="true">
        {player.currentTrack?.hymnNumber ?? "—"}
      </div>
      <div class="meta-text">
        <div class="title" data-testid="audio-player-title">
          {player.currentTrack?.title ?? ""}
        </div>
        <div class="sub">
          {#if player.currentTrack?.hymnbookSlug}
            <a href="/hinarios/{player.currentTrack.hymnbookSlug}/">
              {player.currentTrack.hymnbookSlug}
            </a>
          {/if}
        </div>
      </div>
    </div>

    <div class="controls-col">
      <div class="buttons">
        <button
          type="button"
          class="player-btn"
          aria-label="Anterior"
          data-testid="audio-player-prev"
          onclick={handlePrev}
        >
          ◀◀
        </button>
        <button
          type="button"
          class="player-btn play"
          aria-label={player.isPlaying ? "Pausar" : "Tocar"}
          aria-pressed={player.isPlaying}
          data-testid="audio-player-play"
          onclick={handlePlayClick}
        >
          {player.isPlaying ? "❚❚" : "▶"}
        </button>
        <button
          type="button"
          class="player-btn"
          aria-label="Próxima"
          data-testid="audio-player-next"
          onclick={handleNext}
        >
          ▶▶
        </button>
      </div>
      <div class="waveform-row">
        <Waveform peaks={displayPeaks} {progress} onSeek={handleSeek} />
      </div>
    </div>

    <div class="actions-col">
      <button
        type="button"
        class="player-btn-sm"
        aria-label={player.isMinimized ? "Restaurar player" : "Minimizar player"}
        data-testid="audio-player-minimize"
        onclick={handleMinimize}
      >
        {player.isMinimized ? "▲" : "▼"}
      </button>
      <button
        type="button"
        class="player-btn-sm"
        aria-label="Fechar player"
        data-testid="audio-player-close"
        onclick={handleClose}
      >
        ✕
      </button>
    </div>
  </div>
{/if}

<style>
  .audio-player-bar {
    align-items: center;
    background: var(--color-bg);
    border-top: 1px solid var(--color-border, #e5e5e5);
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
    display: grid;
    font-family: var(--font-sans);
    gap: 1rem;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
    padding: 0.625rem 1rem;
    pointer-events: auto;
  }
  .audio-player-bar.minimized {
    grid-template-columns: minmax(0, 1fr) auto auto;
    padding: 0.25rem 1rem;
  }
  .audio-player-bar.minimized .waveform-row,
  .audio-player-bar.minimized .sub {
    display: none;
  }

  .meta-col {
    align-items: center;
    display: flex;
    gap: 0.75rem;
    min-width: 0;
  }
  .cover {
    align-items: center;
    background: var(--color-accent, #444);
    border-radius: var(--radius-md, 4px);
    color: var(--color-bg, white);
    display: flex;
    flex-shrink: 0;
    font-family: var(--font-display, serif);
    font-size: 1rem;
    font-weight: 600;
    height: 2.5rem;
    justify-content: center;
    width: 2.5rem;
  }
  .meta-text {
    min-width: 0;
  }
  .title {
    color: var(--color-text);
    font-size: 0.9375rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub {
    color: var(--color-text-soft, #777);
    font-size: 0.8125rem;
  }
  .sub a {
    color: inherit;
    text-decoration: none;
  }
  .sub a:hover {
    color: var(--color-accent);
  }

  .controls-col {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  .buttons {
    align-items: center;
    display: flex;
    gap: 0.5rem;
  }
  .waveform-row {
    height: 1.75rem;
    width: 100%;
  }
  .player-btn,
  .player-btn-sm {
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md, 4px);
    color: var(--color-text);
    cursor: pointer;
    font-family: inherit;
    line-height: 1;
    padding: 0.375rem 0.625rem;
  }
  .player-btn-sm {
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
  }
  .player-btn:hover,
  .player-btn-sm:hover {
    border-color: var(--color-accent);
  }
  .player-btn.play {
    background: var(--color-accent);
    color: var(--color-bg);
  }

  .actions-col {
    align-items: center;
    display: flex;
    gap: 0.25rem;
  }
</style>
