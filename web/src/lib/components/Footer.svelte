<script lang="ts">
  /**
   * Marco 4.B — Ciclo 4B.6.
   *
   * Footer global do shell. Créditos + link pro GitHub do projeto.
   * Sem props — conteúdo estático.
   */
</script>

<footer class="site-footer" data-testid="site-footer">
  <div class="footer-inner">
    <p class="credits">
      <span class="brand">hinária</span>
      · Portal de Hinários do Santo Daime
    </p>
    <p class="links">
      <a
        href="https://github.com/nitaibezerra/hyms-platform"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub do projeto"
      >
        GitHub
      </a>
    </p>
  </div>
</footer>

<style>
  .site-footer {
    background: var(--color-bg);
    border-top: 1px solid var(--color-border-soft);
    color: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
  }
  .footer-inner {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: space-between;
    margin: 0 auto;
    max-width: 72rem;
    padding: 1.25rem;
  }
  .credits {
    margin: 0;
  }
  .brand {
    color: var(--color-text);
    font-family: var(--font-display);
    font-weight: 600;
  }
  .links {
    margin: 0;
  }
  .links a {
    color: var(--color-accent);
    text-decoration: none;
  }
  .links a:hover {
    text-decoration: underline;
  }
</style>
