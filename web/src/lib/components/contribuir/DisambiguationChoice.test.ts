/**
 * Sub-marco 5.F — Ciclo 5F.13.
 *
 * Porta de `DisambiguationChoiceForm` (`apps/hymns/forms.py:220`) e do
 * formulário de `upload_disambiguate.html`. Três escolhas:
 *
 *   - `create_new` (default, como o `initial` do form Django);
 *   - `add_version`, que no `clean()` exige **hinário selecionado E nome da
 *     versão** — aqui isso vira submit desabilitado, para o usuário descobrir
 *     a regra antes de clicar;
 *   - `cancel`.
 *
 * A opção `add_version` só existe quando há similares — igual ao
 * `{% if similar_hymnbooks %}` do template.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import DisambiguationChoice from "./DisambiguationChoice.svelte";
import {
  CHOICE_ADD_VERSION,
  CHOICE_CANCEL,
  CHOICE_CREATE_NEW,
  validateChoice,
} from "./choice-validation";

import type { SimilarBook } from "./duplicates";

function similarList(): SimilarBook[] {
  return [
    {
      hymnbook: {
        id: "b1",
        name: "O Cruzeiro",
        slug: "o-cruzeiro",
        ownerName: "Mestre Irineu",
        hymnsTotal: 132,
      },
      nameScore: 0.83,
      contentScore: 0.9,
    },
    {
      hymnbook: {
        id: "b2",
        name: "O Justiceiro",
        slug: "o-justiceiro",
        ownerName: "Padrinho Sebastião",
        hymnsTotal: 20,
      },
      nameScore: 0.95,
      contentScore: 0.88,
    },
  ];
}

describe("validateChoice (5F.13)", () => {
  it("create_new nunca precisa de nada", () => {
    expect(validateChoice({ kind: CHOICE_CREATE_NEW, hymnbookSlug: "", versionName: "" })).toBeNull();
  });

  it("cancel nunca precisa de nada", () => {
    expect(validateChoice({ kind: CHOICE_CANCEL, hymnbookSlug: "", versionName: "" })).toBeNull();
  });

  it("add_version sem hinário reclama em PT-BR", () => {
    const message = validateChoice({
      kind: CHOICE_ADD_VERSION,
      hymnbookSlug: "",
      versionName: "Edição 2020",
    });
    expect(message).toMatch(/selecionar um hinário/i);
  });

  it("add_version sem nome da versão reclama em PT-BR", () => {
    const message = validateChoice({
      kind: CHOICE_ADD_VERSION,
      hymnbookSlug: "o-cruzeiro",
      versionName: "   ",
    });
    expect(message).toMatch(/nome para a versão/i);
  });

  it("add_version completo passa", () => {
    expect(
      validateChoice({
        kind: CHOICE_ADD_VERSION,
        hymnbookSlug: "o-cruzeiro",
        versionName: "Edição 2020",
      }),
    ).toBeNull();
  });
});

describe("DisambiguationChoice (5F.13)", () => {
  it("começa em 'criar novo hinário' com o submit habilitado", () => {
    render(DisambiguationChoice, { props: { similar: similarList(), onchoose: vi.fn() } });
    expect(screen.getByTestId("choice-create-new")).toBeChecked();
    expect(screen.getByTestId("choice-submit")).toBeEnabled();
  });

  it("create_new emite a escolha sem hinário nem versão", async () => {
    const onchoose = vi.fn();
    render(DisambiguationChoice, { props: { similar: similarList(), onchoose } });
    await fireEvent.submit(screen.getByTestId("disambiguation-choice"));
    expect(onchoose).toHaveBeenCalledWith({
      kind: CHOICE_CREATE_NEW,
      hymnbookSlug: "",
      versionName: "",
    });
  });

  it("add_version desabilita o submit até ter hinário e nome da versão", async () => {
    render(DisambiguationChoice, { props: { similar: similarList(), onchoose: vi.fn() } });

    await fireEvent.click(screen.getByTestId("choice-add-version"));
    expect(screen.getByTestId("choice-submit")).toBeDisabled();

    await fireEvent.change(screen.getByTestId("choice-hymnbook"), {
      target: { value: "o-cruzeiro" },
    });
    expect(screen.getByTestId("choice-submit")).toBeDisabled();

    await fireEvent.input(screen.getByTestId("choice-version-name"), {
      target: { value: "Edição 2020" },
    });
    expect(screen.getByTestId("choice-submit")).toBeEnabled();
  });

  it("add_version mostra por que o submit está travado", async () => {
    render(DisambiguationChoice, { props: { similar: similarList(), onchoose: vi.fn() } });
    await fireEvent.click(screen.getByTestId("choice-add-version"));
    expect(screen.getByTestId("choice-hint")).toHaveTextContent(/selecionar um hinário/i);
  });

  it("add_version completo emite hinário e nome da versão", async () => {
    const onchoose = vi.fn();
    render(DisambiguationChoice, { props: { similar: similarList(), onchoose } });

    await fireEvent.click(screen.getByTestId("choice-add-version"));
    await fireEvent.change(screen.getByTestId("choice-hymnbook"), {
      target: { value: "o-justiceiro" },
    });
    await fireEvent.input(screen.getByTestId("choice-version-name"), {
      target: { value: "Edição 2020" },
    });
    await fireEvent.submit(screen.getByTestId("disambiguation-choice"));

    expect(onchoose).toHaveBeenCalledWith({
      kind: CHOICE_ADD_VERSION,
      hymnbookSlug: "o-justiceiro",
      versionName: "Edição 2020",
    });
  });

  it("o select lista os hinários similares", async () => {
    render(DisambiguationChoice, { props: { similar: similarList(), onchoose: vi.fn() } });
    await fireEvent.click(screen.getByTestId("choice-add-version"));
    const options = screen.getByTestId("choice-hymnbook").querySelectorAll("option");
    // 1 placeholder + 2 hinários
    expect(options).toHaveLength(3);
    expect(options[1]).toHaveValue("o-cruzeiro");
    expect(options[2]).toHaveValue("o-justiceiro");
  });

  it("sem similares a opção 'adicionar como versão' não existe", () => {
    render(DisambiguationChoice, { props: { similar: [], onchoose: vi.fn() } });
    expect(screen.queryByTestId("choice-add-version")).toBeNull();
  });

  it("cancel emite a escolha de cancelamento", async () => {
    const onchoose = vi.fn();
    render(DisambiguationChoice, { props: { similar: similarList(), onchoose } });
    await fireEvent.click(screen.getByTestId("choice-cancel"));
    await fireEvent.submit(screen.getByTestId("disambiguation-choice"));
    expect(onchoose).toHaveBeenCalledWith({
      kind: CHOICE_CANCEL,
      hymnbookSlug: "",
      versionName: "",
    });
  });

  it("trocar de volta pra create_new libera o submit de novo", async () => {
    render(DisambiguationChoice, { props: { similar: similarList(), onchoose: vi.fn() } });
    await fireEvent.click(screen.getByTestId("choice-add-version"));
    expect(screen.getByTestId("choice-submit")).toBeDisabled();
    await fireEvent.click(screen.getByTestId("choice-create-new"));
    expect(screen.getByTestId("choice-submit")).toBeEnabled();
  });
});
