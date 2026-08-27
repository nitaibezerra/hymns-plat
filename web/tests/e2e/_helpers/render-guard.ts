/**
 * Guarda de renderização: um número de diff só significa algo se os DOIS
 * lados renderizaram conteúdo de verdade.
 *
 * Duas coisas invalidam uma medição de paridade, e são diferentes:
 *
 * 1. **Estado de erro** (`findLoadFailure`). Quando o shell SvelteKit cai no
 *    estado de erro — o caso histórico foi o `HTTP 403` de CSRF no
 *    `POST /graphql/` em SSR, hoje corrigido — a comparação passa a medir
 *    "página de erro vs página real". Todas as rotas do shell renderizam o
 *    erro no mesmo formato (`<p data-testid="error">Falha ao carregar …</p>`),
 *    então dá pra detectar por marcador em vez de heurística.
 *
 * 2. **Estado vazio** (`findEmptyState`). Pior que o erro, porque passa
 *    despercebido: medido em 2026-08-26, `/busca/?q=luz` deu **1,74% de diff —
 *    DENTRO do threshold de 5%** com o Django listando 50 resultados e o shell
 *    dizendo "Nenhum resultado para 'luz'". Duas páginas majoritariamente
 *    fundo creme batem em pixels mesmo dizendo coisas opostas. A load do
 *    `/busca/` engolia o 403 e caía em "sem resultados", que **não** tem
 *    `data-testid="error"` — daí precisar de uma guarda própria.
 *
 * Por que por marcador/frase e não por densidade de tinta: a suíte tinha um
 * gate de `contentBalance` (recusava medir com equilíbrio de tinta < 50%) e
 * ele acabou barrando a medição que o Sub-marco 4.I pede. O shell é um design
 * MAIS ESPARSO que o monolito — sem hero com arte de capa, sem faixa de cor,
 * sem tags de estilo por linha — então a tinta desequilibra por design, não
 * por falha de render (medido: `hymnbook-indice` com 64,12% de tinta no Django
 * contra 3,69% no shell, os dois com os 24 hinos da fixture na tela). Um gate
 * de densidade transforma o achado em "não medi". As duas funções deste
 * módulo olham o que a página DIZ, não quanto ela pinta.
 */

const ERROR_TESTID = /<[^>]*data-testid\s*=\s*['"]error['"][^>]*>([\s\S]*?)<\/[a-zA-Z]+>/;
const LOAD_FAILURE_TEXT = /Falha ao carregar[^<]*/;

/**
 * Marcadores de estado vazio do shell SvelteKit.
 *
 * `data-testid="empty"`, qualquer `*-empty` (`search-empty`,
 * `followers-empty`, `notifications-empty`…) e o `search-placeholder` da
 * `/busca/` sem query.
 */
const EMPTY_TESTID = /data-testid\s*=\s*['"](?:[a-z0-9-]*-)?(?:empty|placeholder)['"]/i;

/**
 * Frases de estado vazio, uma por template que tem uma.
 *
 * Lista explícita em vez de regex genérica de "Nenhum…": um falso positivo
 * aqui não é um teste vermelho, é uma medição que deixa de acontecer — e
 * "Nenhum" aparece em texto legítimo. Levantadas por grep nos templates do
 * Django (`templates/hymns/`, `templates/users/`) e nas rotas do shell
 * (`web/src/routes/`).
 */
const EMPTY_PHRASES: readonly string[] = [
  // Django
  "Nenhum hinário disponível",
  "Nenhum hino cadastrado",
  "Nenhum resultado para",
  "Nenhum seguidor ainda",
  "Nenhuma notificação",
  "Nenhum usuário sendo seguido",
  // SvelteKit
  "Nenhum hinário publicado ainda",
  "Nenhum hinário casa com",
  "Nenhuma notificação não lida",
  "Você não tem notificações",
  "Usuário não encontrado",
  "Hino não encontrado",
];

/**
 * @returns a mensagem de falha encontrada no HTML, ou `null` se a página
 *   parece ter renderizado conteúdo real.
 */
export function findLoadFailure(html: string): string | null {
  const tagged = ERROR_TESTID.exec(html);
  if (tagged) {
    return normalize(tagged[1]) || 'estado de erro (data-testid="error") sem texto';
  }
  const loose = LOAD_FAILURE_TEXT.exec(html);
  if (loose) {
    return normalize(loose[0]);
  }
  return null;
}

/**
 * @returns o marcador/frase de estado vazio encontrado, ou `null` quando a
 *   página listou conteúdo.
 */
export function findEmptyState(html: string): string | null {
  const marcador = EMPTY_TESTID.exec(html);
  if (marcador) return normalize(marcador[0]);
  for (const frase of EMPTY_PHRASES) {
    if (html.includes(frase)) return frase;
  }
  return null;
}

/**
 * Conta ocorrências de um trecho literal no HTML.
 *
 * É o que permite exigir "os dois lados listaram pelo menos N itens" sem
 * depender de classe CSS (que difere entre os dois apps) nem de `data-testid`
 * (que só existe no shell). `href="/hinos/` casa nos dois lados porque as
 * ROTAS são as mesmas — é o contrato do refactor headless.
 */
export function countOccurrences(html: string, needle: string): number {
  if (!needle) return 0;
  let total = 0;
  let index = html.indexOf(needle);
  while (index !== -1) {
    total += 1;
    index = html.indexOf(needle, index + needle.length);
  }
  return total;
}

function normalize(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
