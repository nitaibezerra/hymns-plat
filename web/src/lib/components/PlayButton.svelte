<script lang="ts">
  /**
   * Marco 4.F — PlayButton.
   *
   * Botão "tocar este hino" reutilizável. Vive desacoplado do AudioPlayer:
   * a única responsabilidade é traduzir um click em
   * `audioPlayer.play(track)` ou `audioPlayer.togglePlay()` conforme o
   * estado atual do store.
   *
   * 4.E (página do hino) e 4.D (página do hinário) podem importar este
   * componente direto, sem reimplementar lógica de "esta faixa já está
   * tocando? Então só toggle".
   */
  import { audioPlayer, audioState, type AudioTrack } from "$lib/stores/audio";

  type Props = {
    track: AudioTrack;
    /** Rótulo customizável (default: "Tocar"). */
    label?: string;
  };

  let { track, label = "Tocar" }: Props = $props();

  let player = $derived($audioState);
  let isActive = $derived(player.currentTrack?.id === track.id);
  let isPlayingThis = $derived(isActive && player.isPlaying);
  let ariaLabel = $derived(isPlayingThis ? `Pausar ${track.title}` : `${label} ${track.title}`);

  function handleClick() {
    if (isActive) {
      audioPlayer.togglePlay();
    } else {
      audioPlayer.play(track);
    }
  }
</script>

<button
  type="button"
  class="play-button"
  class:active={isActive}
  data-testid="play-button"
  aria-label={ariaLabel}
  aria-pressed={isPlayingThis}
  onclick={handleClick}
>
  {#if isPlayingThis}
    <span aria-hidden="true">❚❚</span>
  {:else}
    <span aria-hidden="true">▶</span>
  {/if}
</button>

<style>
  .play-button {
    align-items: center;
    background: var(--color-accent);
    border: 1px solid transparent;
    border-radius: var(--radius-pill, 9999px);
    color: var(--color-bg);
    cursor: pointer;
    display: inline-flex;
    font-family: inherit;
    font-size: 0.9375rem;
    height: 2.25rem;
    justify-content: center;
    line-height: 1;
    padding: 0;
    width: 2.25rem;
  }
  .play-button:hover {
    filter: brightness(1.05);
  }
  .play-button.active {
    box-shadow: 0 0 0 2px var(--color-accent);
  }
</style>
