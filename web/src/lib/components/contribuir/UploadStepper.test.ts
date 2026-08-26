/**
 * Sub-marco 5.F — Ciclo 5F.6.
 *
 * Contrato do stepper (porta de `_upload_stepper.html`):
 *   - sempre 4 passos, na ordem UPLOAD · PROCESSANDO · CONFERIR · CONFIRMAR;
 *   - o passo atual marcado com `data-state="current"` e `aria-current="step"`;
 *   - passos anteriores com `data-state="done"` e o marcador ✓;
 *   - passos futuros com `data-state="todo"` e o próprio número.
 */

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import UploadStepper from "./UploadStepper.svelte";

function steps() {
  return screen.getAllByTestId("upload-step");
}

describe("UploadStepper (5F.6)", () => {
  it("renderiza os 4 passos na ordem do wizard Django", () => {
    render(UploadStepper, { props: { step: 1 } });
    expect(steps()).toHaveLength(4);
    expect(steps().map((li) => li.getAttribute("data-label"))).toEqual([
      "UPLOAD",
      "PROCESSANDO",
      "CONFERIR",
      "CONFIRMAR",
    ]);
  });

  it("destaca o passo atual", () => {
    render(UploadStepper, { props: { step: 2 } });
    const current = steps()[1];
    expect(current).toHaveAttribute("data-state", "current");
    expect(current).toHaveAttribute("aria-current", "step");
  });

  it("marca os passos anteriores como concluídos com ✓", () => {
    render(UploadStepper, { props: { step: 3 } });
    const [first, second, third, fourth] = steps();
    expect(first).toHaveAttribute("data-state", "done");
    expect(second).toHaveAttribute("data-state", "done");
    expect(first.querySelector('[data-testid="upload-step-marker"]')).toHaveTextContent("✓");
    expect(third).toHaveAttribute("data-state", "current");
    expect(fourth).toHaveAttribute("data-state", "todo");
  });

  it("passos futuros mostram o próprio número", () => {
    render(UploadStepper, { props: { step: 1 } });
    const markers = screen.getAllByTestId("upload-step-marker");
    expect(markers[1]).toHaveTextContent("2");
    expect(markers[2]).toHaveTextContent("3");
    expect(markers[3]).toHaveTextContent("4");
  });

  it("só um passo é o atual", () => {
    render(UploadStepper, { props: { step: 4 } });
    expect(steps().filter((li) => li.getAttribute("data-state") === "current")).toHaveLength(1);
  });
});
