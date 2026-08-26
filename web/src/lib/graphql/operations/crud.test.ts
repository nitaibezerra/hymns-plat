/**
 * Sub-marco 5.D — Ciclo 5D.17.
 *
 * O plano pede um Playwright `tests/e2e/editor-crud.spec.ts` cobrindo o fluxo
 * "criar hinário → adicionar hino → upload + aprovação → publicar".
 * `web/tests/**` está FORA do escopo desta frente (é de outra), então o fluxo
 * está coberto aqui como unidade: um `fetch` roteirizado percorre a mesma
 * sequência de operações que o editor dispara na tela, na ordem, e o `it.todo`
 * no fim registra a spec Playwright como pendente.
 */

import { describe, expect, it, vi } from "vitest";

import {
  approveAudio,
  createHymn,
  createHymnBook,
  publishHymnBook,
  uploadAudio,
} from "./crud";

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** `fetch` roteirizado: devolve os payloads na ordem em que foram passados. */
function scriptedFetch(...payloads: unknown[]) {
  const fn = vi.fn();
  payloads.forEach((p) => fn.mockResolvedValueOnce(jsonResponse(p)));
  return fn as unknown as typeof fetch & { mock: { calls: unknown[][] } };
}

function bodyOf(fetchFn: { mock: { calls: unknown[][] } }, index: number) {
  const init = fetchFn.mock.calls[index][1] as { body: string | FormData };
  return JSON.parse(init.body as string);
}

function formDataOf(fetchFn: { mock: { calls: unknown[][] } }, index: number) {
  const init = fetchFn.mock.calls[index][1] as { body: FormData };
  return init.body;
}

const CREATED_HYMNBOOK = {
  data: { createHymnBook: { __typename: "HymnBookType", id: "hb1", slug: "cruzeiro", name: "O Cruzeiro" } },
};
const CREATED_HYMN = {
  data: { createHymn: { __typename: "HymnType", id: "h1", number: 1, title: "Abertura" } },
};
const UPLOADED_AUDIO = {
  data: { uploadAudio: { __typename: "HymnAudioType", id: "a1", title: "" } },
};
const APPROVED_AUDIO = {
  data: { approveAudio: { __typename: "HymnAudioType", id: "a1", isApproved: true } },
};
const PUBLISHED = {
  data: { publishHymnBook: { __typename: "PublishResult", ok: true, failedChecks: [] } },
};

async function runFlow(fetchFn: ReturnType<typeof scriptedFetch>) {
  const book = await createHymnBook(
    fetchFn,
    { name: "O Cruzeiro", ownerName: "Mestre Irineu", introName: "", description: "" },
    null,
  );
  const hymn = await createHymn(fetchFn, book.data!.slug, {
    number: 1,
    title: "Abertura",
    text: "Verso 1",
    style: "Valsa",
    repetitions: "",
    extraInstructions: "",
    offeredTo: "",
    section: "",
  });
  const file = new File(["bin"], "gravacao.mp3", { type: "audio/mpeg" });
  const audio = await uploadAudio(fetchFn, hymn.data!.id, file, {
    title: "",
    source: "",
    credits: "",
    allowDownload: true,
  });
  const approved = await approveAudio(fetchFn, audio.data!.id);
  const published = await publishHymnBook(fetchFn, book.data!.slug);
  return { book, hymn, audio, approved, published };
}

describe("fluxo CRUD editorial completo (5D.17 — E2E como unidade)", () => {
  it("percorre criar hinário → criar hino → subir áudio → aprovar → publicar", async () => {
    const fetchFn = scriptedFetch(
      CREATED_HYMNBOOK,
      CREATED_HYMN,
      UPLOADED_AUDIO,
      APPROVED_AUDIO,
      PUBLISHED,
    );
    const result = await runFlow(fetchFn);

    expect(fetchFn.mock.calls).toHaveLength(5);
    expect(result.book.ok).toBe(true);
    expect(result.hymn.ok).toBe(true);
    expect(result.audio.ok).toBe(true);
    expect(result.approved.ok).toBe(true);
    expect(result.published.ok).toBe(true);
  });

  it("encadeia os identificadores devolvidos por cada passo", async () => {
    const fetchFn = scriptedFetch(
      CREATED_HYMNBOOK,
      CREATED_HYMN,
      UPLOADED_AUDIO,
      APPROVED_AUDIO,
      PUBLISHED,
    );
    await runFlow(fetchFn);

    expect(bodyOf(fetchFn, 0).query).toContain("createHymnBook");
    // O hino entra no slug que a criação do hinário devolveu.
    expect(bodyOf(fetchFn, 1).variables.hymnbookSlug).toBe("cruzeiro");
    // O áudio sobe pro pk do hino recém-criado.
    const operations = JSON.parse(formDataOf(fetchFn, 2).get("operations") as string);
    expect(operations.query).toContain("uploadAudio");
    expect(operations.variables.hymnPk).toBe("h1");
    // A aprovação usa o pk do áudio devolvido pelo upload.
    expect(bodyOf(fetchFn, 3).variables).toEqual({ pk: "a1" });
    // A publicação usa o slug do hinário.
    expect(bodyOf(fetchFn, 4).variables).toEqual({ slug: "cruzeiro" });
  });

  it("o passo de upload é multipart e carrega o arquivo", async () => {
    const fetchFn = scriptedFetch(
      CREATED_HYMNBOOK,
      CREATED_HYMN,
      UPLOADED_AUDIO,
      APPROVED_AUDIO,
      PUBLISHED,
    );
    await runFlow(fetchFn);

    const form = formDataOf(fetchFn, 2);
    expect(form).toBeInstanceOf(FormData);
    expect(JSON.parse(form.get("map") as string)).toEqual({ "0": ["variables.file"] });
    expect((form.get("0") as File).name).toBe("gravacao.mp3");
  });

  it("publicação com pendências interrompe o fluxo com mensagem legível", async () => {
    const fetchFn = scriptedFetch(
      CREATED_HYMNBOOK,
      CREATED_HYMN,
      UPLOADED_AUDIO,
      APPROVED_AUDIO,
      {
        data: {
          publishHymnBook: {
            __typename: "PublishResult",
            ok: false,
            failedChecks: ["Todos os hinos revisados", "Todos os hinos com áudio"],
          },
        },
      },
    );
    const result = await runFlow(fetchFn);

    expect(result.published.ok).toBe(false);
    expect(result.published.message).toContain("Todos os hinos revisados");
    expect(result.published.message).toContain("Todos os hinos com áudio");
  });

  it.todo(
    "Playwright web/tests/e2e/editor-crud.spec.ts — PENDENTE: web/tests/** é escopo de outra frente",
  );
});
