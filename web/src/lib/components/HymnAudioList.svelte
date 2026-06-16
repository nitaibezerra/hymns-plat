<script lang="ts">
  /**
   * Marco 4.E — Ciclos 4E.5 e 4E.6.
   *
   * Lista de áudios do hino.
   *
   * 4E.5 — renderiza áudios aprovados (`isApproved=true`) com PlayButton
   * que dispara o stub `audioPlayer.play(track)`. O backend já filtra por
   * `is_approved=True` quando `approvedOnly=true` (default da query).
   *
   * 4E.6 — quando o usuário atual (`currentUser`) é o uploader do áudio
   * OU é editor/admin (`isEditor`), os áudios pendentes aparecem com o
   * badge "Aguardando aprovação". Como o schema vigente sempre filtra
   * `approvedOnly=true` na query default, na prática os pendentes só vão
   * aparecer quando a load function pedir `approvedOnly=false` no futuro;
   * por ora o componente só sabe lidar com a flag opcional `isApproved`
   * no payload (default = true) — quando ela vier `false`, a regra de
   * exibição abaixo aplica.
   */
  import PlayButton from "./PlayButton.svelte";
  import type { AudioTrack } from "$lib/stores/audio";

  export interface HymnAudio {
    id: string;
    url: string;
    waveformPeaks: number[];
    durationSeconds: number | null;
    uploadedBy: { id: string; username: string } | null;
    isApproved?: boolean;
  }

  export interface CurrentUserRef {
    id: string;
    username: string;
  }

  let {
    audios = [],
    hymnTitle = "",
    hymnNumber,
    currentUser = null,
    isEditor = false,
  }: {
    audios?: HymnAudio[];
    hymnTitle?: string;
    hymnNumber?: number;
    currentUser?: CurrentUserRef | null;
    isEditor?: boolean;
  } = $props();

  function isPending(audio: HymnAudio): boolean {
    return audio.isApproved === false;
  }

  function canSeePending(audio: HymnAudio): boolean {
    if (isEditor) return true;
    if (currentUser && audio.uploadedBy && audio.uploadedBy.id === currentUser.id) return true;
    return false;
  }

  function toTrack(audio: HymnAudio): AudioTrack {
    return {
      id: audio.id,
      url: audio.url,
      title: hymnTitle,
      hymnNumber,
      waveformPeaks: audio.waveformPeaks,
      durationSeconds: audio.durationSeconds,
      uploadedByUsername: audio.uploadedBy?.username ?? null,
    };
  }

  function formatDuration(seconds: number | null): string {
    if (seconds == null) return "—";
    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${minutes}:${rest.toString().padStart(2, "0")}`;
  }

  const visible = $derived(
    audios.filter((a) => !isPending(a) || canSeePending(a)),
  );
</script>

<section class="audios" data-testid="audios">
  <h2 class="audios-title">
    Áudios · {visible.length} gravaç{visible.length === 1 ? "ão" : "ões"}
  </h2>
  <ul class="audios-list">
    {#each visible as audio (audio.id)}
      <li class="audio-item" data-testid="audio-item">
        <div class="audio-meta">
          <span class="audio-uploader">
            {audio.uploadedBy?.username ?? "Anônimo"}
          </span>
          <span class="audio-duration">{formatDuration(audio.durationSeconds)}</span>
          {#if isPending(audio)}
            <span class="badge-pending" data-testid="badge-pending">
              Aguardando aprovação
            </span>
          {/if}
        </div>
        <PlayButton track={toTrack(audio)} />
      </li>
    {/each}
  </ul>
</section>

<style>
  .audios {
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.75rem;
    padding: 1.25rem;
  }
  .audios-title {
    font-family: var(--font-display);
    font-size: 1.125rem;
    margin: 0 0 0.75rem 0;
  }
  .audios-list {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .audio-item {
    align-items: center;
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    padding: 0.625rem 0.875rem;
  }
  .audio-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    font-family: var(--font-sans);
    font-size: 0.875rem;
  }
  .audio-uploader {
    font-weight: 600;
  }
  .audio-duration {
    color: var(--color-text-soft);
    font-variant-numeric: tabular-nums;
  }
  .badge-pending {
    background: var(--color-surface-soft);
    border: 1px solid var(--color-border-soft);
    border-radius: 999px;
    color: var(--color-text-soft);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0.125rem 0.5rem;
    text-transform: uppercase;
  }
</style>
