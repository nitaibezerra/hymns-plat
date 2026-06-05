/**
 * Audio store — player global persistente (Marco 4.F).
 *
 * Mantém estado de reprodução desacoplado de qualquer rota: o `<AudioPlayer />`
 * é montado uma única vez em `+layout.svelte` e consome esse store, então
 * navegar entre rotas (`/hinos/X/`, `/hinarios/Y/`) não interrompe o áudio.
 *
 * Interface pública estável (4.D/4.E importam `audioPlayer.play`):
 *
 *   - `audioPlayer.play(track)` — toca a faixa imediatamente.
 *   - `audioPlayer.togglePlay()` — alterna play/pause.
 *   - `audioPlayer.pause()` — força pausa.
 *   - `audioPlayer.seek(t)` — pula pro instante `t` (segundos).
 *
 * Novos no 4.F (queue + state interno expandido):
 *
 *   - `audioPlayer.enqueue(tracks)` — substitui a fila pela lista dada.
 *   - `audioPlayer.playNext()` / `audioPlayer.playPrev()` — navega na fila.
 *   - `audioPlayer.setDuration(d)` / `setCurrentTime(t)` — usados pelo
 *     componente pra refletir o estado do `<audio>` no store.
 *   - `audioPlayer.minimize()` / `restore()` / `dismiss()` — UI state da
 *     barra fixa (cf. 4F.10).
 *   - `audioPlayer.reset()` — utilitário pra testes.
 *
 * O store em si (`audioState`) expõe: currentTrack, isPlaying, currentTime,
 * duration, queue, queueIndex, isMinimized, isDismissed.
 */

import { writable, type Writable } from "svelte/store";

export interface AudioTrack {
  id: string;
  url: string;
  title: string;
  hymnNumber?: number;
  hymnbookSlug?: string;
  waveformPeaks?: number[];
  durationSeconds?: number | null;
  uploadedByUsername?: string | null;
}

export interface AudioState {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: AudioTrack[];
  queueIndex: number;
  isMinimized: boolean;
  isDismissed: boolean;
}

const initialState: AudioState = {
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  queue: [],
  queueIndex: -1,
  isMinimized: false,
  isDismissed: false,
};

export const audioState: Writable<AudioState> = writable({ ...initialState });

function findIndexInQueue(queue: AudioTrack[], track: AudioTrack): number {
  return queue.findIndex((t) => t.id === track.id);
}

export const audioPlayer = {
  play(track: AudioTrack): void {
    audioState.update((s) => {
      const existingIndex = findIndexInQueue(s.queue, track);
      let queue = s.queue;
      let queueIndex = existingIndex;
      if (existingIndex === -1) {
        // Faixa não estava na fila — substitui a fila por uma só com essa faixa.
        queue = [track];
        queueIndex = 0;
      }
      return {
        ...s,
        currentTrack: track,
        isPlaying: true,
        currentTime: 0,
        duration: track.durationSeconds ?? 0,
        queue,
        queueIndex,
        isDismissed: false,
      };
    });
  },

  togglePlay(): void {
    audioState.update((s) => ({ ...s, isPlaying: !s.isPlaying }));
  },

  pause(): void {
    audioState.update((s) => ({ ...s, isPlaying: false }));
  },

  seek(t: number): void {
    audioState.update((s) => ({ ...s, currentTime: t }));
  },

  enqueue(tracks: AudioTrack[]): void {
    audioState.update((s) => {
      // Se há uma faixa tocando que existe na nova fila, ajusta o índice.
      let queueIndex = s.queueIndex;
      if (s.currentTrack) {
        const idx = findIndexInQueue(tracks, s.currentTrack);
        queueIndex = idx >= 0 ? idx : -1;
      } else {
        queueIndex = -1;
      }
      return { ...s, queue: [...tracks], queueIndex };
    });
  },

  playNext(): void {
    audioState.update((s) => {
      if (s.queue.length === 0) return s;
      const nextIndex = Math.min(s.queueIndex + 1, s.queue.length - 1);
      if (nextIndex === s.queueIndex) return s;
      const nextTrack = s.queue[nextIndex];
      return {
        ...s,
        currentTrack: nextTrack,
        queueIndex: nextIndex,
        isPlaying: true,
        currentTime: 0,
        duration: nextTrack.durationSeconds ?? 0,
      };
    });
  },

  playPrev(): void {
    audioState.update((s) => {
      if (s.queue.length === 0) return s;
      const prevIndex = Math.max(s.queueIndex - 1, 0);
      if (prevIndex === s.queueIndex) return s;
      const prevTrack = s.queue[prevIndex];
      return {
        ...s,
        currentTrack: prevTrack,
        queueIndex: prevIndex,
        isPlaying: true,
        currentTime: 0,
        duration: prevTrack.durationSeconds ?? 0,
      };
    });
  },

  setDuration(d: number): void {
    audioState.update((s) => ({ ...s, duration: d }));
  },

  setCurrentTime(t: number): void {
    audioState.update((s) => ({ ...s, currentTime: t }));
  },

  setPlaying(playing: boolean): void {
    audioState.update((s) => ({ ...s, isPlaying: playing }));
  },

  minimize(): void {
    audioState.update((s) => ({ ...s, isMinimized: true }));
  },

  restore(): void {
    audioState.update((s) => ({ ...s, isMinimized: false }));
  },

  dismiss(): void {
    audioState.update((s) => ({
      ...s,
      isPlaying: false,
      isDismissed: true,
    }));
  },

  reset(): void {
    audioState.set({ ...initialState, queue: [] });
  },
};
