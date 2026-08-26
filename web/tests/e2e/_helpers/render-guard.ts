/**
 * Guarda de renderização: um número de diff só significa algo se os DOIS
 * lados renderizaram conteúdo de verdade.
 *
 * Quando o shell SvelteKit cai no estado de erro (o caso concreto é o
 * `HTTP 403` de CSRF no `POST /graphql/` em SSR), a comparação passa a medir
 * "página de erro vs página real" — um percentual que parece paridade de
 * design e não é. Melhor a suíte falhar dizendo exatamente isso.
 *
 * Todas as rotas do shell renderizam o erro no mesmo formato
 * (`<p data-testid="error">Falha ao carregar …: {erro}</p>`), então dá pra
 * detectar por marcador em vez de heurística de texto solto.
 */

const ERROR_TESTID = /<[^>]*data-testid\s*=\s*['"]error['"][^>]*>([\s\S]*?)<\/[a-zA-Z]+>/;
const LOAD_FAILURE_TEXT = /Falha ao carregar[^<]*/;

/**
 * @returns a mensagem de falha encontrada no HTML, ou `null` se a página
 *   parece ter renderizado conteúdo real.
 */
export function findLoadFailure(html: string): string | null {
  const tagged = ERROR_TESTID.exec(html);
  if (tagged) {
    return normalize(tagged[1]) || "estado de erro (data-testid=\"error\") sem texto";
  }
  const loose = LOAD_FAILURE_TEXT.exec(html);
  if (loose) {
    return normalize(loose[0]);
  }
  return null;
}

function normalize(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
