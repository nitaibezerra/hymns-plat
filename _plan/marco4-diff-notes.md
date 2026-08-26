# Marco 4.I — Notas de diferenças visuais Django ↔ SvelteKit

> Última atualização: 2026-08-26 (Frente 2 — a suíte passou a comparar de
> verdade; ver "Execução de 2026-08-26 — Frente 2" no fim)

Este documento registra **o que foi testado**, **o que foi medido**, **o que
ficou pendente e por quê** e **quais diferenças são intencionais/aceitas**
entre o monolito Django e o shell SvelteKit.

A suíte vive em [`web/tests/e2e/visual-parity.spec.ts`](../web/tests/e2e/visual-parity.spec.ts),
apoiada nos helpers de [`web/tests/e2e/_helpers/`](../web/tests/e2e/_helpers/),
e roda quando `HINARIA_E2E_PLAYWRIGHT_READY=1` está setado (o script
`pnpm test:e2e:parity` já seta).

## Como a comparação funciona (mecânica nova)

Pra cada rota, na **mesma corrida e no mesmo browser**:

1. Captura a rota no Django e, em seguida, a rota equivalente no SvelteKit —
   mesmo viewport (1280×720), mesmo tema, animações congeladas,
   `prefers-reduced-motion: reduce`, mesmas máscaras.
2. Confere que os **dois** lados renderizaram conteúdo real: status HTTP < 400,
   ausência do estado de erro do shell (`data-testid="error"`) e equilíbrio de
   densidade de conteúdo entre os dois lados.
3. Compara pixel a pixel com `pixelmatch` e falha se o diff passar do
   threshold, **emitindo o percentual medido** (passando ou falhando).

**Não existe baseline em disco.** As duas capturas nascem e morrem na corrida.
Artefatos de inspeção (as duas capturas + o PNG de diff, por rota) vão pra
`web/test-results/visual-parity/`, coberto por `web/.gitignore` — nada disso é
commitado, e não foi preciso criar entrada nova no `.gitignore`.

| Peça | Arquivo | Responsabilidade |
|---|---|---|
| Comparador | `_helpers/image-diff.ts` | `diffPngBuffers` (pixels/ratio/PNG de diff), `inkRatio`, `contentBalance`, `formatRatio` |
| Assertiva | `_helpers/parity-report.ts` | threshold, artefatos, mensagem de falha, `formatParityLine` |
| Captura | `_helpers/capture.ts` | viewport, tema, reduced-motion, freeze de animação, máscaras, `hide`, status+HTML |
| Guarda | `_helpers/render-guard.ts` | detecta estado de erro no HTML |
| Auth | `_helpers/auth-fixture.ts` | login programático → `storageState` |
| Orquestração | `web/scripts/dev-fullstack.sh` | sobe Django + SvelteKit, portas configuráveis |

Os helpers têm **36 testes próprios** (PNGs sintéticos de diff conhecido,
páginas HTML servidas por `page.route()`), que rodam sem servidor nenhum:
`pnpm test:e2e:helpers`. Eles são o antídoto contra a regressão do 4.I: provam
que o comparador mede, que a máscara neutraliza timestamp, que o `hide` remove
overlay, e que a assertiva falha com o número na mensagem.

### Auto-verificação da suíte

`HINARIA_E2E_SELF_COMPARE=1` aplica as máscaras e os `hide` do Django aos dois
lados. Aponte as duas bases pro mesmo app e o diff **tem** que cair no chão de
ruído:

```bash
HINARIA_E2E_SELF_COMPARE=1 \
  HINARIA_DJANGO_BASE_URL=http://localhost:9010 \
  HINARIA_SVELTE_BASE_URL=http://localhost:9010 \
  pnpm test:e2e:parity
```

Medido em 2026-08-26: **0,00% nas 11 rotas** (chão de ruído zero, determinístico).

## Como rodar (medição real)

```bash
cd web
./scripts/dev-fullstack.sh                    # Django :9000 + SvelteKit :5173
HINARIA_E2E_USERNAME=<superuser> HINARIA_E2E_PASSWORD=<senha> \
  pnpm test:e2e:parity
./scripts/dev-fullstack.sh down
```

Com outra frente ocupando as portas default (comum: seis worktrees em
paralelo), escolha as suas — o script aborta em vez de sequestrar o servidor
alheio:

```bash
DJANGO_PORT=9010 SVELTE_PORT=5183 ./scripts/dev-fullstack.sh
HINARIA_DJANGO_BASE_URL=http://localhost:9010 \
  HINARIA_SVELTE_BASE_URL=http://localhost:5183 \
  HINARIA_E2E_USERNAME=<superuser> HINARIA_E2E_PASSWORD=<senha> \
  pnpm test:e2e:parity
```

Credencial vem de env — nenhuma senha hardcoded no repo. A de dev está no
`CLAUDE.md` ("Admin login (dev)").

## Rotas cobertas (11)

| # | ID | Path (idêntico nos dois lados) | Notas |
|---|---|---|---|
| 1 | `home` | `/` | público |
| 2 | `hinarios-list` | `/hinarios/` | público |
| 3 | `hymnbook-indice` | `/hinarios/<slug>/?mode=indice` | público |
| 4 | `hymnbook-corrido` | `/hinarios/<slug>/?mode=corrido` | público |
| 5 | `hymnbook-carrossel` | `/hinarios/<slug>/?mode=carrossel` | público (chrome fixo do "Reader Focus") |
| 6 | `hymn-detail` | `/hinos/<uuid>/` | pk **descoberto na hora** no índice do Django |
| 7 | `busca` | `/busca/?q=<q>` | rotas idênticas em ambos |
| 8 | `profile` | `/perfil/<username>/` | público |
| 9 | `profile-followers` | `/perfil/<username>/seguidores/` | público |
| 10 | `profile-following` | `/perfil/<username>/seguindo/` | público |
| 11 | `notifications` | `/notificacoes/` | **requer auth — fixture implementada, rota não é mais pulada** |

## Slugs/usuários de teste (Postgres dev local)

```
HymnBooks publicados: o-justiceiro, o-cruzeiro, selecao-ingrid, viagem
Slug default da suíte: o-justiceiro       (env HINARIA_E2E_HYMNBOOK_SLUG)
pk de hino:            descoberto na hora (env HINARIA_E2E_HYMN_PK sobrescreve)
Username default:      nitaibezerra       (env HINARIA_E2E_USERNAME)
Search query default:  "luz"              (env HINARIA_E2E_SEARCH_QUERY)
Login programático:    /django-admin/login/ (env HINARIA_E2E_LOGIN_PATH)
```

> `HINARIA_E2E_HYMN_PK` não tem mais default inválido. `Hymn.id` é UUID nos
> dois lados (`<uuid:pk>` no `apps/hymns/urls.py`), e o default `"1"` do 4.I
> não existia no Postgres dev — a rota ficava fora da medição. Agora a suíte lê
> o primeiro link `/hinos/<uuid>/` do índice do hinário no Django. Medido:
> resolveu `04339b04-a771-40b4-b6aa-aa4e3aaa8c27`.

## Threshold e tolerâncias

- **Threshold:** `DEFAULT_MAX_DIFF_RATIO = 0.05` (5%) em
  `_helpers/parity-report.ts`. Saiu do `playwright.config.ts`: o
  `expect.toHaveScreenshot` de lá só valeria pra comparação contra baseline em
  disco, que é justamente o que a suíte não faz mais.
- **Anti-alias:** `includeAA: false` (default do pixelmatch) mantém a detecção
  de anti-aliasing ativa — pixels de borda anti-aliasada não entram na
  contagem. Cobre Tailwind Play CDN (Django) vs build do Tailwind 4 (SvelteKit).
- **Sub-pixel de fonte:** `pixelThreshold = 0.15` (distância de cor por pixel)
  absorve a diferença entre fonte self-hosted (`@fontsource/*`) e Google Fonts.
- **Equilíbrio de conteúdo:** `MIN_CONTENT_BALANCE = 0.5`. Ver "falso verde"
  abaixo.
- **Overrides por rota:** `maxDiffPixelRatio` no `RouteCase`. Nenhum em uso
  hoje (não houve diferença de design classificada — ver abaixo).

### Máscaras (regiões voláteis)

Aplicadas nas duas capturas; seletor ausente na página não quebra nada.

| Lado | Seletores | Motivo |
|---|---|---|
| Django | `p:has-text("Membro há")`, `p:has-text("atrás")`, `span:has-text("atrás")` | tempo relativo renderizado no servidor com `|timesince` |
| SvelteKit | `.meta` | mesmo dado, formatado no cliente como ISO curto |

Congelar o relógio do browser **não** resolveria esse caso: um dos lados
calcula o texto no servidor. Mascarar resolve.

### `hide` (chrome que existe só num lado)

| Lado | Seletor | Motivo |
|---|---|---|
| Django | `#djDebug` | `django-debug-toolbar` do dev server: painel fixo, aberto, cobrindo ~220px da direita — **15,90% da viewport**. Não existe no shell. |

Mascarar não resolveria (a máscara viraria diff contra o lado sem painel);
esconder faz a página renderizar como renderizaria sem ele.

## Diferenças aceitas (intencionais)

> **Lista ainda vazia, e por um motivo honesto:** nenhuma rota chegou a ser
> comparada com dado real nos dois lados, porque o SSR do SvelteKit não
> consegue falar com o GraphQL (bloqueador **CSRF** abaixo). Não há nenhuma
> diferença *de design* classificada. Preencher quando o bloqueador cair.

Slot template pra registrar quando aparecer:

```markdown
### `<route-id>` — diferença aceita (threshold elevado pra X%)

- **Observação:** <descrição textual + caminho do PNG de diff>
- **Razão:** <ex.: chrome do player só existe no shell>
- **Decisão:** aceitar, threshold `maxDiffPixelRatio: 0.X`.
- **Reverter quando:** <condição pra equiparar>
```

## Bloqueadores / follow-ups

1. ~~**`visual-parity.spec.ts` não compara Django com SvelteKit.**~~
   **RESOLVIDO** nesta frente. A suíte era snapshot-file-based
   (`toMatchSnapshot`), gravava o PNG do próprio SvelteKit como baseline e
   comparava SvelteKit contra SvelteKit — 0% de diff pra sempre. Agora compara
   as duas capturas ao vivo. Auto-verificação: `HINARIA_E2E_SELF_COMPARE=1`.
2. ~~**Auth não automatizada.**~~ **RESOLVIDO.** `_helpers/auth-fixture.ts`
   loga via `/django-admin/login/` e devolve `storageState`; `/notificacoes/`
   entrou na tabela. Detalhe que custou uma tentativa: o `/accounts/login/` do
   allauth **só** oferece "Continuar com Google" neste projeto — não há campo
   de senha pra postar. E a mutation `login` do GraphQL é `POST /graphql/`,
   logo depende do próprio bloqueador de CSRF; usá-la amarraria a fixture ao
   bloqueador. O login do django-admin não depende de nada disso.
3. ~~**`HINARIA_E2E_HYMN_PK` default inválido.**~~ **RESOLVIDO** — pk
   descoberto na hora.
4. ~~**Baselines PNG na máquina.**~~ **SEM SENTIDO AGORA** — não existe
   baseline. As duas capturas nascem na mesma corrida, na mesma máquina, no
   mesmo browser; renderização de fonte entre arquiteturas deixou de ser
   problema.
5. **`POST /graphql/` responde 403 pro SSR — BLOQUEADOR ATIVO.** É o que
   impede a medição. Está sendo tratado por outra frente, em paralelo, e a
   correção não está nesta branch. Detalhe na execução abaixo.
6. **CI ainda não orquestra Django + SvelteKit.** A suíte fica em SKIP por
   default. Follow-up com pré-requisitos em ordem: (1) bloqueador 5 resolvido;
   (2) fixture de seed versionada com slug/username fixos (o pk já se resolve
   sozinho); (3) job com Postgres/Redis efêmeros. Desenho proposto no fim
   desta nota. **Não incluso nesta frente** — `.github/**` fora do escopo.
7. **`VITE_GRAPHQL_URL` não tem default coerente com o dev.**
   `src/lib/config.ts` cai em `http://localhost:8000/graphql/`, e o
   `dev-fullstack.sh` sobe o Django em `:9000` — sem env, o shell conversava
   com o que estivesse na `:8000`. O script agora exporta a env correta, mas o
   default do `config.ts` continua enganoso pra quem sobe as coisas à mão
   (`src/**` fora do escopo desta frente).
8. **Máscara de timestamp no Django é uma aproximação por texto.** Sem um hook
   estável (`data-parity-volatile`) nos templates, a máscara casa por
   `:has-text("atrás")` e pega o `<p>` inteiro. Cobre mais área do que o
   estritamente volátil. Um atributo nos templates seria mais preciso —
   `templates/**` fora do escopo desta frente.

## Histórico de execuções

| Data | Branch | Rotas medidas | Diff ≤ 5% | Notas |
|---|---|---|---|---|
| 2026-06-16 | (sub-marco 4.I) | 0 (infra criada) | n/a | smoke inicial; pipeline pronto |
| 2026-08-26 | `fix/headless-web-build-4i` | 0 de 11 | n/a | "10 de 10 falharam por snapshot ausente"; a suíte não comparava Django com SvelteKit |
| 2026-08-26 | `fix/headless-visual-parity-real` | **0 de 11 com dado real** · 11 de 11 em auto-comparação | auto-comparação: **11/11 a 0,00%** | mecânica corrigida e verificada; medição real **pendente do fix de CSRF** |

## Execução de 2026-08-26 — Frente 2

Ambiente: macOS arm64, Chromium do Playwright 1.60, viewport 1280×720, Django
`config.settings.local` em `:9010` (repo principal, branch `development`),
SvelteKit dev em `:5183` (worktree `fix/headless-visual-parity-real`,
`VITE_GRAPHQL_URL=http://localhost:9010/graphql/`), Postgres dev com dados
reais, `HINARIA_E2E_HYMNBOOK_SLUG=o-justiceiro`, sessão autenticada via
fixture. Portas fora do default porque `:9000` e `:8000` estavam ocupadas por
outras frentes.

### O que foi medido de verdade

**Auto-comparação (as duas bases apontando pro Django):**
11 de 11 rotas com **0,00% de diff** — 0 pixels divergentes em 921.600, nas
11. Isso é o que prova que a mecânica compara duas capturas ao vivo e que a
captura é determinística (mesmo tema, animações congeladas, timestamp
mascarado, debug toolbar escondido). A suíte antiga passaria "verde" nesse
mesmo teste sem comparar nada — a diferença é que agora o número vem de
`pixelmatch` sobre dois PNGs capturados na corrida.

**Chão de ruído, antes e depois de esconder o `django-debug-toolbar`:**

| Rota | Antes (`hide` ausente) | Depois |
|---|---|---|
| `home` | 0,02% | 0,00% |
| `hinarios-list` | 0,04% | 0,00% |
| `hymnbook-indice` | 0,05% | 0,00% |
| `hymnbook-corrido` | 0,02% | 0,00% |
| `hymnbook-carrossel` | 0,02% | 0,00% |
| `hymn-detail` | 0,04% | 0,00% |
| `busca` | 0,02% | 0,00% |
| `profile` | **1,52%** | 0,00% |
| `profile-followers` | 0,04% | 0,00% |
| `profile-following` | 0,02% | 0,00% |

O 1,52% do `profile` era o texto "CPU: 16.47ms (43.91ms)" do painel do debug
toolbar, que muda a cada request. E o painel inteiro vale **15,90%** dos
pixels da viewport — medido ao comparar um lado com `hide` e o outro sem.

### Medição real Django ↔ SvelteKit: PENDENTE

**0 de 11 rotas mediram.** Todas foram recusadas pelas guardas, com o motivo
explícito no output:

| Rota | Recusa | Motivo |
|---|---|---|
| `home` | estado de erro | `Falha ao carregar stats: HTTP 403` |
| `hinarios-list` | estado de erro | `Falha ao carregar hinários: HTTP 403` |
| `hymnbook-indice` | estado de erro | `Falha ao carregar hinário: HTTP 403` |
| `hymnbook-corrido` | estado de erro | `Falha ao carregar hinário: HTTP 403` |
| `hymnbook-carrossel` | estado de erro | `Falha ao carregar hinário: HTTP 403` |
| `hymn-detail` | estado de erro | `Falha ao carregar hino: HTTP 403` |
| `busca` | densidade de conteúdo | Django 6,14% de tinta vs 1,19% do shell (equilíbrio 19,42%) |
| `profile` | estado de erro | `Falha ao carregar o perfil: HTTP 403` |
| `profile-followers` | estado de erro | `Falha ao carregar seguidores: HTTP 403` |
| `profile-following` | estado de erro | `Falha ao carregar lista: HTTP 403` |
| `notifications` | estado de erro | `Falha ao carregar notificações: HTTP 403` |

**Não forcei nenhum número.** Um percentual medido entre a página de erro do
shell e a página real do Django não é paridade de design — a nota anterior
registrou sete desses (0,17 a 0,67) com o aviso de que não valiam; agora a
suíte simplesmente se recusa a produzi-los.

**Quando o fix de CSRF entrar, medir é só rodar** o comando da seção "Como
rodar". Nenhuma mudança de código é necessária.

### Bloqueador ativo — `POST /graphql/` responde 403 pro SSR

Toda load function do shell recebe 403 do Django. Causa (verificada na nota
anterior e reconfirmada agora): `apps/api/urls.py` embrulha o `GraphQLView` em
`ensure_csrf_cookie` com o middleware de CSRF ativo, então `POST /graphql/`
exige cookie `csrftoken` + header `X-CSRFToken`; o SSR roda em Node, sem cookie
jar. Fora do escopo desta frente (`apps/**` e `config/**` intocáveis aqui) e já
em correção por outra frente.

Achado adicional desta frente, que valia a mesma investigação: antes de chegar
no 403, o SSR quebrava com **erro de CORS**, porque `VITE_GRAPHQL_URL` não
estava setado e o shell falava com a `:8000` em vez do Django da comparação.
Corrigido no `dev-fullstack.sh` (bloqueador 7 acima). Quem for testar o fix de
CSRF precisa dessa env certa, senão vai depurar o sintoma errado.

### Dois falsos verdes que a medição real revelou

Valem registro porque uma suíte de paridade que os deixa passar é pior que
suíte nenhuma:

1. **Página vazia dos dois lados bate em pixels.** `/busca/?q=luz` deu **1,74%
   de diff — dentro do threshold de 5%** — com o Django listando 50 resultados
   e o shell dizendo "Nenhum resultado para 'luz'". A load do `/busca/` engole
   o 403 e cai num estado de "sem resultados", que não tem
   `data-testid="error"`; as duas páginas ficam majoritariamente fundo creme e
   o threshold de pixel passa. Corrigido com `contentBalance`: a suíte compara
   a densidade de conteúdo dos dois lados e recusa medir com equilíbrio < 50%.
2. **Chrome de dev entrando na conta.** O `django-debug-toolbar` valia 15,90%
   dos pixels. Numa suíte com threshold de 5%, isso reprova toda rota pra
   sempre por um motivo que não é design — ou, pior, mascara diferenças reais
   dentro do painel.

### Job de Playwright no CI — segue recusado por ora

Com o bloqueador de CSRF ativo, o job falharia 100% das vezes. Desenho pra
quando cair (inalterado em relação à nota anterior, menos o item de baseline,
que deixou de existir):

```yaml
playwright:
  name: Web E2E & Visual Parity
  runs-on: ubuntu-latest
  services:
    postgres:   # 16, healthcheck pg_isready
    redis:      # 7
  steps:
    - uv sync && manage.py migrate
    - manage.py loaddata <fixture determinística>   # <- falta criar
    - manage.py runserver 9000 --noreload &
    - pnpm install --frozen-lockfile && pnpm build
    - VITE_GRAPHQL_URL=http://localhost:9000/graphql/ pnpm preview --port 5173 &
    - pnpm exec playwright install --with-deps chromium
    - pnpm test:e2e:parity        # já seta HINARIA_E2E_PLAYWRIGHT_READY=1
```

Pré-requisitos que faltam, em ordem: (1) bloqueador de CSRF resolvido;
(2) fixture de seed versionada com slug e username fixos; (3) usuário de teste
com senha conhecida pra `HINARIA_E2E_PASSWORD` (secret do runner).
