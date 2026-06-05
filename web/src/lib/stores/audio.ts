/**
 * Audio store — stub mínimo. Impl completa em sub-marco 4.F (queue, waveform,
 * Media Session API). 4.D/4.E referenciam essa interface pra acionar o player.
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
}

const initialState: AudioState = {
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
};

export const audioState: Writable<AudioState> = writable(initialState);

export const audioPlayer = {
  play(track: AudioTrack): void {
    audioState.set({ currentTrack: track, isPlaying: true, currentTime: 0 });
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
};
