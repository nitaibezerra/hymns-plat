import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// jsdom não implementa HTMLMediaElement.play/pause/load (lança "Not
// implemented" se chamado) — sobrescrevemos com stubs no-op em testes.
if (typeof HTMLMediaElement !== "undefined") {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
}

// Polyfill mínimo de MediaMetadata pra jsdom (4F.8).
if (typeof globalThis.MediaMetadata === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).MediaMetadata = class {
    title: string;
    artist: string;
    album: string;
    artwork: unknown[];
    constructor(init: {
      title?: string;
      artist?: string;
      album?: string;
      artwork?: unknown[];
    } = {}) {
      this.title = init.title ?? "";
      this.artist = init.artist ?? "";
      this.album = init.album ?? "";
      this.artwork = init.artwork ?? [];
    }
  };
}

// Polyfill mínimo de navigator.mediaSession.
if (typeof navigator !== "undefined" && !("mediaSession" in navigator)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (navigator as any).mediaSession = {
    metadata: null,
    setActionHandler: vi.fn(),
    setPositionState: vi.fn(),
    playbackState: "none",
  };
}
