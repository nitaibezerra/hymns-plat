<script lang="ts">
  /**
   * Marco 4.E — Ciclo 4E.5.
   *
   * Botão de play mínimo: dispara `audioPlayer.play(track)` do stub
   * `$lib/stores/audio`. A impl real do player (queue, waveform animado,
   * Media Session API) vem no sub-marco 4.F — aqui apenas garantimos que
   * a UI do detalhe consegue empurrar uma `AudioTrack` pro store global.
   */
  import { audioPlayer, type AudioTrack } from "$lib/stores/audio";

  let { track }: { track: AudioTrack } = $props();

  function onPlay(): void {
    audioPlayer.play(track);
  }
</script>

<button
  type="button"
  class="play-button"
  data-testid="play-button"
  aria-label={`Tocar ${track.title}`}
  onclick={onPlay}
>
  <span aria-hidden="true">▶</span>
  <span>Tocar</span>
</button>

<style>
  .play-button {
    align-items: center;
    background: var(--color-accent);
    border: none;
    border-radius: 999px;
    color: var(--color-bg);
    cursor: pointer;
    display: inline-flex;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
  }
  .play-button:hover {
    filter: brightness(0.95);
  }
</style>
