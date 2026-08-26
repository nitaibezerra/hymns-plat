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
| Ícones PWA (monograma) + `icons` no manifest + `favicon.png` | `web/static/icone-mestre.svg`, `web/static/icons/`, seção 6 |

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

## 6. Ícones PWA: monograma tipográfico derivado do design system

**Decisão:** não esperar arte de marca. O ícone é um **monograma tipográfico**
extraído do design system que já existe — o glifo `h` da **Cormorant Garamond
600**, tinta papel sobre fundo firmamento, com um filete dourado abaixo.

Isso não é "um ícone inventado por agente": `font-display` (Cormorant Garamond) é
a face que o `CLAUDE.md:90` designa para "titles, h1/h2, **brand**, stats,
**monograms**", o peso 600 é exatamente o da brand no header
(`web/src/lib/components/Header.svelte:71-77`, `.brand { font-family:
var(--font-display); font-weight: 600 }`), e as três cores saem literais de
`static/css/design-tokens.css`: `--color-firmament: #1D3B6A`, `--color-bg:
#F6EFE2`, `--color-gold: #B8893A` (o token do ouro está documentado como
"ornamentos, ☀ ☾ ★, **underlines**" — o filete é uso canônico, não enfeite novo).

**Minúscula, não maiúscula.** O wordmark é `hinária` em caixa baixa
(`Header.svelte:29`, `Footer.svelte:13`). O `h` minúsculo herda a voz tipográfica
da marca e, de quebra, tem silhueta assimétrica (haste alta à esquerda, ombro à
direita), que é mais reconhecível em miniatura do que a simetria de um `H`.

**Glifo convertido em PATH, sem dependência de fonte.** O script de referência do
irmão (`gestao-feitio/app/scripts/gerar-icones.mjs:41`) emite
`<text font-family="Fraunces, …">` — o render varia conforme o que estiver
instalado na máquina que gerar. Aqui o contorno foi extraído uma vez com
fontTools a partir de
`web/node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff`
(upem 1000, bbox do `h`: 488.5 × 725 unidades) e está embutido como `d=` no
script. Resultado byte-idêntico em qualquer máquina, e `web/static/` deixa de
depender de `node_modules` para regenerar.

```python
# Extração do path (rodada uma vez; fontTools 4.60, use o .woff — o .woff2 exige brotli)
from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

gs = TTFont(CAMINHO_WOFF).getGlyphSet()
pen = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}")
gs["h"].draw(TransformPen(pen, Transform(1, 0, 0, -1, 0, 0)))  # y-up -> y-down
print(pen.getCommands())
```

### Fundo firmamento, não papel

As duas variantes pedidas foram geradas e comparadas em 192px e em 48px
(reamostragem do 192). **Escolhida: fundo `#1D3B6A`, tinta `#F6EFE2`.** Três
razões, em ordem de peso:

1. **A Cormorant é uma face de alto contraste.** As hastes finas do `h` medem
   ~1px em 48px. Tinta clara sobre fundo escuro ganha peso aparente por
   irradiação; tinta escura sobre papel claro *perde* — na variante papel as
   hastes finas chegam a se romper na reamostragem.
2. **Ícone de PWA cai em cima de wallpaper arbitrário.** O quadrado de papel
   `#F6EFE2` some contra tela inicial clara: o ícone fica sem borda e vira uma
   letra flutuando. O campo firmamento se define contra claro e contra escuro.
3. **O filete dourado só funciona no escuro.** `#B8893A` sobre `#1D3B6A` tem
   contraste suficiente para sobreviver como uma linha quente em 48px; sobre
   `#F6EFE2` ele é ouro-sobre-creme e desaparece antes disso.

A variante papel fica registrada no gerador (parâmetro `invertido: true`) para
quando fizer sentido — carimbo em fundo escuro, favicon monocromático, impressão.

### Geometria e tamanhos ópticos

Um mesmo SVG paramétrico, viewBox 512, com três geometrias — porque o mesmo
desenho não serve para 512px e para 16px:

| Saída | Altura do glifo | Filete | Por quê |
|---|---|---|---|
| `icons/icon-192.png`, `icons/icon-512.png` (`any`) | 52% do lado | 2.15% × 41% | Massa cheia no quadrado; o filete vira ~1px em 48px, presente sem ruído. |
| `icons/icon-maskable-512.png` (`maskable`) | 40% do lado | 1.66% × 31.5% | A composição inteira (semi-diagonal ~135px) cabe no círculo de raio 204.8px = safe zone de 80%. Verificado por overlay do círculo sobre o PNG. |
| `favicon.png` (48px), `apple-touch-icon.png` (180px) | 70% do lado | **nenhum** | Em 16px o filete vira uma linha suja sobre o azul, e o glifo precisa de toda a caixa para continuar legível como `h`. |

Peso: o maior arquivo é 8.6 KB (`icon-512.png`). `-depth 8` +
`png:color-type=2` é o que segura isso — o build Q16 do ImageMagick grava PNG de
16 bits por padrão e dobrava o peso sem ganho num ícone chapado.

### Manifest

`icons` com três entradas, `purpose` **separado** (`"any"` e `"maskable"` em
entradas distintas, nunca `"any maskable"` na mesma — um ícone `any` sem margem
seria recortado pela máscara do Android, e um `maskable` usado como `any` aparece
pequeno demais no meio de padding). `src` absoluto (`/icons/…`), coerente com
`start_url`/`scope` que já eram `/`.

O SVG mestre **não** entra no manifest de propósito: `icone-mestre.svg` é a fonte
de regeneração, e ícone SVG em manifest ainda tem suporte irregular no Android —
o critério em jogo é Lighthouse, e ele quer PNG ≥ 192.

### Script gerador

`web/scripts/` está fora do escopo desta frente, então o script não foi
versionado. O conteúdo abaixo é auto-suficiente: salvar em
`web/scripts/gerar-icones.mjs`, trocar `STATIC_DIR` por
`resolve(__dirname, "..", "static")` e adicionar `"gerar-icones": "node
scripts/gerar-icones.mjs"` aos scripts do `web/package.json`.

```js
#!/usr/bin/env node
/**
 * Gera os ícones PWA da Hinária a partir de um monograma tipográfico.
 *
 * O glifo "h" (Cormorant Garamond 600, o mesmo peso da brand no Header) já vem
 * CONVERTIDO EM PATH — não há dependência de fonte instalada, então o render é
 * idêntico em qualquer máquina. Ver `_plan/marco6-decisoes.md` para como o path
 * foi extraído e por que a variante escolhida é tinta-papel sobre firmamento.
 *
 * Requer ImageMagick (`magick`) com delegate RSVG. Saída em `web/static/`:
 *   - icone-mestre.svg          (mestre vetorial, variante "any")
 *   - icons/icon-192.png        (192×192, purpose "any")
 *   - icons/icon-512.png        (512×512, purpose "any")
 *   - icons/icon-maskable-512.png (512×512, safe zone 80%, purpose "maskable")
 *   - favicon.png               (48×48, glifo maior e sem filete — tamanho óptico)
 *   - apple-touch-icon.png      (180×180, iOS ignora ícone de manifest)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Ajustar se o script for versionado em `web/scripts/`: resolve(__dirname, "..", "static")
const STATIC_DIR = process.env.HINARIA_STATIC_DIR ?? resolve(__dirname, "static");
const MAGICK = process.env.MAGICK_BIN ?? "/opt/homebrew/bin/magick";

/* Paleta canônica — `static/css/design-tokens.css`. */
const FIRMAMENTO = "#1D3B6A";
const PAPEL = "#F6EFE2";
const OURO = "#B8893A";

const C = 512; // lado do viewBox

/* Monograma "h" da Cormorant Garamond 600, contorno em coordenadas de fonte
   (upem 1000) já com o Y invertido para o sistema do SVG. bbox: x 1.5…490,
   y -725…0 — ou seja 488.5 × 725 unidades. */
const GLIFO_H =
  "M23.0 0.0Q20.0 0.0 20.0 -6.0Q20.0 -12.0 23.0 -12.0Q56.0 -12.0 68.0 -26.0Q80.0 -40.0 80.0 -81.0V-592.0Q80.0 -627.0 73.5 -642.5Q67.0 -658.0 50.0 -658.0Q35.0 -658.0 9.0 -646.0Q6.0 -645.0 3.0 -650.5Q0.0 -656.0 3.0 -658.0L142.0 -724.0Q144.0 -725.0 145.0 -725.0H146.0Q151.0 -725.0 155.5 -721.0Q160.0 -717.0 160.0 -714.0V-315.0Q188.0 -348.0 219.0 -368.0Q263.0 -397.0 313.0 -397.0Q368.0 -397.0 398.5 -363.5Q429.0 -330.0 429.0 -274.0V-81.0Q429.0 -40.0 440.5 -26.0Q452.0 -12.0 486.0 -12.0Q490.0 -12.0 490.0 -6.0Q490.0 0.0 486.0 0.0Q467.0 0.0 442.5 -1.0Q418.0 -2.0 389.0 -2.0Q361.0 -2.0 336.0 -1.0Q311.0 0.0 292.0 0.0Q289.0 0.0 289.0 -6.0Q289.0 -12.0 292.0 -12.0Q325.0 -12.0 337.0 -26.0Q349.0 -40.0 349.0 -81.0V-230.0Q349.0 -340.0 263.0 -340.0Q231.0 -340.0 197.0 -322.0Q176.0 -311.0 160.0 -295.0V-81.0Q160.0 -40.0 171.5 -26.0Q183.0 -12.0 217.0 -12.0Q221.0 -12.0 221.0 -6.0Q221.0 0.0 217.0 0.0Q198.0 0.0 173.5 -1.0Q149.0 -2.0 120.0 -2.0Q92.0 -2.0 67.0 -1.0Q42.0 0.0 23.0 0.0Z";
const GLIFO_X0 = 1.5;
const GLIFO_LARG = 488.5;
const GLIFO_ALT = 725;

const n = (v) => Number(v.toFixed(2));

/**
 * Monta o SVG do ícone.
 *
 * @param {object} o
 * @param {number} o.alturaGlifo fração do lado ocupada pela altura do "h"
 * @param {number} o.filete      espessura do filete dourado em frações do lado (0 = sem filete)
 * @param {number} o.fileteLarg  largura do filete em frações do lado
 * @param {number} o.vao         respiro entre a base do "h" e o filete, em frações do lado
 * @param {boolean} o.invertido  true = papel de fundo, tinta firmamento
 */
function svgIcone({
  alturaGlifo,
  filete = 0.0215,
  fileteLarg = 0.41,
  vao = 0.05,
  invertido = false,
}) {
  const fundo = invertido ? PAPEL : FIRMAMENTO;
  const tinta = invertido ? FIRMAMENTO : PAPEL;

  const hGlifo = alturaGlifo * C;
  const escala = hGlifo / GLIFO_ALT;
  const wGlifo = GLIFO_LARG * escala;

  const espFilete = filete * C;
  const wFilete = fileteLarg * C;
  const vaoPx = filete > 0 ? vao * C : 0;

  const alturaTotal = hGlifo + vaoPx + espFilete;
  const topo = (C - alturaTotal) / 2;

  // Glifo: leva a bbox para (X, topo). translate compensa x0 e a baseline.
  const tx = (C - wGlifo) / 2 - GLIFO_X0 * escala;
  const ty = topo + hGlifo;

  const fileteSvg =
    filete > 0
      ? `\n  <rect x="${n((C - wFilete) / 2)}" y="${n(topo + hGlifo + vaoPx)}" ` +
        `width="${n(wFilete)}" height="${n(espFilete)}" fill="${OURO}"/>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${C}" height="${C}" viewBox="0 0 ${C} ${C}" role="img" aria-label="Hinária">
  <title>Hinária</title>
  <rect width="${C}" height="${C}" fill="${fundo}"/>
  <path transform="translate(${n(tx)} ${n(ty)}) scale(${n(escala)})" d="${GLIFO_H}" fill="${tinta}"/>${fileteSvg}
</svg>
`;
}

/* Geometrias. "any" ocupa 52% do lado; "maskable" encolhe para 40% e estreita o
   filete, de forma que a composição inteira caiba no círculo de raio 40% do
   lado (safe zone de 80%). O favicon usa o glifo maior e abre mão do filete: em
   16px o ouro sobre azul vira uma linha suja. */
const GEO_ANY = { alturaGlifo: 0.52 };
const GEO_MASKABLE = { alturaGlifo: 0.4, filete: 0.0166, fileteLarg: 0.315, vao: 0.039 };
const GEO_FAVICON = { alturaGlifo: 0.7, filete: 0 };

function png(svg, destino, tamanho) {
  const svgTmp = resolve(STATIC_DIR, `.tmp-${tamanho}-${Date.now()}.svg`);
  writeFileSync(svgTmp, svg);
  execFileSync(MAGICK, [
    "-background", "none",
    "-density", "600",
    svgTmp,
    "-resize", `${tamanho}x${tamanho}`,
    "-strip",
    // 8 bits e truecolor sem alpha: o build Q16 do ImageMagick grava PNG de
    // 16 bits por padrão, o que dobra o peso sem ganho nenhum num ícone chapado.
    "-depth", "8",
    "-define", "png:color-type=2",
    resolve(STATIC_DIR, destino),
  ]);
  execFileSync("/bin/rm", ["-f", svgTmp]);
  console.log(`  ok  ${destino} (${tamanho}px)`);
}

mkdirSync(resolve(STATIC_DIR, "icons"), { recursive: true });

const mestre = svgIcone(GEO_ANY);
writeFileSync(resolve(STATIC_DIR, "icone-mestre.svg"), mestre);
console.log("  ok  icone-mestre.svg");

png(mestre, "icons/icon-192.png", 192);
png(mestre, "icons/icon-512.png", 512);
png(svgIcone(GEO_MASKABLE), "icons/icon-maskable-512.png", 512);
png(svgIcone(GEO_FAVICON), "favicon.png", 48);
png(svgIcone(GEO_FAVICON), "apple-touch-icon.png", 180);

console.log("Pronto.");
```

---

## Gaps (precisam de insumo externo, não de decisão técnica)

### ~~Ícones PWA~~ — RESOLVIDO (não é mais bloqueador)

Este gap deixou de existir. A hipótese em que ele se apoiava — "sem arte de marca
não há ícone" — estava errada: a marca **já existe no repositório**, na forma do
design system (Cormorant Garamond 600 + paleta "Luz do Firmamento"), e um
monograma tipográfico derivado dela é identidade visual do projeto, não invenção
de agente. A decisão e a justificativa estão na seção 6.

Entregue em `web/static/`: `icone-mestre.svg` (mestre vetorial),
`icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`
(safe zone de 80% conferida), `favicon.png` (48px — o arquivo que o `app.html`
referenciava e que dava 404 em toda navegação) e `apple-touch-icon.png` (180px).
Manifest com `icons` válido, `purpose` `any`/`maskable` em entradas separadas.
Maior arquivo: 8.6 KB.

**Consequência para o critério de aceitação:** "Lighthouse PWA ≥ 90"
(`_plan/plano-headless-graphql.md:870`) volta a ser alcançável — o app é
instalável. O que resta do Marco 6 é service worker + offline, não marca.

Duas pendências pequenas, **em arquivos de outra frente** (`web/src/app.html`,
que esta frente não pode tocar):

1. O comentário `TODO(Marco 6)` no topo do `app.html` está obsoleto —
   `favicon.png` e os ícones do manifest agora existem. Remover.
2. Falta `<link rel="apple-touch-icon" href="%sveltekit.assets%/apple-touch-icon.png" />`.
   O arquivo já está em `web/static/`, e o iOS o encontra por convenção em
   `/apple-touch-icon.png` mesmo sem a tag; a tag só torna explícito.

Não pendente, mas registrado: se um dia entrar arte de marca de verdade, o
gerador na seção 6 é o único ponto a mexer — trocar o `d=` do path pelo desenho
novo e rodar de novo.

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
