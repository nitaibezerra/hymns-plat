/**
 * Marco 4.B — Ciclo 4B.5.
 *
 * Tema da UI (light/dark). Encapsula:
 *
 *   - chave de persistência (`hinaria-theme` em `localStorage`).
 *   - atributo refletido no `<html>` (`data-theme`).
 *
 * Por que sem `writable`: cada componente (ThemeToggle) e cada teste
 * pode ter um ciclo de vida distinto e precisa re-ler `localStorage`
 * no mount. Funções puras + `$state` local do componente são mais fáceis
 * de testar e não vazam estado entre `render()`.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "hinaria-theme";
const THEME_ATTR = "data-theme";

export function readSavedTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "dark" || saved === "light" ? saved : null;
}

export function readCurrentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute(THEME_ATTR);
  return attr === "dark" ? "dark" : "light";
}

export function applyTheme(value: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute(THEME_ATTR, value);
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      /* ignore quota / private-mode errors */
    }
  }
}

export function toggleTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}

export function initialTheme(): Theme {
  return readSavedTheme() ?? "light";
}
