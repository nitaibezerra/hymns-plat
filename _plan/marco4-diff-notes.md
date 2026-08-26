# Marco 4.I — Notas de diferenças visuais Django ↔ SvelteKit

> Última atualização: 2026-06-16 (Sub-marco 4.I — paridade visual sistemática)

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

> Lista vazia neste momento — o smoke não rodou ainda em execução
> end-to-end com baselines geradas. Próxima iteração (após rodar a suíte
> com `--update-snapshots` contra Django dev limpo) preencher.

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
3. **Baselines não comitadas.** A primeira execução em ambiente limpo
   vai gerar `tests/e2e/visual-parity.spec.ts-snapshots/`. Decidir se
   esses PNGs entram no repo (commitar implica que diferenças entre
   máquinas locais quebram a suíte; **recomendação:** commitar baselines
   geradas em macOS arm64 + Chromium e usar `--ignore-snapshots` em CI
   se for rodar em outro arch, ou rodar a suíte só em runner consistente).

## Histórico de execuções

| Data       | SHA       | Rotas testadas | Diff ≤ 5% | Notas |
|------------|-----------|----------------|-----------|-------|
| 2026-06-16 | (este sub-marco) | infra criada | n/a    | smoke inicial sem baselines; pipeline pronto |
