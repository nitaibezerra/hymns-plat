/**
 * Sub-marco 5.C — Ciclos 5C.13, 5C.14 e 5C.15.
 *
 * `AudioReviewDrawer` porta o bloco `templates/hymns/editor/_audio_review.html`
 * para o headless. Contrato:
 *
 *   - player (reusa `PlayButton` + player global do shell);
 *   - pergunta de correspondência (`isMatch`) com "Confere" / "Não confere";
 *   - rating 1-5 e chips de observação (`HymnAudio.QUALITY_OBSERVATIONS`);
 *   - motivo de divergência (`HymnAudio.MismatchReason`) quando não confere;
 *   - submit chama `reviewAudio` e fecha (5C.15).
 *
 * Nota do backend, deliberada e pinada por teste lá: `reviewAudio` **não**
 * seta `is_approved=True`. A UI não promete aprovação.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it } from "vitest";

import AudioReviewDrawer, {
  MISMATCH_REASONS,
  QUALITY_OBSERVATIONS,
} from "./AudioReviewDrawer.svelte";
import { audioPlayer } from "$lib/stores/audio";

const AUDIO = {
  id: "a-1",
  url: "https://media.example.com/a1.mp3",
  title: "Gravação 1997",
  waveformPeaks: [1, 2, 3],
  durationSeconds: 125,
  isApproved: false,
  isMatch: null as boolean | null,
  qualityRating: null as number | null,
  qualityObservations: [] as string[],
  mismatchReason: "",
  reviewedAt: null as string | null,
  reviewedBy: null,
};

describe("AudioReviewDrawer — 5C.13", () => {
  beforeEach(() => {
    audioPlayer.reset();
  });

  it("espelha as constantes do Django", () => {
    expect(QUALITY_OBSERVATIONS).toEqual([
      "Ruído de fundo",
      "Voz baixa",
      "Cortes",
      "Excelente captação",
      "Mestre de cerimônias",
    ]);
    expect(MISMATCH_REASONS).toEqual([
      { value: "other_hymn", label: "É outro hino" },
      { value: "incomplete", label: "Áudio cortado/incompleto" },
      { value: "wrong_lyrics", label: "Letra diferente" },
      { value: "inaudible", label: "Áudio inaudível" },
      { value: "other", label: "Outro" },
    ]);
  });

  it("fechado, não renderiza o drawer", () => {
    render(AudioReviewDrawer, { props: { audio: AUDIO, hymnTitle: "Estrela", open: false } });
    expect(screen.queryByTestId("audio-review-drawer")).toBeNull();
  });

  it("aberto, mostra arquivo, duração e o player", () => {
    render(AudioReviewDrawer, { props: { audio: AUDIO, hymnTitle: "Estrela", open: true } });
    expect(screen.getByTestId("audio-review-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("audio-file-label")).toHaveTextContent("Gravação 1997");
    expect(screen.getByTestId("audio-file-label")).toHaveTextContent("2:05");
    expect(screen.getByTestId("play-button")).toBeInTheDocument();
  });

  it("pergunta se a gravação corresponde ao hino", () => {
    render(AudioReviewDrawer, { props: { audio: AUDIO, hymnTitle: "Estrela", open: true } });
    expect(screen.getByTestId("match-question")).toHaveTextContent(
      'É mesmo a gravação de "Estrela"?',
    );
    expect(screen.getByTestId("audio-match-yes")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("audio-match-no")).toHaveAttribute("aria-pressed", "false");
  });

  it("clicar em Confere marca a resposta", async () => {
    render(AudioReviewDrawer, { props: { audio: AUDIO, hymnTitle: "Estrela", open: true } });
    await fireEvent.click(screen.getByTestId("audio-match-yes"));
    expect(screen.getByTestId("audio-match-yes")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("audio-match-no")).toHaveAttribute("aria-pressed", "false");
  });

  it("rating vai de 1 a 5", async () => {
    render(AudioReviewDrawer, { props: { audio: AUDIO, hymnTitle: "Estrela", open: true } });
    const stars = screen.getAllByTestId("quality-star");
    expect(stars.map((el) => el.textContent?.trim())).toEqual(["1", "2", "3", "4", "5"]);

    await fireEvent.click(stars[3]);
    expect(stars.map((el) => el.dataset.active)).toEqual(["true", "true", "true", "true", "false"]);
  });

  it("chips de observação alternam seleção", async () => {
    render(AudioReviewDrawer, { props: { audio: AUDIO, hymnTitle: "Estrela", open: true } });
    const chip = screen.getByRole("button", { name: "Cortes" });
    await fireEvent.click(chip);
    expect(chip.dataset.active).toBe("true");
    await fireEvent.click(chip);
    expect(chip.dataset.active).toBe("false");
  });

  it("pré-preenche a partir da revisão anterior do áudio", () => {
    render(AudioReviewDrawer, {
      props: {
        hymnTitle: "Estrela",
        open: true,
        audio: {
          ...AUDIO,
          isMatch: true,
          qualityRating: 3,
          qualityObservations: ["Voz baixa"],
        },
      },
    });
    expect(screen.getByTestId("audio-match-yes")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("quality-star").map((el) => el.dataset.active)).toEqual([
      "true",
      "true",
      "true",
      "false",
      "false",
    ]);
    expect(screen.getByRole("button", { name: "Voz baixa" }).dataset.active).toBe("true");
  });

  it("não promete aprovação (reviewAudio não aprova)", () => {
    render(AudioReviewDrawer, { props: { audio: AUDIO, hymnTitle: "Estrela", open: true } });
    expect(screen.getByTestId("audio-review-note")).toHaveTextContent(
      "Registrar a revisão não aprova o áudio",
    );
  });

  it("sem gravação, mostra o estado vazio", () => {
    render(AudioReviewDrawer, { props: { audio: null, hymnTitle: "Estrela", open: true } });
    expect(screen.getByTestId("audio-review-empty")).toHaveTextContent(
      "Sem gravação para este hino.",
    );
  });
});
