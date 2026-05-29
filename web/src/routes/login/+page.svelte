<script lang="ts">
  import { goto } from "$app/navigation";
  import { loginWithPassword } from "$lib/auth";

  let username = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let submitting = $state(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    submitting = true;
    error = null;
    const result = await loginWithPassword(fetch, username, password);
    submitting = false;
    if (result.ok) {
      await goto("/");
    } else {
      error = result.message;
    }
  }
</script>

<section data-testid="login-page">
  <h1>Entrar</h1>
  <form onsubmit={handleSubmit}>
    <label>
      Usuário
      <input
        type="text"
        name="username"
        autocomplete="username"
        bind:value={username}
        required
        data-testid="username-input"
      />
    </label>

    <label>
      Senha
      <input
        type="password"
        name="password"
        autocomplete="current-password"
        bind:value={password}
        required
        data-testid="password-input"
      />
    </label>

    {#if error}
      <p data-testid="login-error" role="alert">{error}</p>
    {/if}

    <button type="submit" disabled={submitting} data-testid="submit">
      {submitting ? "Entrando…" : "Entrar"}
    </button>
  </form>
</section>
