/**
 * Compila o `src/app.css` REAL pelo compilador do Tailwind 4 e devolve o CSS
 * resultante, para que os testes assertem o que o build produz.
 *
 * Por que isto existe: até 2026-08-31 dois testes (`tailwind-config.test.ts` e
 * `typography-parity.spec.ts`) liam `tailwind.config.ts` e passavam verdes há
 * meses — enquanto o arquivo NUNCA era lido pelo build. No Tailwind 4 a config
 * JS só entra via `@config`, que não existia. O resultado é que `.font-display`
 * não era gerada e todo `class="font-display"` do app renderizava em Inter
 * Tight. Dois testes verdes, zero garantia.
 *
 * A lição embutida aqui: asserte o ARTEFATO, não a intenção. O compilador é o
 * mesmo que o `@tailwindcss/vite` usa, então o que passar aqui é o que sai no
 * bundle.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { compile } from "tailwindcss";

const WEB_ROOT = path.resolve(__dirname, "../../..");
const APP_CSS = path.join(WEB_ROOT, "src/app.css");

/**
 * Resolve os `@import` do `app.css`.
 *
 * `@fontsource/*` é stubado: são só blocos `@font-face`, irrelevantes para a
 * geração de utilities, e carregá-los tornaria o teste dezenas de vezes mais
 * lento sem cobrir nada a mais. Que as famílias estejam realmente baixadas é
 * o assunto de `fonts-selfhosted.test.ts`.
 */
async function loadStylesheet(id: string, base: string) {
  if (id === "tailwindcss") {
    const resolved = path.join(WEB_ROOT, "node_modules/tailwindcss/index.css");
    return {
      path: resolved,
      base: path.dirname(resolved),
      content: readFileSync(resolved, "utf-8"),
    };
  }
  if (id.startsWith("@fontsource/")) {
    return { path: id, base, content: "" };
  }
  const resolved = path.resolve(base, id);
  return {
    path: resolved,
    base: path.dirname(resolved),
    content: readFileSync(resolved, "utf-8"),
  };
}

/**
 * Classes candidatas que o compilador precisa ver para emitir as utilities.
 * O Tailwind 4 só gera o que encontra no código — pedir uma classe aqui é o
 * equivalente a usá-la num `.svelte`.
 */
export const CANDIDATAS = [
  "font-display",
  "font-serif",
  "font-sans",
  "font-mono",
  "bg-cream",
  "bg-cream-soft",
  "bg-cream-deep",
  "text-ink",
  "text-ink-soft",
  "text-ink-mute",
  "text-ink/10",
  "border-rule",
  "bg-firmament",
  "text-firmament",
  "border-gold",
  "text-gold",
  "text-cream/85",
  "text-moss",
  "text-rust",
  "bg-status-ok",
  "bg-night",
  "bg-night-deep",
  "shadow-soft",
  "dark:bg-night",
];

let cache: Promise<string> | null = null;

/** CSS compilado do `app.css` real, com as {@link CANDIDATAS} materializadas. */
export function cssCompilado(): Promise<string> {
  cache ??= (async () => {
    const compiler = await compile(readFileSync(APP_CSS, "utf-8"), {
      base: path.join(WEB_ROOT, "src"),
      loadStylesheet,
    });
    return compiler.build(CANDIDATAS);
  })();
  return cache;
}

/** A regra de uma classe, com espaços normalizados. `null` se não foi gerada. */
export function regraDe(css: string, classe: string): string | null {
  // O Tailwind escapa `/` e `:` no seletor emitido (`.text-ink\\/10`,
  // `.dark\\:bg-night`), então o regex tem que casar a barra invertida.
  const escapada = classe
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/[/:]/g, (c) => "\\\\" + c);
  const achado = css.match(new RegExp("\\." + escapada + "\\s*\\{[^}]*\\}", "s"));
  return achado ? achado[0].replace(/\s+/g, " ") : null;
}

/** Valor declarado de uma custom property no CSS compilado. */
export function tokenDe(css: string, nome: string): string | null {
  const achado = css.match(new RegExp("--" + nome + ":\\s*([^;]+);"));
  return achado ? achado[1].trim() : null;
}
