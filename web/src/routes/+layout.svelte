<script lang="ts">
  let { children } = $props();
</script>

<header>
  <a href="/">Hinaria</a>
  <nav>
    <a href="/hinarios">Hinários</a>
    <a href="/login">Entrar</a>
  </nav>
</header>

<main>
  {@render children()}
</main>
