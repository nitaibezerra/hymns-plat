/**
 * Fase 1 da paridade visual — trava a camada `@theme` do `src/app.css`.
 *
 * Substitui `tailwind-config.test.ts`, deletado junto com o próprio
 * `tailwind.config.ts`: aquele arquivo nunca foi lido pelo build (no Tailwind 4
 * a config JS exige `@config`, ausente aqui), então o teste passava verde
 * validando um artefato inerte. Ver `tests/unit/_helpers/tailwind.ts`.
 *
 * A paleta e as famílias espelham o `tailwind.config` inline de
 * `templates/base.html`:61-98 do monolito. Divergir de um valor aqui é
 * divergir da paridade visual, e é por isso que os hexes estão escritos à mão
 * em vez de lidos do CSS.
 */

import { describe, expect, it } from "vitest";

import { cssCompilado, regraDe, tokenDe } from "./_helpers/tailwind";

/** Verbatim de `templates/base.html` — paleta "Luz do Firmamento". */
const PALETA: Record<string, string> = {
  cream: "#f6efe2",
  "cream-soft": "#efe6d2",
  "cream-deep": "#e6dcc4",
  ink: "#1a1d2e",
  "ink-soft": "#3a3f57",
  "ink-mute": "#6b6f85",
  rule: "#c8bda1",
  "rule-soft": "#d9cfb6",
  firmament: "#1d3b6a",
  "firmament-2": "#2c5a92",
  "firmament-3": "#6f8fb8",
  gold: "#b8893a",
  "gold-soft": "#d9b06a",
  moss: "#4a6a3a",
  rust: "#b13e2e",
  vermilion: "#b13e2e",
  "status-not": "#b13e2e",
  "status-mid": "#b8893a",
  "status-ok": "#4a6a3a",
  night: "#0e1320",
  "night-deep": "#1a2030",
};

const PAPEIS_TIPOGRAFICOS: Record<string, string> = {
  display: "Cormorant Garamond",
  serif: "Source Serif 4",
  sans: "Inter Tight",
  mono: "JetBrains Mono",
};

describe("@theme do app.css — paleta", () => {
  it.each(Object.entries(PALETA))(
    "declara --color-%s como %s (mesmo valor do monolito)",
    async (nome, hex) => {
      expect(tokenDe(await cssCompilado(), `color-${nome}`)).toBe(hex);
    },
  );

  it("gera as utilities de cor — era o que faltava para portar markup do Django", async () => {
    const css = await cssCompilado();
    expect(regraDe(css, "bg-cream")).toContain("background-color: var(--color-cream)");
    expect(regraDe(css, "text-ink")).toContain("color: var(--color-ink)");
    expect(regraDe(css, "border-gold")).toContain("border-color: var(--color-gold)");
    expect(regraDe(css, "bg-firmament")).toContain("background-color: var(--color-firmament)");
  });

  it("suporta modificador de opacidade, que o markup do Django usa muito (text-ink/10)", async () => {
    const css = await cssCompilado();
    expect(regraDe(css, "text-ink/10")).toContain("color-mix");
    expect(regraDe(css, "text-cream/85")).toContain("color-mix");
  });

  it("gera shadow-soft — a sombra dos cards do monolito", async () => {
    expect(regraDe(await cssCompilado(), "shadow-soft")).toContain("rgba(20, 33, 58, 0.06)");
  });
});

describe("@theme do app.css — tipografia", () => {
  it.each(Object.entries(PAPEIS_TIPOGRAFICOS))(
    "font-%s resolve com %s como primeira família",
    async (papel, familia) => {
      const css = await cssCompilado();
      expect(regraDe(css, `font-${papel}`)).toContain(`font-family: var(--font-${papel})`);
      expect(tokenDe(css, `font-${papel}`)).toMatch(new RegExp(`^["']?${familia}["']?`));
    },
  );

  it("font-display existe de fato — a regressão que motivou a Fase 1", async () => {
    // Até 2026-08-31 esta regra NÃO era emitida: `--font-display` vivia só em
    // `:root`, que não alimenta o Tailwind. Todo título do app caía no
    // Inter Tight herdado do `body`.
    expect(regraDe(await cssCompilado(), "font-display")).not.toBeNull();
  });

  it("não confunde os papéis: serif de corpo não é a display", async () => {
    expect(tokenDe(await cssCompilado(), "font-serif")).not.toContain("Cormorant");
  });
});

describe("@theme do app.css — variante dark", () => {
  it("é disparada por data-theme, não por prefers-color-scheme", async () => {
    // O toggle do app escreve `data-theme` no <html> (lib/stores/theme.ts) e
    // `initialTheme()` NÃO consulta o sistema. Sem o @custom-variant, `dark:`
    // seguiria o SO e brigaria com o toggle — o monolito resolve o mesmo
    // problema com `darkMode: 'class'`.
    const regra = regraDe(await cssCompilado(), "dark:bg-night");
    expect(regra).toContain('[data-theme="dark"]');
    expect(regra).not.toContain("prefers-color-scheme");
  });
});
