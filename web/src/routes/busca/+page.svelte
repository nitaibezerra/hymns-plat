<script lang="ts">
  /**
   * Marco 4.G — Ciclos 4G.2 + 4G.3.
   *
   * Três estados de render:
   *   - SEM `query` ⇒ placeholder "Digite pra buscar hinos ou hinários".
   *   - COM `query` e zero resultados ⇒ card "Nenhum resultado".
   *   - COM `query` e resultados ⇒ seções "Hinos" + "Hinários" com contagem
   *     (cada seção some quando o grupo correspondente está vazio).
   *
   * O input mantém o termo (`data.query`) pré-populado em SSR.
   */
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let hymns = $derived(data.results.hymns);
  let hymnbooks = $derived(data.results.hymnbooks);
  let totalResults = $derived(hymns.length + hymnbooks.length);
  let hasQuery = $derived(data.query.length > 0);
</script>

<section data-testid="search" class="max-w-5xl mx-auto px-6 py-10">
  <p class="label-mono">Busca</p>

  <form
    action="/busca"
    method="get"
    class="mt-3 flex items-center gap-3 rounded-full border border-ink/15 p-2"
    data-testid="search-form"
  >
    <span class="pl-3 text-ink/40" aria-hidden="true">⌕</span>
    <input
      type="search"
      name="q"
      value={data.query}
      placeholder="estrela brilhante…"
      class="flex-1 bg-transparent px-2 py-2 focus:outline-none"
      data-testid="search-input"
      aria-label="Buscar"
    />
    <button type="submit" class="rounded-full px-5 py-2 text-sm">Buscar</button>
  </form>

  {#if !hasQuery}
    <div data-testid="search-placeholder" class="mt-10 p-10 text-center">
      <p class="font-display text-2xl">Comece pela busca.</p>
      <p class="mt-2">Digite pra buscar hinos ou hinários — título, trecho da letra ou autor.</p>
    </div>
  {:else}
    {#if totalResults === 0}
      <div data-testid="search-empty" class="mt-10 p-10 text-center">
        Nenhum resultado para "{data.query}". Tente outros termos.
      </div>
    {:else}
      <div class="mt-8 space-y-8">
        {#if hymns.length > 0}
          <section data-testid="search-section-hymns">
            <h2 class="font-display text-xl">
              Hinos <span class="label-mono">({hymns.length})</span>
            </h2>
            <ul class="mt-3 space-y-3">
              {#each hymns as h (h.id)}
                <li data-testid="search-hymn-result" class="p-5">
                  <p class="label-mono">HINO</p>
                  <p class="font-display text-2xl">{String(h.number).padStart(2, "0")}</p>
                  <p class="font-display text-xl">{h.title}</p>
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        {#if hymnbooks.length > 0}
          <section data-testid="search-section-hymnbooks">
            <h2 class="font-display text-xl">
              Hinários <span class="label-mono">({hymnbooks.length})</span>
            </h2>
            <ul class="mt-3 space-y-3">
              {#each hymnbooks as b (b.id)}
                <li data-testid="search-hymnbook-result" class="p-5">
                  <p class="label-mono">HINÁRIO</p>
                  <p class="font-display text-xl">{b.name}</p>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      </div>
    {/if}
  {/if}
</section>
