/**
 * Marco 4.E — Ciclo 4E.5.
 *
 * `PlayButton` é um botão mínimo que dispara `audioPlayer.play(track)`
 * do stub `$lib/stores/audio` quando clicado. A impl real do player
 * (queue, waveform animado, Media Session API) vem no sub-marco 4.F.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { get } from "svelte/store";
import { beforeEach, describe, expect, it } from "vitest";

import PlayButton from "./PlayButton.svelte";
import { audioState, type AudioTrack } from "$lib/stores/audio";

const TRACK: AudioTrack = {
  id: "a-1",
  url: "https://media.example.com/a1.mp3",
  title: "Estrela do Norte",
  hymnNumber: 12,
  waveformPeaks: [1, 2, 3],
  durationSeconds: 180,
  uploadedByUsername: "ana",
};

describe("PlayButton", () => {
  beforeEach(() => {
    audioState.set({ currentTrack: null, isPlaying: false, currentTime: 0 });
  });

  it("renderiza um botão acessível com label 'Tocar <título>'", () => {
    render(PlayButton, { props: { track: TRACK } });
    const button = screen.getByTestId("play-button");
    expect(button).toBeInTheDocument();
    expect(button.getAttribute("aria-label")).toBe("Tocar Estrela do Norte");
  });

  it("ao clicar, chama audioPlayer.play(track) — store passa pra isPlaying=true", async () => {
    render(PlayButton, { props: { track: TRACK } });
    await fireEvent.click(screen.getByTestId("play-button"));

    const state = get(audioState);
    expect(state.isPlaying).toBe(true);
    expect(state.currentTrack?.id).toBe("a-1");
    expect(state.currentTrack?.title).toBe("Estrela do Norte");
  });
});
