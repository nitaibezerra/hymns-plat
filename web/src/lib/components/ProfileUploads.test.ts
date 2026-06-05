/**
 * Marco 4.H — Ciclo 4H.3.
 *
 * Unit tests do ProfileUploads: grid de cartões de áudio, estado vazio,
 * formatação da duração.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ProfileUploads from "./ProfileUploads.svelte";

function mkAudio(overrides: Partial<{ id: string; url: string; durationSeconds: number | null }> = {}) {
  return {
    id: overrides.id ?? "a1",
    url: overrides.url ?? "/m/1.mp3",
    durationSeconds: "durationSeconds" in overrides ? overrides.durationSeconds! : 90,
    waveformPeaks: [],
    uploadedBy: { id: "u1", username: "ana", email: "ana@example.com" },
  };
}

describe("ProfileUploads", () => {
  it("renderiza estado vazio quando não há áudios", () => {
    render(ProfileUploads, { props: { audios: [] } });
    expect(screen.getByTestId("profile-uploads-empty")).toBeInTheDocument();
    expect(screen.queryAllByTestId("profile-upload-item")).toHaveLength(0);
  });

  it("renderiza um cartão por áudio", () => {
    render(ProfileUploads, {
      props: {
        audios: [
          mkAudio({ id: "a1" }),
          mkAudio({ id: "a2" }),
          mkAudio({ id: "a3" }),
        ],
      },
    });
    expect(screen.getAllByTestId("profile-upload-item")).toHaveLength(3);
  });

  it("formata duração em m:ss", () => {
    render(ProfileUploads, {
      props: { audios: [mkAudio({ durationSeconds: 125 })] },
    });
    expect(screen.getByText("2:05")).toBeInTheDocument();
  });

  it("mostra '—' quando duração é null", () => {
    render(ProfileUploads, {
      props: { audios: [mkAudio({ durationSeconds: null })] },
    });
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
