/**
 * Configuração de runtime. A URL do GraphQL é resolvida em tempo de import
 * via `import.meta.env`.
 *
 * O fallback pra `http://localhost:8000/graphql/` existe, mas NÃO é silencioso
 * — era. Sem `VITE_GRAPHQL_URL` o SSR falava com qualquer coisa que estivesse
 * na :8000 e o erro que chegava ao desenvolvedor era **CORS**, ou seja o
 * sintoma errado; a frente da paridade visual queimou tempo nisso
 * (`_plan/marco4-diff-notes.md`, item 7).
 *
 * Regra, por ambiente:
 *
 * - **dev**: mantém o fallback e AVISA alto no boot, nomeando a URL em uso, a
 *   variável e o sintoma que aparece se a porta estiver errada. Não falha
 *   rápido de propósito: rodar `pnpm dev` contra um Django em :8000 é o setup
 *   local mais comum e travar um clone novo por causa disso seria hostil.
 *   `scripts/dev-fullstack.sh` já exporta a variável apontando pra porta que
 *   ele mesmo sobe.
 * - **test**: fallback calado. O valor ali é deliberado (todo fetch é falso) e
 *   um aviso por arquivo de teste só sujaria a saída da suíte.
 * - **produção servindo**: sem fallback. Um bundle com `localhost` embutido é
 *   bug grave, e morrer no boot do servidor com a causa na tela é melhor que
 *   servir um site que quebra em CORS pra todo visitante.
 * - **produção buildando** (`building` do `$app/environment`): aviso, não
 *   erro. O `vite build` importa cada módulo de rota na etapa `analyse` pra
 *   ler `prerender`/`ssr`, então um `throw` aqui derruba o build inteiro — e
 *   hoje o `pnpm build` do CI (`.github/workflows/ci-web.yml`) roda de
 *   propósito SEM a variável, como smoke test de compilação. Nem o workflow
 *   nem `vite.config.ts` estão no escopo desta frente, então o build fica
 *   barulhento em vez de vermelho. Follow-up registrado em
 *   `_plan/marco6-decisoes.md`: quando a SPA ganhar pipeline de deploy, setar
 *   `VITE_GRAPHQL_URL` no CI e no deploy e promover isto a guard pré-build.
 */

import { building } from "$app/environment";

/** Django local do `runserver` padrão. Só vale em dev, e sempre com aviso. */
export const FALLBACK_GRAPHQL_URL = "http://localhost:8000/graphql/";

/** Subconjunto de `import.meta.env` que interessa aqui, + a fase do build. */
export interface RuntimeEnv {
  VITE_GRAPHQL_URL?: string;
  MODE?: string;
  DEV?: boolean;
  PROD?: boolean;
  /** `building` do `$app/environment`: true durante `analyse`/prerender. */
  BUILDING?: boolean;
}

/**
 * Resolve a URL do GraphQL a partir do ambiente.
 *
 * Exportado (e recebendo `env`/`warn`) pra ser testável sem mexer no
 * `import.meta.env` real do processo.
 *
 * @throws se `VITE_GRAPHQL_URL` faltar num build de produção.
 */
export function _resolveGraphqlUrl(
  env: RuntimeEnv,
  warn: (message: string) => void = console.warn,
): string {
  const configurada = env.VITE_GRAPHQL_URL?.trim();
  if (configurada) return configurada;

  if (env.PROD && !env.BUILDING) {
    throw new Error(
      "VITE_GRAPHQL_URL não está definida. Um build de produção sem essa " +
        `variável embutiria ${FALLBACK_GRAPHQL_URL} no bundle e o site ` +
        "quebraria em CORS para todo visitante. Defina VITE_GRAPHQL_URL no " +
        "ambiente de build (ex.: https://api.hinaria.com.br/graphql/).",
    );
  }

  if (env.PROD && env.BUILDING) {
    warn(
      "[hinaria/config] BUILD DE PRODUÇÃO SEM VITE_GRAPHQL_URL. O bundle vai " +
        `sair com ${FALLBACK_GRAPHQL_URL} embutido e QUEBRAR no primeiro ` +
        "request (o servidor lança na inicialização, de propósito). Isto é " +
        "aviso e não erro só porque o smoke build do CI roda sem a variável. " +
        "Defina VITE_GRAPHQL_URL no ambiente de build antes de publicar.",
    );
    return FALLBACK_GRAPHQL_URL;
  }

  if (env.MODE !== "test") {
    warn(
      "[hinaria/config] VITE_GRAPHQL_URL não está definida — usando o " +
        `fallback ${FALLBACK_GRAPHQL_URL}. Se o backend estiver em outra ` +
        "porta, o SSR falha com erro de CORS e não com o erro real. Defina " +
        "VITE_GRAPHQL_URL em web/.env, ou suba o ambiente com " +
        "`web/scripts/dev-fullstack.sh`, que já aponta pra porta certa.",
    );
  }

  return FALLBACK_GRAPHQL_URL;
}

export const GRAPHQL_URL = _resolveGraphqlUrl({
  ...(import.meta.env as RuntimeEnv),
  BUILDING: building,
});

/**
 * Destino do GraphQL **no SSR**, quando ele precisa diferir do público.
 *
 * Por que existe: em produção o apex `hinaria.com.br` é servido por um Worker
 * (`hinaria-proxy`) que reescreve o `Host` — o Railway não responde sem isso.
 * E um Worker que faz `fetch` para o PRÓPRIO domínio **não passa pelas rotas
 * de Worker da zona**: a subrequisição vai direto ao origin, com o Host que o
 * Railway não sabe rotear. Resultado medido no beta: `404` servido pela
 * `cloudflare`, que o SvelteKit reporta como
 * `CORS error: No 'Access-Control-Allow-Origin' header` — porque um 404 do
 * edge não carrega header de CORS. O erro que aparece não é o erro que existe.
 *
 * Então o SSR aponta para a URL interna do Railway (fora da zona, sem a
 * armadilha) e o navegador continua no apex, onde o proxy funciona e o cookie
 * de sessão flui. Vazio = sem desvio, que é o certo em dev.
 */
export const GRAPHQL_SSR_URL: string =
  (import.meta.env.VITE_GRAPHQL_SSR_URL as string | undefined)?.trim() || GRAPHQL_URL;
