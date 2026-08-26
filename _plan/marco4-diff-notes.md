# Marco 4.I — Notas de diferenças visuais Django ↔ SvelteKit

> Última atualização: 2026-08-26 (primeira execução real da suíte —
> ver "Histórico de execuções" e "Execução de 2026-08-26" no fim)

Este documento registra **o que foi testado**, **o que passou dentro do
threshold (5%)** e **quais diferenças são intencionais/aceitas** entre o
monolito Django (`localhost:9000`) e o shell SvelteKit
(`localhost:5173`).

A suíte vive em [`web/tests/e2e/visual-parity.spec.ts`](../web/tests/e2e/visual-parity.spec.ts)
e roda quando `HINARIA_E2E_PLAYWRIGHT_READY=1` está setado. Sobe ambos os
servidores via [`web/scripts/dev-fullstack.sh`](../web/scripts/dev-fullstack.sh).

## Como rodar (smoke local)

```bash
cd web
./scripts/dev-fullstack.sh   # sobe Django :9000 + SvelteKit :5173
HINARIA_E2E_PLAYWRIGHT_READY=1 pnpm exec playwright test --project=chromium
./scripts/dev-fullstack.sh down
```

Para regenerar baselines após mudança intencional de design:

```bash
HINARIA_E2E_PLAYWRIGHT_READY=1 pnpm exec playwright test \
  --project=chromium --update-snapshots
```

## Rotas cobertas (11)

| # | ID                  | Django                                     | SvelteKit                                  | Notas |
|---|---------------------|--------------------------------------------|--------------------------------------------|-------|
| 1 | `home`              | `/`                                        | `/`                                        | público |
| 2 | `hinarios-list`     | `/hinarios/`                               | `/hinarios/`                               | público |
| 3 | `hymnbook-indice`   | `/hinarios/<slug>/?mode=indice`            | mesmo                                      | público |
| 4 | `hymnbook-corrido`  | `/hinarios/<slug>/?mode=corrido`           | mesmo                                      | público |
| 5 | `hymnbook-carrossel`| `/hinarios/<slug>/?mode=carrossel`         | mesmo                                      | público (chrome fixo do "Reader Focus") |
| 6 | `hymn-detail`       | `/hinos/<pk>/`                             | mesmo                                      | público |
| 7 | `busca`             | `/busca/?q=<q>`                            | `/busca/?q=<q>`                            | rotas idênticas em ambos (confirmado em `web/src/routes/busca/`) |
| 8 | `profile`           | `/perfil/<username>/`                      | mesmo                                      | público |
| 9 | `profile-followers` | `/perfil/<username>/seguidores/`           | mesmo                                      | público |
| 10| `profile-following` | `/perfil/<username>/seguindo/`             | mesmo                                      | público |
| 11| `notifications`     | `/notificacoes/`                           | mesmo                                      | **requer auth — pulado neste sub-marco; ver follow-up abaixo** |

> **Correção sobre o plano original:** a tabela do prompt sugeria que o
> Django usa `/busca/` mas o SvelteKit `/buscar/`. Verificação em
> `web/src/routes/busca/` confirma que **ambos usam `/busca/`** — não há
> diferença de rota.

## Slugs/usuários de teste (Postgres dev local)

```
HymnBooks publicados: screenshots-fase2x, crud-shot, o-cruzeiro,
                       o-justiceiro, selecao-ingrid, viagem
Slug default da suíte: o-justiceiro       (env HINARIA_E2E_HYMNBOOK_SLUG)
pk default de hino:    "1"                 (env HINARIA_E2E_HYMN_PK)
Username default:      nitaibezerra        (env HINARIA_E2E_USERNAME)
Search query default:  "luz"               (env HINARIA_E2E_SEARCH_QUERY)
```

> ⚠️ **Cuidado com `HYMN_PK`:** no Postgres dev atual o `Hymn.id` é UUID
> (`ec0a1633-fd41-4999-ad41-e239563bb3f4`), não inteiro. A rota
> `/hinos/<pk>/` aceita o UUID no Django; no SvelteKit precisa
> confirmar a tipagem do `[pk]` em `web/src/routes/hinos/[pk]/`. Se for
> obrigatório passar UUID, setar `HINARIA_E2E_HYMN_PK=<uuid>` antes da
> suíte.

## Threshold

- **Default:** `maxDiffPixelRatio: 0.05` (5%) — configurado em
  `playwright.config.ts > expect.toHaveScreenshot`. Aceito como tolerável
  pra diferenças de:
  - Anti-alias entre Tailwind Play CDN (Django) e Tailwind 4 build
    (SvelteKit).
  - Sub-pixel rendering de fontes self-hosted vs Google Fonts CDN.
  - Renders aleatórios de timestamps "criado há X minutos" (futuro:
    mockar `Date.now()`).
- **Overrides por rota:** registrar aqui se uma rota subir o threshold.
  Inicialmente: nenhuma.

## Diferenças aceitas (intencionais)

> Lista ainda vazia. A execução de 2026-08-26 não produziu nenhuma
> diferença *de design* pra classificar: os dois bloqueadores estruturais
> (ver "Execução de 2026-08-26") impedem qualquer comparação
> significativa. Preencher quando eles caírem.

Slot template pra registrar quando aparecer:

```markdown
### `<route-id>` — diferença aceita (threshold elevado pra X%)

- **Observação:** <screenshot side-by-side ou descrição textual>
- **Razão:** <ex.: dark-mode default difere; Django persiste em
  localStorage enquanto SvelteKit usa prefers-color-scheme>
- **Decisão:** aceitar, threshold `maxDiffPixelRatio: 0.X`.
- **Reverter quando:** <condição pra equiparar>
```

## Bloqueadores / follow-ups conhecidos

1. **Auth não automatizada na suíte E2E.** Rota `/notificacoes/` exige
   sessão; pulada via `test.skip(route.requiresAuth, ...)`. Próximos
   passos:
   - Adicionar fixture de login Django (gerar cookie session via
     `force_login` numa rota helper) — só em dev/test settings.
   - Replicar cookie no contexto Playwright via `storageState`.
   - Reativar a rota removendo o `skip`.
2. **CI ainda não orquestra Django + SvelteKit.** A suíte fica em SKIP
   por default (`HINARIA_E2E_PLAYWRIGHT_READY=1` ativa). Follow-up:
   adicionar job em `.github/workflows/ci.yml` que sobe Postgres
   ephemeral + migrações + load fixtures + ambos os servidores. **Não
   incluso neste sub-marco — segue como item separado.**
3. **Baselines não comitadas — decidido em 2026-08-26: seguem fora do
   repo.** A execução real confirmou que os PNGs são específicos da
   máquina (renderização de fonte macOS arm64) e nunca casariam com o
   runner do CI. A saída correta é gerar Django e SvelteKit na *mesma*
   corrida e comparar um contra o outro, sem baseline persistida — o que
   depende do bloqueador **A** abaixo.
4. **`visual-parity.spec.ts` não compara Django com SvelteKit.** Ver
   "Bloqueador A" na seção de execução — a suíte é snapshot-file-based e
   compara SvelteKit contra si mesmo.
5. **`POST /graphql/` responde 403 pro SSR.** Ver "Bloqueador B". Sem
   isso, nenhuma rota do SvelteKit tem dado real e a paridade não faz
   sentido medir.
6. **`HINARIA_E2E_HYMN_PK` default inválido.** O default `"1"` do spec
   não existe no Postgres dev (`Hymn.id` é UUID). A rota `hymn-detail`
   ficou fora da medição de 2026-08-26 por isso. Setar um UUID real ou
   trocar o default por uma env obrigatória.

## Histórico de execuções

| Data       | SHA       | Rotas testadas | Diff ≤ 5% | Notas |
|------------|-----------|----------------|-----------|-------|
| 2026-06-16 | (este sub-marco) | infra criada | n/a    | smoke inicial sem baselines; pipeline pronto |
| 2026-08-26 | `fix/headless-web-build-4i` | 10 de 11 (a 11ª exige auth) | **0 de 10** | primeira execução real; **critério de ≥95% NÃO atingido**. Dois bloqueadores estruturais, detalhados abaixo. |

## Execução de 2026-08-26 — resultado real

Ambiente: macOS arm64, Chromium do cache local do Playwright
(`playwright@1.60.0`), viewport `Desktop Chrome` (1280×720), Django
`config.settings.local` em `:9000` (repo principal), SvelteKit dev em
`:5173` (worktree `fix/headless-web-build-4i`), Postgres dev com dados
reais, `HINARIA_E2E_HYMNBOOK_SLUG=o-justiceiro`.

Comando: `HINARIA_E2E_PLAYWRIGHT_READY=1 pnpm exec playwright test --project=chromium`.

### Resultado bruto: 12 falhas, 1 skip

- **10 rotas de `visual-parity.spec.ts`** falharam todas com
  `Error: A snapshot doesn't exist at …, writing actual.`
- **1 rota** (`notifications`) skipada por `requiresAuth` — esperado.
- **2 testes de `player-persists.spec.ts`** também falharam (mesma causa
  raiz do bloqueador **B** abaixo: sem dados, não há áudio pra tocar).

### Bloqueador A — a suíte não compara Django com SvelteKit

`visual-parity.spec.ts` captura `djangoShot`, mas só assere
`expect(djangoShot).toBeTruthy()`. A comparação real é
`expect(svelteShot).toMatchSnapshot("<id>.png")`, cuja baseline é o
**PNG armazenado em `visual-parity.spec.ts-snapshots/`**, não a captura
do Django. Ou seja: na primeira execução ela **grava a captura do
SvelteKit como baseline** e, da segunda em diante, compara SvelteKit
contra SvelteKit — sempre 0% de diff, independentemente do Django.

O docstring do arquivo descreve a intenção correta ("usando a
screenshot do Django como baseline"), mas o código não implementa isso.
Enquanto esse arquivo não for corrigido, **o critério de ≥95% de
paridade não é mensurável pela suíte**, e um resultado "verde" dela não
significa paridade nenhuma.

Desenho da correção (follow-up, não feito aqui):

```ts
// 1. Captura Django e SvelteKit.
// 2. Grava o PNG do Django no caminho de snapshot ANTES de assertar,
//    ou (melhor) usa um comparador de imagem direto em vez de
//    toMatchSnapshot, que é snapshot-file-based por construção.
// 3. Reporta o ratio efetivo, não só passa/falha.
```

### Bloqueador B — `POST /graphql/` responde 403 pro SSR do SvelteKit

Toda rota do SvelteKit renderiza o estado de erro
`Falha ao carregar: HTTP 403` — nenhum dado real chega ao shell.

Causa: `apps/api/urls.py` embrulha o `GraphQLView` em
`ensure_csrf_cookie` e deixa o middleware de CSRF do Django ativo, então
`POST /graphql/` exige cookie `csrftoken` + header `X-CSRFToken`. As
load functions do SvelteKit rodam em SSR (Node), onde não existe cookie
jar nenhum: `gqlFetch` manda `credentials: "include"` mas não tem
token, e o Django responde `403 — CSRF cookie not set`.

Verificado direto:

```
$ curl -s -X POST localhost:9000/graphql/ -H 'Content-Type: application/json' \
       -d '{"query":"{ globalStats { hymns } }"}'
403 Forbidden — Reason given for failure: CSRF cookie not set.
```

Isso é um furo funcional do Marco 4 que **não está no escopo desta
frente** (`apps/**` e `config/**` intocáveis aqui). Opções pra quem
pegar:

- `csrf_exempt` nas **queries** (leitura não muda estado), mantendo CSRF
  nas mutations; ou
- fazer o SSR buscar o `csrftoken` num GET prévio e repassá-lo (o
  `gqlFetch` já aceita `options.csrfToken`); ou
- `CSRF_TRUSTED_ORIGINS` + proxy same-origin, resolvendo de vez a
  questão de cookie cross-port em dev.

### Medição real de pixels (com o bloqueador B ativo)

Pra ter números em vez de só "falhou", rodei uma medição ad-hoc que
grava a captura do Django como baseline e então compara o SvelteKit
contra ela com `maxDiffPixelRatio: 0`. **Estes números NÃO são paridade
de design** — eles medem "página de erro do SvelteKit vs página real do
Django". Ficam registrados só como linha de base pra quando o
bloqueador B cair.

| Rota                 | Pixels divergentes | Ratio | "Paridade" aparente |
|----------------------|--------------------|-------|---------------------|
| `home`               | 208.969            | 0,23  | 77% |
| `hinarios-list`      | 471.422            | 0,52  | 48% |
| `hymnbook-indice`    | 610.753            | 0,67  | 33% |
| `hymnbook-corrido`   | 155.947            | 0,17  | 83% |
| `hymnbook-carrossel` | 155.235            | 0,17  | 83% |
| `busca`              | 156.796            | 0,18  | 82% |
| `profile`            | 165.021            | 0,18  | 82% |

O piso de ~0,17 é o custo fixo de "erro vs conteúdo" — as rotas que
aparecem "melhor" são simplesmente as que o Django também renderiza
mais vazias. Nenhuma das 10 rotas passa o threshold de 5%.

> **Baselines PNG não foram commitadas** (nem as geradas pela suíte, nem
> as da medição ad-hoc). São específicas da máquina — renderização de
> fonte no macOS arm64 nunca casaria com o runner do CI. `web/.gitignore`
> já cobre `test-results/` e `playwright-report/`; o diretório
> `tests/e2e/visual-parity.spec.ts-snapshots/` foi apagado à mão depois
> da execução.

### Job de Playwright no CI — avaliado e recusado por ora

O plano pedia um segundo job em `ci-web.yml` (Vitest + Playwright).
**Não foi adicionado**: com o bloqueador B ativo, o job falharia 100%
das vezes, e com ele resolvido ainda dependeria de seed determinística
(slug, `HYMN_PK` UUID, username) que hoje não existe. Job flaky é pior
que job ausente.

Desenho proposto pra quando os dois bloqueadores caírem:

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
    - pnpm preview --port 5173 &                    # build, não dev
    - pnpm exec playwright install --with-deps chromium
    - HINARIA_E2E_PLAYWRIGHT_READY=1 pnpm exec playwright test --project=chromium
```

Pré-requisitos que faltam, em ordem: (1) bloqueador B resolvido;
(2) fixture de seed versionada, com slug/pk/username fixos;
(3) `visual-parity.spec.ts` corrigido conforme bloqueador A;
(4) decisão sobre baselines — gerar no próprio runner a cada corrida
(comparando Django↔SvelteKit na mesma máquina) evita o problema de
renderização de fonte entre arquiteturas.
