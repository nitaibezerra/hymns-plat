/**
 * Testes do contrato da fixture (`seed-fixture.ts`).
 *
 * Rodam sem servidor e sem banco: exercitam só a coerência interna do
 * espelho. O que eles pegam é a classe de erro mais chata da suíte E2E — a
 * constante que alguém ajustou de um lado e esqueceu do outro, que aparece
 * depois como uma spec vermelha e sem explicação.
 *
 * Rodar: `pnpm test:e2e:helpers`
 */

import { expect, test } from "@playwright/test";

import {
  DEFAULT_EDITOR_USERNAME,
  DEFAULT_PASSWORD,
  DEFAULT_VIEWER_USERNAME,
  DRAFT_BOOK_SLUG,
  FULLY_REVIEWED_BOOK_SLUG,
  PENDING_AUDIOS_EXPECTED,
  PENDING_AUDIO_TITLES,
  REVIEW_BOOK_SLUG,
  SEED_BOOKS,
  SEED_ORDER_DEFAULT,
  SEED_ORDER_REVIEW_ASC,
  SEED_PREFIX,
  editorUsername,
  seedPassword,
  seededOrder,
  viewerUsername,
} from "./seed-fixture";

const SLUGS = SEED_BOOKS.map((book) => book.slug);

test.describe("contrato da fixture de seed (seed-fixture)", () => {
  test("os slugs citados por nome existem na lista de hinários", () => {
    for (const slug of [REVIEW_BOOK_SLUG, FULLY_REVIEWED_BOOK_SLUG, DRAFT_BOOK_SLUG]) {
      expect(SLUGS).toContain(slug);
    }
  });

  test("as duas ordens cobrem exatamente os hinários semeados", () => {
    expect([...SEED_ORDER_DEFAULT].sort()).toEqual([...SLUGS].sort());
    expect([...SEED_ORDER_REVIEW_ASC].sort()).toEqual([...SLUGS].sort());
  });

  test("a ordem por revisão difere da default — senão o chip não prova nada", () => {
    expect(SEED_ORDER_REVIEW_ASC).not.toEqual(SEED_ORDER_DEFAULT);
  });

  test("a reordenação acontece dentro de uma mesma prioridade", () => {
    // `priority` é sort PRIMÁRIO quando `priority=all`, então uma troca entre
    // prioridades diferentes seria impossível — e uma spec afirmando isso
    // falharia sem que a UI tivesse regredido.
    const prioridade = new Map(SEED_BOOKS.map((book) => [book.slug, book.priority]));
    const trocaram = SEED_ORDER_DEFAULT.filter(
      (slug, index) => SEED_ORDER_REVIEW_ASC[index] !== slug,
    );
    expect(trocaram.length).toBeGreaterThan(0);
    expect(new Set(trocaram.map((slug) => prioridade.get(slug))).size).toBe(1);
  });

  test("o rascunho é o único não publicado", () => {
    const rascunhos = SEED_BOOKS.filter((book) => !book.isPublished);
    expect(rascunhos.map((book) => book.slug)).toEqual([DRAFT_BOOK_SLUG]);
  });

  test("o hinário de revisão tem pendente e próximo pendente", () => {
    const book = SEED_BOOKS.find((item) => item.slug === REVIEW_BOOK_SLUG)!;
    expect(book.hymnsTotal - book.hymnsReviewed).toBeGreaterThanOrEqual(2);
  });

  test("o hinário do selo está 100% revisado", () => {
    const book = SEED_BOOKS.find((item) => item.slug === FULLY_REVIEWED_BOOK_SLUG)!;
    expect(book.hymnsReviewed).toBe(book.hymnsTotal);
  });

  test("as três prioridades estão representadas", () => {
    expect(new Set(SEED_BOOKS.map((book) => book.priority))).toEqual(
      new Set(["P1", "P2", "P3"]),
    );
  });

  test("a contagem de áudios pendentes bate com a lista de títulos", () => {
    expect(PENDING_AUDIO_TITLES).toHaveLength(PENDING_AUDIOS_EXPECTED);
    for (const title of PENDING_AUDIO_TITLES) {
      expect(title.startsWith(SEED_PREFIX)).toBe(true);
    }
  });

  test("seededOrder descarta o que não é do seed e preserva a ordem", () => {
    const naTela = ["o-cruzeiro", "e2e-fila-urgente", "viagem", "e2e-selo-final"];
    expect(seededOrder(naTela)).toEqual(["e2e-fila-urgente", "e2e-selo-final"]);
  });

  test("seededOrder devolve vazio quando a fixture não está na tela", () => {
    expect(seededOrder(["o-cruzeiro", "viagem"])).toEqual([]);
  });

  test("credenciais caem nos defaults do comando quando o ambiente é omisso", () => {
    // Os mesmos defaults de `seed_e2e.py` e de `dev-fullstack.sh`: quem subiu
    // o ambiente pelo script não precisa exportar nada.
    const semEnv = !process.env.HINARIA_E2E_EDITOR_USERNAME;
    if (semEnv) {
      expect(editorUsername()).toBe(DEFAULT_EDITOR_USERNAME);
      expect(viewerUsername()).toBe(DEFAULT_VIEWER_USERNAME);
    }
    if (!process.env.HINARIA_E2E_PASSWORD) {
      expect(seedPassword()).toBe(DEFAULT_PASSWORD);
    }
  });

  test("editor e usuário comum são pessoas diferentes", () => {
    expect(editorUsername()).not.toBe(viewerUsername());
  });
});
