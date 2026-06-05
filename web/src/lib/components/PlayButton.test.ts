/**
 * Marco 4.F — PlayButton.
 *
 * Botão genérico "tocar este hino/áudio" que aciona o player global via
 * `audioPlayer.play(track)`. Usado por 4.E (página do hino) e 4.D (página
 * do hinário) sem repetir lógica de click+store.
 *
 * Comportamento:
 *   - Recebe `track: AudioTrack` por prop.
 *   - Quando `currentTrack.id === track.id` e `isPlaying`, mostra rótulo
 *     "Pausar" e o click chama `togglePlay()`.
 *   - Caso contrário, mostra "Tocar" e o click chama `play(track)`.
 *
 * O componente é dumb — não fala com GraphQL nem assume contexto da rota.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { get } from "svelte/store";
import { beforeEach, describe, expect, it } from "vitest";

import PlayButton from "./PlayButton.svelte";
import { audioPlayer, audioState, type AudioTrack } from "$lib/stores/audio";

const trackA: AudioTrack = {
  id: "a",
  url: "https://example.test/a.mp3",
  title: "Faixa A",
};

const trackB: AudioTrack = {
  id: "b",
  url: "https://example.test/b.mp3",
  title: "Faixa B",
};

beforeEach(() => {
  audioPlayer.reset();
});

describe("PlayButton", () => {
  it("renderiza rótulo 'Tocar' quando não há faixa ativa", () => {
    render(PlayButton, { props: { track: trackA } });
    const btn = screen.getByTestId("play-button");
    expect(btn).toHaveAttribute("aria-label", expect.stringMatching(/tocar/i));
  });

  it("chama audioPlayer.play(track) ao clicar", async () => {
    render(PlayButton, { props: { track: trackA } });
    await fireEvent.click(screen.getByTestId("play-button"));
    expect(get(audioState).currentTrack?.id).toBe("a");
    expect(get(audioState).isPlaying).toBe(true);
  });

  it("renderiza rótulo 'Pausar' quando a faixa atual coincide e está tocando", () => {
    audioPlayer.play(trackA);
    render(PlayButton, { props: { track: trackA } });
    const btn = screen.getByTestId("play-button");
    expect(btn).toHaveAttribute("aria-label", expect.stringMatching(/pausar/i));
  });

  it("alterna play/pause ao clicar quando a faixa coincide", async () => {
    audioPlayer.play(trackA);
    render(PlayButton, { props: { track: trackA } });

    await fireEvent.click(screen.getByTestId("play-button"));
    expect(get(audioState).isPlaying).toBe(false);

    await fireEvent.click(screen.getByTestId("play-button"));
    expect(get(audioState).isPlaying).toBe(true);
  });

  it("troca de faixa ao clicar quando há outra tocando", async () => {
    audioPlayer.play(trackA);
    render(PlayButton, { props: { track: trackB } });

    await fireEvent.click(screen.getByTestId("play-button"));
    expect(get(audioState).currentTrack?.id).toBe("b");
    expect(get(audioState).isPlaying).toBe(true);
  });
});
