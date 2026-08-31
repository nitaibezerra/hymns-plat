<script lang="ts">
  /**
   * Marco 4.B — Ciclo 4B.6.
   * Fase 2 da paridade visual (2026-08-31) — porte de
   * `templates/_partials/_footer.html`.
   *
   * Duas colunas: assinatura em mono maiúsculo tracked à esquerda, epígrafe em
   * serifa itálica à direita. Substitui a versão anterior ("hinária · Portal de
   * Hinários do Santo Daime" + link do GitHub), que era conteúdo diferente, não
   * só estilo diferente.
   *
   * O link do GitHub saiu porque o monolito não o tem: paridade é o critério
   * aqui, e um link a mais é um link a mais de diff. Se ele fizer falta, entra
   * nos DOIS lados no mesmo commit.
   */
</script>

<footer
  class="mt-16 border-t border-ink/10 dark:border-cream/10"
  data-no-print
  data-testid="site-footer"
>
  <div
    class="max-w-7xl mx-auto px-6 py-8 text-sm text-ink-soft flex flex-wrap gap-4 items-center justify-between"
  >
    <p class="font-mono text-xs tracking-[0.18em] uppercase">HINARIA · HINARIA.COM.BR</p>
    <p class="font-serif italic">"Hinários para ouvir, estudar e cantar com firmeza."</p>
  </div>
</footer>
