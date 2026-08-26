# Marco 6 — decisões travadas antes do primeiro ciclo

Documento de decisão (não é menu de opções). Cobre as escolhas que o Marco 6
(`_plan/plano-headless-graphql.md:846-873`) deixou implícitas e que travariam o
primeiro ciclo TDD. Tudo aqui é **decidido**; o que não dá pra decidir sem
insumo externo está na seção "Gaps".

Projeto irmão citado como precedente: `gestao-feitio`
(`/Users/nitai/dev/hyms-platform/gestao-feitio/app/`). Sempre que afirmo algo
sobre ele, cito `arquivo:linha`.

## Já entregue (pré-requisitos, fora do PR do Marco 6)

| Item | Onde |
|---|---|
| `HymnBook.sync_version` (PositiveIntegerField, default 0) | `apps/hymns/models.py:95` |
| Migration | `apps/hymns/migrations/0017_hymnbook_sync_version.py` |
| Incremento por signal (Hymn/HymnAudio, save **e** delete) | `apps/hymns/signals.py:217-238` |
| Guarda contra rollback do contador em save stale | `apps/hymns/signals.py:199-214` |
| Testes | `tests/unit/test_sync_version.py` (14 casos) |
| `web/static/` + manifest | `web/static/manifest.webmanifest` |
| `<link rel="manifest">` + theme-color claro/escuro | `web/src/app.html` |

Detalhe que vale conhecer antes de escrever o cliente offline: o incremento usa
`F()` + `.update()` (`apps/hymns/signals.py:179-183`), portanto **não** dispara
`post_save` de `HymnBook` — nada de cascata de signals e nada de perda de
corrida. E um `pre_save` em `HymnBook` (`apps/hymns/signals.py:199`) relê o
contador do banco antes do UPDATE, porque um `save()` completo de instância
stale (o que as views editoriais fazem) faria o contador **andar pra trás** e o
cliente offline nunca invalidaria o cache. Isso foi pego por teste, não por
inspeção.

`sync_version` é monotônico mas **não é um número de versão semântico**: um
`import_yaml` de 130 hinos incrementa 130 vezes. O cliente só deve comparar
igualdade (`local === remoto` ⇒ cache válido), nunca fazer aritmética com a
diferença.

---

## 1. Service worker: `@vite-pwa/sveltekit` em modo `injectManifest`

**Decisão:** `@vite-pwa/sveltekit` com `strategies: 'injectManifest'`,
`srcDir: 'src'`, `filename: 'service-worker.ts'`, `manifest: false`.

**Justificativa (uma linha cada):**

- **É Workbox** — o plano fixou "Workbox (precaching + runtime caching)"
  (`_plan/plano-headless-graphql.md:851`), e o plugin é um wrapper de
  `vite-plugin-pwa`/Workbox: a decisão do plano é honrada sem escrever build
  step nenhum.
- **Precedente validado nesta casa** — `gestao-feitio` já roda
  `@vite-pwa/sveltekit ^0.6.6` (`app/package.json:27`) com um bloco de config de
  ~38 linhas (`app/vite.config.ts:8-46`) que é quase copiável (ver seção 5).
- **`injectManifest` em vez de `generateSW`** porque o Marco 6 precisa de código
  próprio no SW (handler de `message` pra pré-cachear os áudios de um hinário
  sob demanda, `RangeRequestsPlugin` pro `<audio>`); `generateSW` não deixa
  escrever SW à mão. Com `injectManifest` a gente escreve
  `web/src/service-worker.ts` e chama `precacheAndRoute(self.__WB_MANIFEST)`.
- **SW manual do SvelteKit (`$service-worker`) rejeitado** — daria precache de
  graça (`build`, `files`, `version`), mas obrigaria a reimplementar à mão
  expiração, `cacheableResponse`, `purgeOnQuotaError` e Range requests. Isso é
  exatamente o "reescrever regra que já existe" que este projeto tem como
  débito recorrente.
- **Workbox cru (`workbox-build` + script próprio) rejeitado** — mesmo resultado
  do plugin, com um build step a mais pra manter.

**Cuidado com SSR (isto NÃO é copiável do irmão):** hinaria usa
`@sveltejs/adapter-cloudflare` com SSR (`web/svelte.config.js:1,8`);
`gestao-feitio` usa `adapter-static` com `fallback: 'index.html'`
(`app/svelte.config.js:7-13`). Por isso o `navigateFallback: '/'` dele
(`app/vite.config.ts:23`) **não serve aqui** — em SSR o HTML de `/` é dinâmico e
precachear a raiz serve conteúdo velho. Decisão: criar uma rota
`web/src/routes/offline/+page.svelte` com `export const prerender = true` e usar
`navigateFallback: '/offline'`, com `navigateFallbackDenylist: [/^\/_app\//, /^\/graphql\//]`.

**Dev vs preview:** manter `devOptions.enabled: false` (igual
`app/vite.config.ts:15-17`). Consequência direta pro critério de aceitação do
plano: o E2E offline **tem que rodar contra `pnpm build && pnpm preview`**, não
contra `pnpm dev` — sem SW registrado, `context.setOffline(true)` só produz erro
de rede.

## 2. Persistência local: Dexie 4

**Decisão:** `dexie@^4`, um único módulo `web/src/lib/offline/db.ts` exportando
uma factory `criarDb(nome)`.

**Justificativa:**

- **Índices compostos sem cerimônia** — as 4 tabelas do plano
  (`_plan/plano-headless-graphql.md:852-856`) querem consultas do tipo "hinos do
  hinário X ordenados por número" e "fila de mutations por `retries`"; em Dexie
  isso é uma string de schema (ver `app/src/infra/persistencia/dexie-db.ts:49-54`
  no irmão), em `idb` é código de cursor.
- **`liveQuery` casa com store Svelte** — o irmão usa
  `liveQuery(() => listarPorFeitio(feitioId))`
  (`app/src/infra/persistencia/repositorio-eventos.ts:52-54`) e consome como
  store; a SPA aqui vai querer o mesmo pro badge "N mutations pendentes".
- **`idb` rejeitado** — 2 KB contra ~25 KB gzip do Dexie é economia real, mas
  paga-se em camada de query escrita à mão e sem observabilidade reativa; o
  bundle da SPA já carrega urql e Tailwind, 25 KB não move a agulha.
- **IndexedDB cru rejeitado** — transação que aborta silenciosamente por
  `versionchange` é uma classe de bug que não vale reencontrar.
- **Testabilidade decidida junto:** `fake-indexeddb/auto` no setup do vitest,
  exatamente como `app/vitest.setup.ts:2`. Isso é o que torna o ciclo TDD do
  Marco 6 possível sem browser.

**Regra de schema:** a factory recebe o nome do banco (`criarDb(nome = 'hinaria')`,
espelhando `app/src/infra/persistencia/dexie-db.ts:58-60`) para que cada teste
use um banco isolado. Sem isso os testes vazam estado entre si.

## 3. Cache dos áudios: CacheFirst, mas com três correções ao plano

O plano pede "CacheFirst, 30 dias, max 500 MB"
(`_plan/plano-headless-graphql.md:851`). CacheFirst está certo (áudio é
imutável — o `url` de `HymnAudioType` aponta pra um arquivo em R2 que não é
sobrescrito). Os outros dois números não sobrevivem ao contato com o storage
real. Os áudios vêm de `media.hinaria.com.br` (R2, `CLAUDE.md` seção "R2"),
**cross-origin** em relação a `app.hinaria.com.br`. Isso muda tudo:

**3.1 — `opaque response` (o problema clássico que o plano não menciona).**
Um `fetch()` cross-origin sem CORS retorna resposta opaca: `status === 0`, corpo
ilegível. Consequências práticas:

- Workbox descarta por padrão (só cacheia 200), então **sem
  `cacheableResponse: { statuses: [0, 200] }` nada é cacheado** e o "modo
  offline" simplesmente não toca áudio. (O irmão já usa exatamente esse plugin
  pros webfonts do Google — `app/vite.config.ts:40`.)
- Resposta opaca é **padded no cálculo de quota**: os navegadores contam cada
  entrada opaca com um acréscimo fixo da ordem de alguns MB. Um hinário tem
  ~250 MB de áudio (`CLAUDE.md:236`, o import do Justiceiro) distribuídos em
  ~130 arquivos; com padding isso pode consumir mais de 1 GB de quota
  contabilizada. Em iOS, onde o teto é da ordem de 1 GB por origem, isso estoura
  no primeiro hinário.
- Erro de quota em resposta opaca chega como `QuotaExceededError` genérico, sem
  dizer qual entrada — depurar é adivinhar.

**Decisão:** habilitar CORS de verdade em vez de conviver com respostas opacas.
Dois passos, ambos fora de `web/`:
1. Política de CORS no bucket R2 `hinaria-media` liberando `GET`/`HEAD` para as
   origens `https://app.hinaria.com.br` e `http://localhost:5173`, expondo
   `Accept-Ranges` e `Content-Length`.
2. `crossorigin="anonymous"` no `<audio>` — hoje ele não tem
   (`web/src/lib/components/AudioPlayer.svelte:135` usa só `src`). Sem esse
   atributo o browser abre uma requisição `no-cors` **separada** da que o SW
   cacheou, e o cache não é aproveitado.

Manter `cacheableResponse: { statuses: [0, 200] }` de todo jeito, como cinto de
segurança para o período em que o CORS ainda não estiver aplicado.

**3.2 — Range requests.** `<audio>` faz requisição `Range:` para seek (e no
Safari, até para começar a tocar). Uma entrada do Cache API responde 200 com o
corpo inteiro, o que quebra o seek e, no Safari, a reprodução. **Decisão:**
`RangeRequestsPlugin` (`workbox-range-requests`) na rota de áudio. Isto não está
no plano e é a causa mais provável de "baixei e não toca".

**3.3 — "max 500 MB" não é expressável em Workbox.** `ExpirationPlugin` tem
`maxEntries` e `maxAgeSeconds`; **não tem limite por bytes**. Decisão:

- Workbox: `ExpirationPlugin({ maxAgeSeconds: 60*60*24*30, maxEntries: 600, purgeOnQuotaError: true })`.
  `purgeOnQuotaError` é obrigatório — sem ele, quota cheia derruba o SW inteiro.
- O teto de 500 MB é responsabilidade do **app**, não do SW: a tabela `audios`
  do Dexie guarda `bytes` por áudio e o botão "Baixar pra offline" soma antes de
  baixar, recusando com mensagem PT-BR quando o hinário não cabe no orçamento
  restante. Cruzar com `navigator.storage.estimate()` para não prometer o que o
  device não tem.
- **Bloqueio de schema pra isso:** `HymnAudioType` (`schema.graphql:54-66`) não
  expõe tamanho, embora o modelo tenha `file_size`
  (`apps/hymns/models.py:376`). Sem `fileSizeBytes` no type, o cliente só
  descobre o tamanho baixando. Está nos follow-ups.

## 4. `mutationQueue` × CSRF: o token não vai pra fila

O plano não trata o caso do token expirar entre enfileirar e dar replay. Ele de
fato expira — e há um caso pior que expirar, que é rotacionar (Django emite
`csrftoken` novo em qualquer resposta com `ensure_csrf_cookie`, e o `Set-Cookie`
pode chegar enquanto a fila ainda existe).

**Decisões:**

1. **A linha da fila nunca guarda o token.** Persistir só
   `{ id, operationName, query, variables, criadoEm, tentativas }`. O token é
   lido **no momento do replay**. Isso já funciona de graça: o cliente urql
   resolve `fetchOptions` por requisição, não na criação
   (`web/src/lib/graphql/client.ts:29` chama `getCsrfTokenFromCookie()` dentro
   do callback). Reusar `buildFetchOptions` em vez de montar header à mão.
2. **Replay roda na página, não no service worker.** Dois motivos: (a) o SW não
   tem `document.cookie`, então não consegue montar `X-CSRFToken` de forma
   portável; (b) a **Background Sync API não existe no Safari nem no Firefox**, e
   iOS é justamente o alvo principal (cantar hino com o celular na mão). Ou seja:
   o "Background Sync" do plano (`_plan/plano-headless-graphql.md:857`) degrada
   para um listener de `online` + tentativa no boot do app. Chamar isso pelo
   nome certo no PR description evita a expectativa errada.
3. **403 no replay tem tratamento explícito:** `GET /graphql/` já aplica
   `ensure_csrf_cookie` (`apps/api/urls.py:17`), então o handler faz um GET para
   re-primar o cookie e repete a mutation **uma vez**. Se voltar 403/401 de
   novo, a sessão é que morreu: marcar o item como `precisa_login`, **não
   descartar**, e avisar em PT-BR ("Entre novamente para enviar N alterações
   pendentes."). Descartar silenciosamente é perder trabalho do revisor.
4. **Mutations na fila têm que ser idempotentes.** `toggleFavorite(hymnPk)`
   (`schema.graphql:209`) não é: replay duplicado (retry após timeout que na
   verdade chegou) desfaz o favorito. Decisão: a fila guarda **estado desejado**,
   não delta — enfileirar `{ tipo: 'favorito', hymnPk, desejado: true }` e
   deduplicar por `(tipo, hymnPk)` mantendo o último. Nas mutations editoriais
   (`updateHymn`, `setReviewStatus`) o último-escreve já é idempotente por
   natureza.
5. **Limite de tentativas:** backoff exponencial com teto (5 tentativas), depois
   o item vira "falhou" visível na UI. Fila que retenta pra sempre em background
   é bateria queimada sem o usuário saber.

Nota de cookie, pra Marco 7: `SESSION_COOKIE_SAMESITE = "Lax"`
(`config/settings/production.py:32`) funciona entre `app.hinaria.com.br` e
`api.hinaria.com.br` porque subdomínio do mesmo site não é cross-site, mas exige
`CSRF_COOKIE_DOMAIN`/`SESSION_COOKIE_DOMAIN` em `.hinaria.com.br` — já previsto
no Marco 2 (`_plan/plano-headless-graphql.md:135`), só não pode ser esquecido
antes do offline entrar em produção.

## 5. O que dá pra copiar do `gestao-feitio` (e o que não dá)

O plano cita o irmão como "SvelteKit + PWA offline validado". A leitura do código
mostra que ele é **local-first puro, não offline-first sincronizado**: não existe
uma única chamada de rede no `src/` dele (grep por `fetch(`, `axios`, `graphql`,
`/api/` em `app/src` e `app/tests` volta vazio). Ele é o caso fácil — sem
servidor, não há fila, não há CSRF, não há conflito. Portanto:

**Copiar (praticamente literal):**

| O que | Origem | Observação |
|---|---|---|
| Bloco `SvelteKitPWA({...})` | `app/vite.config.ts:8-46` | Manter `manifest: false` (o nosso já está em `web/static/`) e `registerType: 'autoUpdate'`. |
| `globPatterns` do precache | `app/vite.config.ts:21` | Ajustar pra incluir `woff2` das fontes self-hosted. |
| Padrão `cacheableResponse` + `expiration` em runtime caching | `app/vite.config.ts:36-42` | É o molde do cache de áudio. |
| Factory Dexie com nome injetável | `app/src/infra/persistencia/dexie-db.ts:41-60` | Padrão de isolamento por teste. |
| `liveQuery` exposto como store | `app/src/infra/persistencia/repositorio-eventos.ts:52-54` | Pro badge de fila pendente. |
| `fake-indexeddb/auto` no setup | `app/vitest.setup.ts:2` | Habilita TDD sem browser. |
| `scripts/gerar-icones.mjs` | `app/scripts/gerar-icones.mjs` | Gera 192/512/maskable a partir de SVG inline via ImageMagick. Ver "Gaps". |
| Forma do manifest | `app/static/manifest.webmanifest` | Já espelhado em `web/static/manifest.webmanifest`. |

**NÃO copiar:**

- **`navigateFallback: '/'`** (`app/vite.config.ts:23`) — só funciona porque ele
  é `adapter-static` com `fallback: 'index.html'`
  (`app/svelte.config.js:7-13`). Aqui é SSR + `adapter-cloudflare`; ver 1.
- **`orientation: 'landscape'`** (`app/static/manifest.webmanifest:7`) — ele é um
  painel de fornalha em tablet; hinário se lê em `portrait`.
- **Arquitetura de dados** — ele é event-sourcing local
  (`app/src/domain/events/tipos.ts`, log append-only em
  `app/src/infra/persistencia/repositorio-eventos.ts:42-50`) com o Dexie como
  *source of truth*. Aqui o servidor é a fonte de verdade e o Dexie é cache +
  fila. Copiar o event log seria importar complexidade que não paga.
- **Fila de sync / CSRF / conflito** — não existe lá. Tudo da seção 4 é
  território novo, sem precedente interno.
- **E2E offline** — os 9 specs em `app/tests/e2e/` não exercitam offline nem
  service worker (grep por `offline`/`serviceWorker` volta vazio). O critério de
  aceitação do Marco 6 ("E2E Playwright cobre cenário offline") é primeira vez
  nesta casa.

---

## Gaps (precisam de insumo externo, não de decisão técnica)

### Ícones PWA — não existe arte de marca no repositório

`web/static/manifest.webmanifest` foi entregue **sem a chave `icons`**, de
propósito. Motivo: não há nenhuma imagem de marca no repo. Busca por
`*.png|*.svg|*.ico|*.jpg|*.webp` só retorna screenshots de `_design/ui_v3/` e
uploads de conversa em `_design/fase2-bundle/project/uploads/` — nada que sirva
de ícone. E `web/src/app.html` já referenciava
`%sveltekit.assets%/favicon.png`, arquivo que nunca existiu (404 em toda
navegação; marcado com `TODO` no próprio `app.html`).

Declarar no manifest ícones que não existem seria pior que omitir, então ficou
omitido. **Impacto direto:** sem ícone 192+ o app não é instalável e o critério
"Lighthouse PWA ≥ 90" (`_plan/plano-headless-graphql.md:870`) **não é
alcançável**. Isto bloqueia o encerramento do Marco 6, não o começo.

Caminho já mapeado (é rápido, falta só a decisão de marca):
- `ImageMagick` está disponível na máquina (`/opt/homebrew/bin/magick`).
- `gestao-feitio/app/scripts/gerar-icones.mjs` faz exatamente isto a partir de um
  SVG inline com um glyph e a paleta do projeto, gerando `icon-192.png`,
  `icon-512.png` e `icon-maskable.png` (512 com safe zone de ~80%). Copiar pra
  `web/scripts/`, trocar as constantes de cor para `#F6EFE2` (papel) /
  `#1D3B6A` (firmamento) e o glyph para um dos ornamentos da paleta
  (`static/css/design-tokens.css:25` documenta ☀ ☾ ★ como acento gold).
- Depois: acrescentar `icons` ao manifest, criar `web/static/favicon.png` e um
  `apple-touch-icon` (Safari ignora ícone de manifest).

**Pendência de decisão humana:** qual glyph/monograma representa a Hinaria. Um
ícone gerado por agente e mergeado como se fosse identidade visual é dívida de
marca, não entrega.

### Follow-ups de schema (frente do GraphQL, fase 2)

1. **`HymnBookType.syncVersion: Int!`** — o campo existe no modelo e é
   incrementado, mas **não foi exposto** no GraphQL de propósito (outra frente
   estava reescrevendo `apps/api/**` e `schema.graphql` em paralelo). Sem ele o
   cliente offline não tem como comparar versões: é o **primeiro** item do
   Marco 6, antes de qualquer código de SW.
2. **`HymnAudioType.fileSizeBytes: Int`** — necessário pro orçamento de 500 MB
   (ver 3.3). Modelo já tem `file_size` (`apps/hymns/models.py:376`).
3. **`Query.hymnbook(slug, sinceVersion: Int)`** — o plano marca como "opcional
   MVP" (`_plan/plano-headless-graphql.md:864`). Concordo em deixar fora do MVP:
   com `sync_version` sendo comparação de igualdade, re-baixar o JSON inteiro do
   hinário custa poucos KB; o caro são os áudios, e esses são endereçados por
   URL imutável.

### `web/` está vermelho em `origin/development`

Não é gap do Marco 6, mas atrapalha qualquer frente de frontend: em
`origin/development`, `web/src/lib/graphql/operations.ts` tem
`export const CURRENT_USER_QUERY` **declarado duas vezes** (linhas 73 e 102,
blocos byte-a-byte idênticos — cara de merge ruim). Isso derruba `pnpm build`,
`pnpm check` e 14 dos 38 arquivos de teste do vitest. Removendo o bloco
duplicado localmente, a suíte vai pra 37/38 arquivos verdes (229 testes
passando) e só resta `src/lib/components/HymnBody.test.ts` (3 casos) vermelho.
Ambos os arquivos pertencem a outra frente — reportado, não corrigido aqui.
