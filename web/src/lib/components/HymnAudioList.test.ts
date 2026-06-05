/**
 * Marco 4.E — Ciclos 4E.5 e 4E.6.
 *
 * `HymnAudioList` renderiza os áudios de um hino:
 *
 *   - 4E.5: lista áudios aprovados, com `PlayButton` por item; clicar
 *           dispara `audioPlayer.play(track)` do stub.
 *   - 4E.6: quando `currentUser` é o uploader OU `isEditor=true`, áudios
 *           pendentes (`isApproved=false`) aparecem com badge
 *           "Aguardando aprovação". Anônimos/usuários comuns não veem
 *           pendentes — espelha o gating do resolver `audios(approvedOnly)`.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { get } from "svelte/store";
import { beforeEach, describe, expect, it } from "vitest";

import HymnAudioList from "./HymnAudioList.svelte";
import { audioPlayer, audioState } from "$lib/stores/audio";

const APPROVED_AUDIO = {
  id: "a-1",
  url: "https://media.example.com/a1.mp3",
  waveformPeaks: [1, 2, 3, 4],
  durationSeconds: 180.5,
  uploadedBy: { id: "u-1", username: "ana" },
  isApproved: true,
};

const PENDING_AUDIO = {
  id: "a-pending",
  url: "https://media.example.com/pending.mp3",
  waveformPeaks: [5, 6, 7],
  durationSeconds: 90,
  uploadedBy: { id: "u-2", username: "bia" },
  isApproved: false,
};

describe("HymnAudioList — 4E.5", () => {
  beforeEach(() => {
    audioPlayer.reset();
  });

  it("renderiza um item por áudio aprovado", () => {
    render(HymnAudioList, {
      props: {
        audios: [APPROVED_AUDIO],
        hymnTitle: "Estrela do Norte",
        hymnNumber: 12,
      },
    });
    expect(screen.getAllByTestId("audio-item")).toHaveLength(1);
  });

  it("clicar no PlayButton dispara audioPlayer.play(track) — atualiza o store", async () => {
    render(HymnAudioList, {
      props: {
        audios: [APPROVED_AUDIO],
        hymnTitle: "Estrela do Norte",
        hymnNumber: 12,
      },
    });
    const button = screen.getByTestId("play-button");
    await fireEvent.click(button);

    const state = get(audioState);
    expect(state.isPlaying).toBe(true);
    expect(state.currentTrack?.id).toBe("a-1");
    expect(state.currentTrack?.url).toBe("https://media.example.com/a1.mp3");
    expect(state.currentTrack?.title).toBe("Estrela do Norte");
    expect(state.currentTrack?.hymnNumber).toBe(12);
    expect(state.currentTrack?.uploadedByUsername).toBe("ana");
  });

  it("renderiza o nome do uploader e duração formatada", () => {
    const audio180 = { ...APPROVED_AUDIO, durationSeconds: 180 };
    render(HymnAudioList, {
      props: { audios: [audio180], hymnTitle: "X" },
    });
    expect(screen.getByText("ana")).toBeInTheDocument();
    expect(screen.getByText("3:00")).toBeInTheDocument();
  });

  it("não mostra áudios pendentes pra anônimo (currentUser=null, isEditor=false)", () => {
    render(HymnAudioList, {
      props: {
        audios: [APPROVED_AUDIO, PENDING_AUDIO],
        hymnTitle: "X",
        currentUser: null,
        isEditor: false,
      },
    });
    expect(screen.getAllByTestId("audio-item")).toHaveLength(1);
    expect(screen.queryByTestId("badge-pending")).toBeNull();
  });
});

describe("HymnAudioList — 4E.6 (pendentes pra uploader/editor)", () => {
  it("mostra áudio pendente com badge quando currentUser é o uploader", () => {
    render(HymnAudioList, {
      props: {
        audios: [PENDING_AUDIO],
        hymnTitle: "X",
        currentUser: { id: "u-2", username: "bia" },
        isEditor: false,
      },
    });
    expect(screen.getAllByTestId("audio-item")).toHaveLength(1);
    expect(screen.getByTestId("badge-pending")).toHaveTextContent(/aguardando aprovação/i);
  });

  it("mostra áudios pendentes de qualquer um pra editor", () => {
    render(HymnAudioList, {
      props: {
        audios: [APPROVED_AUDIO, PENDING_AUDIO],
        hymnTitle: "X",
        currentUser: { id: "u-3", username: "carla" },
        isEditor: true,
      },
    });
    expect(screen.getAllByTestId("audio-item")).toHaveLength(2);
    expect(screen.getAllByTestId("badge-pending")).toHaveLength(1);
  });

  it("uploader não vê pendentes de OUTROS uploaders", () => {
    const other = { ...PENDING_AUDIO, id: "a-other", uploadedBy: { id: "u-99", username: "outro" } };
    render(HymnAudioList, {
      props: {
        audios: [PENDING_AUDIO, other],
        hymnTitle: "X",
        currentUser: { id: "u-2", username: "bia" },
        isEditor: false,
      },
    });
    expect(screen.getAllByTestId("audio-item")).toHaveLength(1);
  });
});
