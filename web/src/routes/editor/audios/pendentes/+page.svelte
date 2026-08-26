<script lang="ts">
  /**
   * Sub-marco 5.D — Ciclos 5D.14, 5D.15 e 5D.16.
   *
   * `/editor/audios/pendentes/` — fila de aprovação com player inline,
   * paridade com `templates/hymns/editor/pending_audios.html`.
   *
   * O tipo do `data` é local porque `/editor/+layout.ts` é de outra frente.
   */
  import type { PendingAudio, PendingAudiosData } from "./+page";

  let { data }: { data: PendingAudiosData } = $props();

  function formatSize(bytes: number | null): string {
    if (bytes == null) return "—";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  function formatDuration(seconds: number | null): string {
    if (seconds == null) return "—";
    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${minutes}:${rest.toString().padStart(2, "0")}`;
  }

  function uploaderName(audio: PendingAudio): string {
    return audio.uploadedBy?.username ?? "Anônimo";
  }
</script>

<section class="editor-page" data-testid="pending-audios">
  <nav class="breadcrumb">
    <a href="/editor/">← Workspace editorial</a>
  </nav>

  {#if data.forbidden}
    <p data-testid="editor-forbidden">
      Você não tem acesso ao workspace do editor.
    </p>
  {:else}
    <header class="page-header">
      <div>
        <p class="label-mono">Workspace editorial</p>
        <h1>Áudios pendentes</h1>
        <p class="lede">Gravações enviadas aguardando aprovação. Ouça antes de aprovar.</p>
      </div>
      <p class="label-mono" data-testid="pending-count">
        {data.audios.length} pendente{data.audios.length === 1 ? "" : "s"}
      </p>
    </header>

    {#if data.error}
      <p class="page-error" role="alert" data-testid="pending-error">{data.error}</p>
    {/if}

    {#if data.audios.length === 0}
      <div class="empty" data-testid="pending-empty">
        <p class="empty-title">Nenhum áudio pendente.</p>
        <p>Quando alguém enviar uma gravação, ela aparece aqui para aprovação.</p>
      </div>
    {:else}
      <ul class="queue">
        {#each data.audios as audio (audio.id)}
          <li class="queue-item" data-testid="pending-audio-item">
            <p class="label-mono">
              Hino {audio.hymn.number} · {audio.hymn.hymnBook.name}
            </p>
            <h2 class="hymn-title">
              <a href="/hinos/{audio.hymn.id}">{audio.hymn.title}</a>
            </h2>
            {#if audio.title}
              <p class="audio-title">"{audio.title}"</p>
            {/if}
            <p class="meta label-mono">
              Enviado por {uploaderName(audio)}
              {#if audio.format} · {audio.format.toUpperCase()}{/if}
              · {formatSize(audio.fileSize)}
              · {formatDuration(audio.durationSeconds)}
            </p>
            {#if audio.credits}
              <p class="credits">{audio.credits}</p>
            {/if}

            <!-- svelte-ignore a11y_media_has_caption -->
            <audio
              class="player"
              controls
              src={audio.url}
              preload="none"
              data-testid="pending-audio-player"
            ></audio>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .editor-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .page-header {
    align-items: flex-end;
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    justify-content: space-between;
  }
  .label-mono {
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
  }
  .lede {
    margin: 0.5rem 0 0 0;
  }
  .queue {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .queue-item {
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 1.25rem;
  }
  .hymn-title {
    font-family: var(--font-display);
    font-size: 1.5rem;
    margin: 0;
  }
  .audio-title {
    font-family: var(--font-serif);
    font-style: italic;
    margin: 0;
  }
  .credits {
    margin: 0;
  }
  .player {
    margin-top: 0.75rem;
    width: 100%;
  }
  .empty {
    border: 1px solid var(--color-border-soft);
    border-radius: 0.75rem;
    padding: 2.5rem;
    text-align: center;
  }
  .empty-title {
    font-family: var(--font-display);
    font-size: 1.5rem;
    margin: 0 0 0.5rem 0;
  }
  .page-error {
    border: 1px solid var(--color-border-soft);
    border-radius: 0.5rem;
    padding: 0.625rem 0.875rem;
  }
</style>
