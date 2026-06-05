/**
 * Marco 4.F — Sub-marco "Player global persistente".
 *
 * Testes do store global de áudio (`audioState` + `audioPlayer`).
 *
 * 4F.1: `audioPlayer.play(track)` define `currentTrack` e marca `isPlaying`.
 *       Mantém a interface mínima do stub original (4.D/4.E acionam o player
 *       via essa função, então a assinatura é contrato público).
 * 4F.2: `togglePlay()` alterna `isPlaying`; `pause()` força pausa; `seek(t)`
 *       atualiza `currentTime`.
 * 4F.3: `enqueue(tracks)`/`playNext()`/`playPrev()` operam a fila.
 */

import { get } from "svelte/store";
import { beforeEach, describe, expect, it } from "vitest";

import { audioPlayer, audioState, type AudioTrack } from "./audio";

const trackFoo: AudioTrack = {
  id: "audio-foo",
  url: "https://example.test/foo.mp3",
  title: "Foo",
  hymnNumber: 1,
  hymnbookSlug: "justiceiro",
  waveformPeaks: [0.1, 0.2, 0.3],
  durationSeconds: 90,
  uploadedByUsername: "ana",
};

const trackBar: AudioTrack = {
  id: "audio-bar",
  url: "https://example.test/bar.mp3",
  title: "Bar",
  hymnNumber: 2,
  hymnbookSlug: "justiceiro",
};

const trackBaz: AudioTrack = {
  id: "audio-baz",
  url: "https://example.test/baz.mp3",
  title: "Baz",
};

beforeEach(() => {
  // Reseta o store antes de cada teste pra isolar efeitos.
  audioPlayer.reset();
});

describe("audioPlayer.play (4F.1)", () => {
  it("define currentTrack e marca isPlaying=true", () => {
    audioPlayer.play(trackFoo);

    const state = get(audioState);
    expect(state.currentTrack).toEqual(trackFoo);
    expect(state.isPlaying).toBe(true);
  });

  it("reseta currentTime ao iniciar uma nova faixa", () => {
    audioPlayer.play(trackFoo);
    audioPlayer.seek(42);

    audioPlayer.play(trackBar);

    expect(get(audioState).currentTime).toBe(0);
    expect(get(audioState).currentTrack?.id).toBe("audio-bar");
  });

  it("expõe duration inicial 0 e currentTrack null antes de qualquer play", () => {
    const state = get(audioState);
    expect(state.currentTrack).toBeNull();
    expect(state.isPlaying).toBe(false);
    expect(state.currentTime).toBe(0);
    expect(state.duration).toBe(0);
  });
});

describe("audioPlayer.togglePlay / pause / seek (4F.2)", () => {
  it("togglePlay alterna isPlaying", () => {
    audioPlayer.play(trackFoo);
    expect(get(audioState).isPlaying).toBe(true);

    audioPlayer.togglePlay();
    expect(get(audioState).isPlaying).toBe(false);

    audioPlayer.togglePlay();
    expect(get(audioState).isPlaying).toBe(true);
  });

  it("pause força isPlaying=false mesmo se já pausado", () => {
    audioPlayer.play(trackFoo);
    audioPlayer.pause();
    expect(get(audioState).isPlaying).toBe(false);

    audioPlayer.pause();
    expect(get(audioState).isPlaying).toBe(false);
  });

  it("seek atualiza currentTime", () => {
    audioPlayer.play(trackFoo);
    audioPlayer.seek(12.5);
    expect(get(audioState).currentTime).toBe(12.5);
  });
});

describe("audioPlayer.enqueue / playNext / playPrev (4F.3)", () => {
  it("enqueue adiciona faixas à fila preservando a ordem", () => {
    audioPlayer.enqueue([trackFoo, trackBar, trackBaz]);
    const state = get(audioState);
    expect(state.queue.map((t) => t.id)).toEqual([
      "audio-foo",
      "audio-bar",
      "audio-baz",
    ]);
  });

  it("play(track) com tracks na fila ajusta o índice para a faixa correspondente", () => {
    audioPlayer.enqueue([trackFoo, trackBar, trackBaz]);
    audioPlayer.play(trackBar);
    expect(get(audioState).queueIndex).toBe(1);
    expect(get(audioState).currentTrack?.id).toBe("audio-bar");
  });

  it("playNext avança pra próxima faixa da fila", () => {
    audioPlayer.enqueue([trackFoo, trackBar, trackBaz]);
    audioPlayer.play(trackFoo);

    audioPlayer.playNext();
    expect(get(audioState).currentTrack?.id).toBe("audio-bar");
    expect(get(audioState).queueIndex).toBe(1);

    audioPlayer.playNext();
    expect(get(audioState).currentTrack?.id).toBe("audio-baz");
  });

  it("playNext no fim da fila não avança (fica na última)", () => {
    audioPlayer.enqueue([trackFoo, trackBar]);
    audioPlayer.play(trackBar);
    audioPlayer.playNext();
    expect(get(audioState).currentTrack?.id).toBe("audio-bar");
  });

  it("playPrev volta pra faixa anterior", () => {
    audioPlayer.enqueue([trackFoo, trackBar, trackBaz]);
    audioPlayer.play(trackBaz);

    audioPlayer.playPrev();
    expect(get(audioState).currentTrack?.id).toBe("audio-bar");
  });

  it("playPrev no início da fila não retrocede (fica na primeira)", () => {
    audioPlayer.enqueue([trackFoo, trackBar]);
    audioPlayer.play(trackFoo);
    audioPlayer.playPrev();
    expect(get(audioState).currentTrack?.id).toBe("audio-foo");
  });
});
