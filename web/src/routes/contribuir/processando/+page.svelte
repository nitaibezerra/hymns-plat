<script lang="ts">
  /**
   * Sub-marco 5.F — Ciclos 5F.9 a 5F.11.
   *
   * Tela 2 do wizard. O polling vive em `$lib/ocr-polling` e é ligado no
   * mount / desligado no unmount (`$effect` devolve o cleanup) — sem isso a
   * tela continuaria batendo no backend depois de o usuário sair.
   *
   * Quando a task fica pronta, esta tela decide o próximo passo — é o mesmo
   * desvio que a `upload_processing_view` fazia no servidor: com duplicata vai
   * pra desambiguação, sem duplicata vai direto pra conferência.
   */
  import { goto } from "$app/navigation";
  import OcrProgress from "$lib/components/contribuir/OcrProgress.svelte";
  import UploadStepper from "$lib/components/contribuir/UploadStepper.svelte";
  import { startOcrPolling } from "$lib/ocr-polling";

  import { fetchOcrDuplicates } from "../ocr-duplicates";
  import { fetchOcrTask } from "../ocr-task";

  import type { OcrTaskSnapshot } from "$lib/ocr-polling";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // `data.task` é o snapshot do SSR; o polling sobrescreve. Manter os dois em
  // `$derived` (em vez de copiar `data` num `$state`) deixa a tela correta se
  // a load function rodar de novo — e é o que o Svelte 5 pede.
  let polledTask = $state<OcrTaskSnapshot | null>(null);
  let polledError = $state<string | null>(null);
  // Erro definitivo: o polling parou e não vai voltar sozinho (5F.10).
  let fatalError = $state<string | null>(null);

  const task = $derived(polledTask ?? data.task);
  // Depois do primeiro snapshot do polling, um erro do SSR já é notícia velha.
  const networkError = $derived(polledError ?? (polledTask ? null : data.error));

  async function advance(taskId: string) {
    const duplicates = await fetchOcrDuplicates(fetch, taskId);
    const next = duplicates.hasDuplicates ? "desambiguar" : "conferir";
    await goto(`/contribuir/${next}/?task=${taskId}`);
  }

  $effect(() => {
    const taskId = data.taskId;
    if (!taskId) return;

    const handle = startOcrPolling({
      fetchTask: () => fetchOcrTask(fetch, taskId),
      onUpdate: (snapshot) => {
        polledTask = snapshot;
        polledError = null;
      },
      onError: (message) => {
        polledError = message;
      },
      onMissing: () => {
        polledError = null;
        fatalError = "Tarefa de OCR não encontrada.";
      },
      onDone: (snapshot) => {
        // `failed` fica na tela (o OcrProgress desenha o erro); só a task
        // pronta segue pro próximo passo.
        if (snapshot.status !== "completed") return;
        void advance(taskId);
      },
    });

    return () => handle.stop();
  });
</script>

<section data-testid="processando-page">
  <p class="eyebrow">Contribuir · processando</p>
  <h1>Extraindo o texto…</h1>

  <div class="stepper">
    <UploadStepper step={2} />
  </div>

  <div class="progress">
    <OcrProgress {task} {networkError} {fatalError} />
  </div>
</section>

<style>
  section {
    margin: 0 auto;
    max-width: 48rem;
  }
  .eyebrow {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
  }
  h1 {
    font-family: var(--font-display);
    font-size: 2.25rem;
    margin: 0.5rem 0 0;
  }
  .stepper {
    margin-top: 2rem;
  }
  .progress {
    margin-top: 2.5rem;
  }
</style>
