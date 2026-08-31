/**
 * Marco 4.C — Ciclo 4C.2.
 * Fase 4 da paridade visual (2026-08-31).
 *
 * Trava a paridade com `templates/_partials/_hymnbook_card.html`.
 *
 * Duas asserções mudaram de lado: "Revisados" saiu (decisão do usuário — o
 * monolito não expõe progresso de revisão ao público nos cards) e os títulos
 * passaram a aparecer DUAS vezes, porque o card tem duas variantes
 * responsivas no mesmo markup, exatamente como o do monolito. Os testes
 * desambiguam por variante em vez de assumir uma só.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import HymnbookCard from "./HymnbookCard.svelte";

const SAMPLE = {
  id: "1",
  name: "O Cruzeiro",
  slug: "cruzeiro",
  isPublished: true,
  ownerName: "Mestre Irineu",
  createdAt: "2026-03-14T10:00:00Z",
  coverImage: null,
  displayAccent: "#1F5C4D",
  stats: { hymnsTotal: 132, hymnsReviewed: 80, audiosApproved: 40 },
};

/**
 * A variante desktop ("Foto Soberana") é a primeira no DOM, como no monolito —
 * é a que o E2E em viewport desktop enxerga. `getAllBy*()[0]` é ela.
 */
function tituloDesktop(): HTMLElement {
  return screen.getAllByRole("heading", { name: /o cruzeiro/i })[0];
}

describe("HymnbookCard", () => {
  it("renderiza o nome do hinário nas duas variantes responsivas", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    // Duas: desktop `aspect-[3/4]` e mobile horizontal. Fiel ao monolito.
    expect(screen.getAllByRole("heading", { name: /o cruzeiro/i })).toHaveLength(2);
  });

  it("aplica font-display no título", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    expect(tituloDesktop().className).toMatch(/font-display/);
  });

  it("o card é um link pra /hinarios/<slug>", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    const link = screen.getByRole("link", { name: /o cruzeiro/i });
    expect(link.getAttribute("href")).toBe("/hinarios/cruzeiro");
  });

  it("pinta o gradiente com a cor do hinário", () => {
    // Sem `displayAccent` da API, o card não tem como existir como no monolito:
    // o fundo É a identidade do hinário. Ver a Fase 3.
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    const estilo = screen.getByTestId("hymnbook-card").getAttribute("style") ?? "";
    expect(estilo).toContain("#1F5C4D");
    expect(estilo).toContain("linear-gradient(140deg");
    expect(estilo).toContain("color-mix(in srgb");
  });

  it("mostra o autor sob o título", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    expect(screen.getByTestId("owner-name")).toHaveTextContent("Mestre Irineu");
  });

  it("mostra o selo EST. com o ano de criação", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    expect(screen.getByTestId("est-badge")).toHaveTextContent("EST. 2026");
  });

  it("mostra hinos e áudios em maiúsculas, separados pelo ponto dourado", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    expect(screen.getByTestId("stat-hymns-total")).toHaveTextContent("132 HINOS");
    expect(screen.getByTestId("stat-audios-approved")).toHaveTextContent("40 ÁUDIOS");
  });

  it("NÃO expõe contagem de revisados — o monolito não expõe ao público", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    expect(screen.queryByTestId("stat-hymns-reviewed")).toBeNull();
    expect(screen.queryByText(/revisados/i)).toBeNull();
  });

  it("omite as contagens quando o hinário está vazio", () => {
    // `{% if hb.n_hymns_anno %}` no template: hinário sem hino não mostra
    // "0 HINOS", não mostra nada.
    const vazio = { ...SAMPLE, stats: { hymnsTotal: 0, hymnsReviewed: 0, audiosApproved: 0 } };
    render(HymnbookCard, { props: { hymnbook: vazio } });
    expect(screen.queryByTestId("stat-hymns-total")).toBeNull();
  });

  it("omite ÁUDIOS quando não há áudio aprovado, mas mantém HINOS", () => {
    const semAudio = { ...SAMPLE, stats: { hymnsTotal: 12, hymnsReviewed: 0, audiosApproved: 0 } };
    render(HymnbookCard, { props: { hymnbook: semAudio } });
    expect(screen.getByTestId("stat-hymns-total")).toHaveTextContent("12 HINOS");
    expect(screen.queryByTestId("stat-audios-approved")).toBeNull();
  });

  it("usa a capa quando existe, no lugar do monograma", () => {
    render(HymnbookCard, {
      props: { hymnbook: { ...SAMPLE, coverImage: "https://cdn.example/capa.jpg" } },
    });
    const imagens = screen.getAllByRole("img", { name: /capa de o cruzeiro/i });
    // Uma por variante responsiva.
    expect(imagens).toHaveLength(2);
    expect(imagens[0].getAttribute("src")).toBe("https://cdn.example/capa.jpg");
  });

  it("cai no monograma da inicial quando não há capa", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    expect(screen.getByTestId("hymnbook-card").textContent).toContain("O");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("não mostra badge rascunho quando isPublished=true", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE, showDraftBadge: true } });
    expect(screen.queryByTestId("draft-badge")).toBeNull();
  });

  it("não mostra badge rascunho quando showDraftBadge=false (mesmo se !isPublished)", () => {
    const draft = { ...SAMPLE, isPublished: false };
    render(HymnbookCard, { props: { hymnbook: draft, showDraftBadge: false } });
    expect(screen.queryByTestId("draft-badge")).toBeNull();
  });

  it("mostra badge rascunho quando !isPublished E showDraftBadge=true", () => {
    const draft = { ...SAMPLE, isPublished: false };
    render(HymnbookCard, { props: { hymnbook: draft, showDraftBadge: true } });
    const badge = screen.getByTestId("draft-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent?.toLowerCase()).toContain("rascunho");
  });
});
