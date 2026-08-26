/**
 * Sub-marco 5.C — tela 07 · Revisar hino.
 *
 * Ciclo 5C.1: a load function `_loadReviseHymn` recebe `{ fetch, params }`
 * e pede ao GraphQL o hino com todo o contexto editorial da tela:
 * `inlineDiff`, `ocrLineConfidences`, `revisions`, `commonStyles` e
 * `commonRepetitions` — os quatro campos que o sub-marco 5.A½ estabilizou
 * no backend.
 *
 * Nota de schema: `HymnType` não tem campo `text`; `body` devolve
 * `Hymn.text` cru. A load normaliza isso para `hymn.text`, que é o nome
 * usado pelo formulário e por `HymnUpdateInput`.
 */

import { describe, expect, it, vi } from "vitest";

import { _loadReviseHymn } from "./+page";

function fakeFetch<T>(payload: T, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

export const HYMN_PAYLOAD = {
  data: {
    hymn: {
      id: "h-1",
      number: 7,
      title: "Estrela do Norte",
      body: "Eu vou subindo\nEu vou subindo",
      ocrText: "Eu vou subindo\nEu vou subiudo",
      style: "Valsa",
      repetitions: "1-2,3-4",
      extraInstructions: "Cantar duas vezes",
      offeredTo: "Mestre Irineu",
      section: "Primeira parte",
      receivedAt: "1930-05-01",
      reviewStatus: "IN_REVIEW",
      lastReviewedAt: "2026-08-01T10:00:00+00:00",
      lastReviewedBy: { id: "u-1", username: "ana" },
      hymnBook: {
        id: "hb-1",
        name: "O Cruzeiro",
        slug: "o-cruzeiro",
        hymns: [
          { id: "h-0", number: 6, reviewStatus: "REVIEWED" },
          { id: "h-1", number: 7, reviewStatus: "IN_REVIEW" },
          { id: "h-2", number: 8, reviewStatus: "NOT_REVIEWED" },
        ],
        nextPendingHymn: { id: "h-2", number: 8, title: "Sol Nascente" },
      },
      inlineDiff: {
        changes: 1,
        adds: 0,
        dels: 0,
        lines: [
          { kind: "eq", tokens: [{ kind: "eq", text: "Eu vou subindo", sub: null, add: null }] },
          {
            kind: "replace",
            tokens: [
              { kind: "eq", text: "Eu vou ", sub: null, add: null },
              { kind: "sub", text: null, sub: "subiudo", add: "subindo" },
            ],
          },
        ],
      },
      ocrLineConfidences: [100, 92],
      commonStyles: ["Valsa", "Marcha"],
      commonRepetitions: ["1-2,3-4", "1-4"],
      revisions: [
        {
          id: "r-2",
          previousStatus: "not_reviewed",
          newStatus: "in_review",
          changeSummary: "Corrigi 2 typos do OCR",
          fieldDiff: { text: { from: "subiudo", to: "subindo" } },
          revisedAt: "2026-08-01T10:00:00+00:00",
          revisedBy: { id: "u-1", username: "ana" },
        },
      ],
      audios: [
        {
          id: "a-1",
          url: "https://media.example.com/a1.mp3",
          title: "Gravação 1997",
          waveformPeaks: [1, 2, 3],
          durationSeconds: 120,
          isApproved: false,
          isMatch: null,
          qualityRating: null,
          qualityObservations: [],
          mismatchReason: "",
          reviewedAt: null,
          reviewedBy: null,
        },
      ],
    },
  },
};

describe("5C.1 — load da tela de revisão", () => {
  it("pede inlineDiff, ocrLineConfidences, revisions, commonStyles e commonRepetitions", async () => {
    const fetchFn = fakeFetch(HYMN_PAYLOAD);
    await _loadReviseHymn({ fetch: fetchFn, params: { pk: "h-1" } });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
    for (const field of [
      "inlineDiff",
      "ocrLineConfidences",
      "revisions",
      "commonStyles",
      "commonRepetitions",
    ]) {
      expect(body.query).toContain(field);
    }
    expect(body.variables).toEqual({ pk: "h-1" });
  });

  it("normaliza `body` para `text` (o schema não expõe HymnType.text)", async () => {
    const data = await _loadReviseHymn({ fetch: fakeFetch(HYMN_PAYLOAD), params: { pk: "h-1" } });
    expect(data.hymn?.text).toBe("Eu vou subindo\nEu vou subindo");
    expect(data.hymn?.ocrText).toBe("Eu vou subindo\nEu vou subiudo");
  });

  it("devolve o contexto editorial do hino", async () => {
    const data = await _loadReviseHymn({ fetch: fakeFetch(HYMN_PAYLOAD), params: { pk: "h-1" } });
    expect(data.hymn?.inlineDiff?.changes).toBe(1);
    expect(data.hymn?.inlineDiff?.lines).toHaveLength(2);
    expect(data.hymn?.ocrLineConfidences).toEqual([100, 92]);
    expect(data.hymn?.commonStyles).toEqual(["Valsa", "Marcha"]);
    expect(data.hymn?.commonRepetitions).toEqual(["1-2,3-4", "1-4"]);
    expect(data.hymn?.revisions).toHaveLength(1);
    expect(data.hymn?.hymnBook.nextPendingHymn?.id).toBe("h-2");
    expect(data.error).toBeNull();
  });

  it("propaga erro do GraphQL (o guard de editor levanta erro pra não-editor)", async () => {
    const data = await _loadReviseHymn({
      fetch: fakeFetch({ errors: [{ message: "Sem acesso ao workspace do editor." }] }),
      params: { pk: "h-1" },
    });
    expect(data.hymn).toBeNull();
    expect(data.error).toBe("Sem acesso ao workspace do editor.");
  });

  it("hino inexistente devolve hymn=null sem erro", async () => {
    const data = await _loadReviseHymn({
      fetch: fakeFetch({ data: { hymn: null } }),
      params: { pk: "nada" },
    });
    expect(data.hymn).toBeNull();
    expect(data.error).toBeNull();
  });
});
