/**
 * Marco 4.B — Ciclo 4B.1.
 *
 * Tailwind 4 config para o shell headless. Os três papéis tipográficos
 * espelham o monolito Django (`templates/base.html` + `static/css/design-
 * tokens.css`). Mudar uma das três famílias quebra
 * `tests/unit/tailwind-config.test.ts` — intencional.
 *
 * No Tailwind 4 a config mínima (este arquivo) é opcional, mas mantemos
 * fontFamily aqui porque é o ponto canônico para o teste de regressão e
 * facilita a leitura humana das três famílias.
 */

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{html,svelte,ts,tsx,js,jsx}"],
  theme: {
    fontFamily: {
      display: [
        "Cormorant Garamond",
        "EB Garamond",
        "DejaVu Serif",
        "Georgia",
        "serif",
      ],
      serif: [
        "Source Serif 4",
        "DejaVu Serif",
        "Georgia",
        "Times New Roman",
        "serif",
      ],
      sans: ["Inter Tight", "Inter", "system-ui", "sans-serif"],
      mono: ["JetBrains Mono", "ui-monospace", "monospace"],
    },
  },
};

export default config;
