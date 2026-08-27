<script lang="ts">
  /**
   * Marco 4.H — Ciclo 4H.3.
   *
   * Grid de áudios que o usuário fez upload (aba "Trabalho de áudio" do
   * perfil headless).
   *
   * Cada item é um cartão simples mostrando duração + link pra fonte. O
   * player global (4F) é o que toca de fato; aqui só listamos.
   */

  export interface UploadedAudio {
    id: string;
    url: string;
    durationSeconds: number | null;
    waveformPeaks: number[];
    uploadedBy: { id: string; username: string; email: string } | null;
  }

  let { audios }: { audios: UploadedAudio[] } = $props();

  function formatDuration(seconds: number | null): string {
    if (seconds === null || seconds <= 0) return "—";
    const total = Math.round(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
</script>

<section class="profile-uploads" data-testid="profile-uploads">
  <h2>Áudios enviados</h2>
  {#if audios.length === 0}
    <p data-testid="profile-uploads-empty">Nenhum áudio enviado.</p>
  {:else}
    <ul class="grid">
      {#each audios as audio (audio.id)}
        <li class="card" data-testid="profile-upload-item">
          <p class="duration">{formatDuration(audio.durationSeconds)}</p>
          <a class="link" href={audio.url} data-testid="profile-upload-link">
            Ouvir arquivo
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .profile-uploads {
    margin-top: 2rem;
  }
  h2 {
    font-family: var(--font-display, serif);
    font-size: 1.5rem;
    margin: 0 0 1rem;
  }
  .grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .card {
    background: var(--color-surface, transparent);
    border: 1px solid var(--color-border-soft, rgba(0, 0, 0, 0.08));
    border-radius: var(--radius-md, 0.5rem);
    padding: 1rem;
  }
  .duration {
    color: var(--color-text-soft, #888);
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    margin: 0 0 0.25rem;
    text-transform: uppercase;
  }
  .link {
    color: var(--color-accent, #b58d3e);
    font-size: 0.9375rem;
    text-decoration: none;
  }
  .link:hover {
    text-decoration: underline;
  }
</style>
