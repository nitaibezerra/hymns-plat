/**
 * Marco 4.B — Ciclo 4B.8.
 * Marco 4.F — Atualizado: o `player-slot` agora hospeda o singleton
 * `<AudioPlayer />`. Os testes do shell (4B) continuam válidos; este
 * arquivo ganha um teste extra cobrindo a presença do componente.
 */

import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O layout lê `page.url.pathname` pra dizer ao Header qual item de navegação
// está ativo. Importar `$app/state` de verdade puxa o runtime de cliente do
// SvelteKit (`notifiable_store is not a function` sob jsdom), então mockamos —
// mesmo padrão que os testes de rota já usam com `$app/navigation`.
vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/") },
}));

import Layout from "./+layout.svelte";
import { audioPlayer } from "$lib/stores/audio";

const ANON_DATA = { currentUser: null, editorPendingCount: 0 };
const USER_DATA = {
  currentUser: { id: "u1", username: "ana", email: "ana@example.com", isEditor: false },
  editorPendingCount: 0,
};

describe("+layout.svelte (shell)", () => {
  beforeEach(() => {
    audioPlayer.reset();
  });
  afterEach(() => {
    audioPlayer.reset();
  });

  it("renderiza Header e Footer", () => {
    render(Layout, { props: { data: ANON_DATA, children: undefined } });
    expect(screen.getByTestId("site-header")).toBeInTheDocument();
    expect(screen.getByTestId("site-footer")).toBeInTheDocument();
  });

  it("renderiza o slot de conteúdo (content-area)", () => {
    render(Layout, { props: { data: ANON_DATA, children: undefined } });
    expect(screen.getByTestId("content-area")).toBeInTheDocument();
  });

  it("renderiza o slot do player fixed-bottom", () => {
    render(Layout, { props: { data: ANON_DATA, children: undefined } });
    expect(screen.getByTestId("player-slot")).toBeInTheDocument();
  });

  it("monta o <AudioPlayer /> singleton dentro do player-slot (4F)", () => {
    // Há uma faixa ativa → o componente deve renderizar a barra visível
    // dentro do <aside data-testid="player-slot">.
    audioPlayer.play({
      id: "audio-x",
      url: "https://example.test/x.mp3",
      title: "Faixa X",
    });
    render(Layout, { props: { data: ANON_DATA, children: undefined } });
    const slot = screen.getByTestId("player-slot");
    const bar = screen.getByTestId("audio-player-bar");
    expect(slot.contains(bar)).toBe(true);
  });

  it("repassa currentUser pro Header (mostra avatar quando autenticado)", () => {
    render(Layout, { props: { data: USER_DATA, children: undefined } });
    expect(screen.getByTestId("user-avatar")).toBeInTheDocument();
  });
});
