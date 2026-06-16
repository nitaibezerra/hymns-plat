/**
 * Marco 4.C — Ciclo 4C.2.
 *
 * `HymnbookCard` renderiza um cartão headless pra um hinário na home e na
 * lista. Recebe um objeto `hymnbook` com:
 *
 *   - id, name, slug, isPublished
 *   - stats: { hymnsTotal, hymnsReviewed, audiosApproved }
 *
 * Estrutura visível mínima:
 *   - link envoltório → `/hinarios/<slug>`
 *   - título com `font-display` (Cormorant Garamond)
 *   - três métricas (total, revisados, áudios aprovados)
 *   - badge "rascunho" SOMENTE quando `isPublished === false` E a prop
 *     `showDraftBadge` é true (o controle de visibilidade da prop é da page,
 *     que sabe se o user atual é editor/admin).
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import HymnbookCard from "./HymnbookCard.svelte";

const SAMPLE = {
  id: "1",
  name: "O Cruzeiro",
  slug: "cruzeiro",
  isPublished: true,
  stats: { hymnsTotal: 132, hymnsReviewed: 80, audiosApproved: 40 },
};

describe("HymnbookCard", () => {
  it("renderiza o nome do hinário como título", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    expect(screen.getByRole("heading", { name: /o cruzeiro/i })).toBeInTheDocument();
  });

  it("aplica font-display no título", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    const title = screen.getByRole("heading", { name: /o cruzeiro/i });
    expect(title.className).toMatch(/font-display/);
  });

  it("o card é um link pra /hinarios/<slug>", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    const link = screen.getByRole("link", { name: /o cruzeiro/i });
    expect(link.getAttribute("href")).toBe("/hinarios/cruzeiro");
  });

  it("expõe as três métricas (hinos totais, revisados, áudios aprovados)", () => {
    render(HymnbookCard, { props: { hymnbook: SAMPLE } });
    expect(screen.getByTestId("stat-hymns-total")).toHaveTextContent("132");
    expect(screen.getByTestId("stat-hymns-reviewed")).toHaveTextContent("80");
    expect(screen.getByTestId("stat-audios-approved")).toHaveTextContent("40");
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
