/**
 * Marco 4.F — Ciclos 4F.6, 4F.7, 4F.8, 4F.10.
 *
 * `AudioPlayer.svelte` é o singleton montado em `+layout.svelte` que consome
 * `audioState` e materializa o player na tela.
 *
 *   - 4F.6: renderiza metadata da currentTrack + botões play/pause/prev/next.
 *   - 4F.7: monta `<audio>` HTML; `audio.play()` é chamado quando `isPlaying=true`.
 *   - 4F.8: setta `navigator.mediaSession.metadata` com title/artist/album.
 *   - 4F.10: botão "minimizar" colapsa visualmente mas mantém áudio tocando;
 *     botão "fechar" dismiss + pausa.
 *
 * Os testes manipulam o store diretamente — o componente é só uma view.
 */

import { fireEvent, render, screen } from "@testing-library/svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AudioPlayer from "./AudioPlayer.svelte";
import { audioPlayer, audioState, type AudioTrack } from "$lib/stores/audio";

const trackOne: AudioTrack = {
  id: "audio-1",
  url: "https://example.test/one.mp3",
  title: "Lua Branca",
  hymnNumber: 7,
  hymnbookSlug: "justiceiro",
  waveformPeaks: [0.1, 0.2, 0.3, 0.4],
  durationSeconds: 180,
  uploadedByUsername: "mestre-irineu",
};

const trackTwo: AudioTrack = {
  id: "audio-2",
  url: "https://example.test/two.mp3",
  title: "Sol Dourado",
  hymnNumber: 8,
  hymnbookSlug: "justiceiro",
  durationSeconds: 200,
  uploadedByUsername: "padrinho-sebastiao",
};

// Stub global do HTMLMediaElement — jsdom não implementa play()/pause().
const playSpy = vi.fn().mockResolvedValue(undefined);
const pauseSpy = vi.fn();
const loadSpy = vi.fn();

beforeEach(() => {
  audioPlayer.reset();
  playSpy.mockClear();
  pauseSpy.mockClear();
  loadSpy.mockClear();
  // Patch HTMLMediaElement protótipo no jsdom.
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: playSpy,
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: pauseSpy,
  });
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    value: loadSpy,
  });
  // Reset Media Session entre testes.
  if ("mediaSession" in navigator) {
    (navigator as Navigator & { mediaSession: MediaSession }).mediaSession.metadata =
      null;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AudioPlayer — render (4F.6)", () => {
  it("não renderiza barra visível quando não há currentTrack", () => {
    render(AudioPlayer);
    expect(screen.queryByTestId("audio-player-bar")).toBeNull();
  });

  it("renderiza title, hymnNumber e hymnbookSlug da currentTrack", () => {
    audioPlayer.play(trackOne);
    render(AudioPlayer);

    const bar = screen.getByTestId("audio-player-bar");
    expect(bar).toBeInTheDocument();
    expect(screen.getByTestId("audio-player-title")).toHaveTextContent(/Lua Branca/);
    // Número do hino e hinário aparecem na meta.
    const meta = screen.getByTestId("audio-player-meta");
    expect(meta).toHaveTextContent(/7/);
    expect(meta).toHaveTextContent(/justiceiro/);
  });

  it("renderiza botões play/pause/prev/next", () => {
    audioPlayer.play(trackOne);
    render(AudioPlayer);

    expect(screen.getByTestId("audio-player-play")).toBeInTheDocument();
    expect(screen.getByTestId("audio-player-prev")).toBeInTheDocument();
    expect(screen.getByTestId("audio-player-next")).toBeInTheDocument();
  });

  it("clicar no play alterna isPlaying no store", async () => {
    audioPlayer.play(trackOne);
    render(AudioPlayer);

    expect(get(audioState).isPlaying).toBe(true);
    await fireEvent.click(screen.getByTestId("audio-player-play"));
    expect(get(audioState).isPlaying).toBe(false);
    await fireEvent.click(screen.getByTestId("audio-player-play"));
    expect(get(audioState).isPlaying).toBe(true);
  });

  it("clicar em next/prev navega na fila", async () => {
    audioPlayer.enqueue([trackOne, trackTwo]);
    audioPlayer.play(trackOne);
    render(AudioPlayer);

    await fireEvent.click(screen.getByTestId("audio-player-next"));
    expect(get(audioState).currentTrack?.id).toBe("audio-2");

    await fireEvent.click(screen.getByTestId("audio-player-prev"));
    expect(get(audioState).currentTrack?.id).toBe("audio-1");
  });
});

describe("AudioPlayer — <audio> binding (4F.7)", () => {
  it("renderiza <audio> com src=currentTrack.url", () => {
    audioPlayer.play(trackOne);
    const { container } = render(AudioPlayer);

    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute("src")).toBe(trackOne.url);
  });

  it("chama audio.play() quando isPlaying=true", async () => {
    audioPlayer.play(trackOne);
    render(AudioPlayer);
    // O $effect roda após mount; aguardamos uma microtask.
    await Promise.resolve();
    await Promise.resolve();
    expect(playSpy).toHaveBeenCalled();
  });

  it("chama audio.pause() quando isPlaying vira false", async () => {
    audioPlayer.play(trackOne);
    render(AudioPlayer);
    await Promise.resolve();
    await Promise.resolve();
    playSpy.mockClear();

    audioPlayer.pause();
    await Promise.resolve();
    await Promise.resolve();
    expect(pauseSpy).toHaveBeenCalled();
  });
});

describe("AudioPlayer — Media Session (4F.8)", () => {
  it("seta navigator.mediaSession.metadata com title/artist/album", async () => {
    if (!("mediaSession" in navigator)) {
      // Polyfill mínimo só pra teste — jsdom não traz mediaSession.
      (navigator as unknown as { mediaSession: MediaSession }).mediaSession = {
        metadata: null,
        setActionHandler: vi.fn(),
        playbackState: "none",
        setPositionState: vi.fn(),
      } as unknown as MediaSession;
    }
    // Polyfill mínimo de MediaMetadata pra jsdom.
    if (typeof (globalThis as { MediaMetadata?: unknown }).MediaMetadata === "undefined") {
      (globalThis as { MediaMetadata: unknown }).MediaMetadata = class {
        title: string;
        artist: string;
        album: string;
        artwork: unknown[];
        constructor(init: {
          title?: string;
          artist?: string;
          album?: string;
          artwork?: unknown[];
        }) {
          this.title = init.title ?? "";
          this.artist = init.artist ?? "";
          this.album = init.album ?? "";
          this.artwork = init.artwork ?? [];
        }
      } as unknown as typeof MediaMetadata;
    }

    audioPlayer.play(trackOne);
    render(AudioPlayer);
    await Promise.resolve();
    await Promise.resolve();

    const metadata = (navigator as Navigator).mediaSession?.metadata;
    expect(metadata).not.toBeNull();
    expect(metadata?.title).toBe("Lua Branca");
    expect(metadata?.artist).toBe("mestre-irineu");
    expect(metadata?.album).toBe("Hinária");
  });
});

describe("AudioPlayer — minimize / dismiss (4F.10)", () => {
  it("botão minimizar muda o estado mas mantém o áudio renderizado", async () => {
    audioPlayer.play(trackOne);
    render(AudioPlayer);
    await Promise.resolve();
    playSpy.mockClear();

    await fireEvent.click(screen.getByTestId("audio-player-minimize"));
    expect(get(audioState).isMinimized).toBe(true);
    // Áudio segue tocando — pause não foi chamado.
    expect(pauseSpy).not.toHaveBeenCalled();
    // A barra ganha modificador visual mas o <audio> continua no DOM.
    expect(screen.getByTestId("audio-player-bar")).toBeInTheDocument();
  });

  it("botão fechar dispara dismiss e pausa o áudio", async () => {
    audioPlayer.play(trackOne);
    render(AudioPlayer);
    await Promise.resolve();
    await Promise.resolve();

    await fireEvent.click(screen.getByTestId("audio-player-close"));
    expect(get(audioState).isDismissed).toBe(true);
    expect(get(audioState).isPlaying).toBe(false);
    // Bar some.
    expect(screen.queryByTestId("audio-player-bar")).toBeNull();
  });
});
