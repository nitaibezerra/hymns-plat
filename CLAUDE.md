# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sister project

This project (`hinaria.com.br` · "Portal de Hinários do Santo Daime") is operated as a **sister project** of `copa-dos-reis` (`/Users/nitai/dev/copa-dos-reis/dev/portal/`, `copadosreis.com.br`). Both are Django+Wagtail apps deployed to Railway with Cloudflare in front; we deliberately keep their infrastructure, deploy workflow, and ops conventions aligned so that any change to the playbook applies to both. **When evolving deploy/ops here, mirror the change in `copa-dos-reis`** (and vice-versa) — its CLAUDE.md cross-references this one.

Differences worth knowing:
- hinaria uses uv (single `pyproject.toml` + `uv.lock`); copa-dos-reis uses pip + `requirements/*.txt`.
- hinaria env vars use the `DJANGO_*` prefix (`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`); copa-dos-reis uses unprefixed names (`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`).
- hinaria needs system binaries that copa doesn't (`ffmpeg`, `tesseract-ocr-por`, `poppler-utils`, `libmagic1`).
- hinaria sits behind a Cloudflare Worker (`hinaria-proxy`) that overrides the `Host` header; copa points DNS straight to Railway. See "Cloudflare Worker" below.

## Local development

```bash
uv sync
cp .env.example .env                    # then fill DJANGO_SECRET_KEY etc.
docker compose up -d                    # Postgres 16 + Redis 7
uv run python manage.py migrate
uv run python manage.py createsuperuser
uv run python manage.py runserver

# Admin login (dev): username `nitai`, password `admin123`
# Wagtail admin: /admin/   ·   Django admin: /django-admin/
```

`config/settings/local.py` is the default. `config.settings.test` is used by pytest. `config.settings.production` is what Railway uses.

## Tests

```bash
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest tests/unit/ -q
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest tests/unit/test_audio_waveform.py::TestComputeWaveformPeaks -v   # single test
uv run pytest tests/e2e/ -v         # E2E (requires a live server on :9000)
uv run python tests/e2e/validate_fase2.py     # screenshot-driven Phase 2 visual validation
```

**E2E full-stack (SvelteKit + Django), o mesmo que o CI roda:**

```bash
cd web
./scripts/dev-fullstack.sh              # semeia (seed_e2e) e sobe Django :9000 + SvelteKit :5173
HINARIA_E2E_PLAYWRIGHT_READY=1 pnpm test:e2e:ci
./scripts/dev-fullstack.sh down
```

`pnpm test:e2e:ci` é a **mesma** seleção de specs do job "Web E2E (Playwright)" — mudou a lista lá, mudou nos dois. Sem `HINARIA_E2E_PLAYWRIGHT_READY=1` as specs ficam em skip e o Playwright sai 0 sem ter verificado nada; o job de CI tem um passo que reprova exatamente esse caso. `./scripts/dev-fullstack.sh env` mostra a config resolvida (portas, usuários da fixture); `... seed` re-semeia entre corridas, o que é necessário porque `revise-hymn.spec.ts` muta o banco.

### CI jobs (o que existe e o que cada um cobre)

Cinco jobs, em dois workflows. Ambos disparam em `pull_request` para `main` e `development`, e nenhum dos dois tem filtro de `paths`.

`.github/workflows/ci.yml` — backend:

| Job | Cobre | Required check? |
|---|---|---|
| **Lint & Format Check** | `black --check`, `isort --check-only`, `ruff check` | **Sim** |
| **Unit Tests** | `pytest tests/unit/` + coverage. Precisa de `ffmpeg` no runner | **Sim** |
| **E2E Tests** | Playwright pelo lado do Python (`pytest tests/e2e/`), contra o Django em `:9000`. Seed precisa de `is_published=True` no HymnBook de amostra, senão listagem anônima renderiza vazia | **Sim** |

`.github/workflows/ci-web.yml` — `web/` (SvelteKit):

| Job | Cobre | Required check? |
|---|---|---|
| **Web Test & Build** | `svelte-check` + Vitest + `pnpm build` | **Não** |
| **Web E2E (Playwright)** | Stack completa: Postgres + Redis como services, `migrate`, `seed_e2e`, Django em `:9000` e SvelteKit em `:5173`, e as specs do workspace editorial em Chromium | **Não** |

**Nenhum dos dois jobs de `ci-web.yml` é required**, ou seja, um `web/` vermelho **não** bloqueia merge — vale saber antes de confiar numa PR verde. Promover qualquer um a required é **decisão humana**: mexe em branch protection (ver "Protection on `main`"/"`development`" abaixo), e **nenhum agente deve tocar em branch protection**, nem pela UI nem via `gh api`.

#### Sobre o job "Web E2E (Playwright)"

Ele foi proposto e recusado duas vezes, sempre pela mesma razão boa: sem fixture determinística e sem usuário de teste, o job media o banco que estivesse por perto, e job flaky é pior que job ausente. A razão deixou de existir com o `seed_e2e` (comando idempotente, com gate de ambiente) e com o `web/scripts/dev-fullstack.sh`, que semeia e sobe os dois servidores. O job **reusa o script** em vez de reescrever seed + startup no YAML.

Detalhes que não são óbvios lendo o YAML de relance:

- **`DJANGO_SETTINGS_MODULE=config.settings.local`**, não `.test`: é o único settings que define `CSRF_TRUSTED_ORIGINS` para as portas do dev server, e é o que o gate do `seed_e2e` aceita.
- **Só Chromium.** `playwright.config.ts` declara chromium e firefox; instalar os dois triplicaria o setup pela mesma jornada. Por isso o `--project=chromium` — instalar um e rodar os dois daria "browser not installed" no meio da suíte.
- **Que specs rodam** está em `web/package.json` (`pnpm test:e2e:ci`), não no YAML, para que a lista possa crescer sem abrir o workflow e para que a máquina rode exatamente o que o CI roda. `visual-parity.spec.ts` e `player-persists.spec.ts` ficam **de fora**: dependem de dados do banco de dev (`o-justiceiro`, o usuário `nitaibezerra`) que o `seed_e2e` não cria, e falhariam por ausência de dado, não por regressão.
- **Sem ffmpeg de propósito.** O `seed_e2e` semeia waveform e duração prontas justamente para não acordar o signal que chama ffmpeg, e `apps/hymns/services/audio.py` degrada para `logger.warning` quando o binário falta.
- **O passo "Provar que as specs rodaram mesmo" não é enfeite.** As specs vivem sob `test.skip(!process.env.HINARIA_E2E_PLAYWRIGHT_READY, ...)` e o Playwright **sai 0 quando tudo é skipado** — um check verde que não verificou nada, que é o pior resultado possível. O passo lê o relatório JSON e reprova se nenhum teste executou **ou** se algum teste foi pulado pelo gate de ambiente. Medido: sem a env, o Playwright sai 0 e o guard sai 1. `fixme` não reprova (é pendência declarada no código, não ambiente faltando).
- **Em caso de falha**, o job sobe relatório HTML, traces, vídeos e os logs do Django e do Vite como artifact (7 dias). Sem isso, depurar E2E em CI é adivinhação.

Para rodar a mesma coisa na máquina, ver "E2E full-stack" em Tests, acima.

Três armadilhas de CI já corrigidas; não reintroduza nenhuma:
- `ci-web.yml` filtrava `branches: [main, develop]` enquanto a branch de integração é `development`. O job nunca rodou em PR de feature, e foi assim que uma regressão de merge que quebrava `pnpm build` chegou em `development` sem ninguém ver.
- `ci.yml` tinha `paths-ignore: ['_design/**', '_plan/**']`. Combinado com required status checks, uma PR só de documentação nunca dispara o workflow, os contextos nunca reportam, e a PR fica `BLOCKED` para sempre sem nada para re-rodar. (Contorno usado na época: commit de whitespace para forçar o trigger.) **Não coloque `paths-ignore` nem `paths` em workflow cujos jobs são — ou podem virar — required checks.** Foi por isso que o `paths: ['web/**', ...]` saiu do `ci-web.yml` junto com a entrada do job de E2E: além da armadilha, o E2E depende de `apps/**` e `config/**`, e com o filtro antigo uma quebra no backend não disparava o job.
- `ffmpeg` vem do `apt` do runner, não do `FedericoCarboni/setup-ffmpeg@v3` — essa action baixa release de terceiro e falhou com `TypeError: fetch failed` em 6 de 40 runs, matando o job antes do pytest rodar (e fazendo o codecov reclamar de `coverage.xml` ausente, o que esconde a causa real no log).

Antes de empurrar, sempre rode lint + suíte unitária localmente; senão o CI pega. **Nunca pule os git hooks** (`--no-verify` etc.) — ver `.gitignore`/config de CI.

### Branch workflow (two-stage: `development` → `main`)

Since `main` auto-deploys to Railway on every merge, we use a staging buffer:

```
feature/* ─PR─▶ development ─PR─▶ main ─auto-deploy─▶ Railway
```

- **`development`** is the integration target. All feature PRs merge here first. CI runs but **no deploy** is triggered.
- **`main`** is production. The only PRs that target `main` are `development → main` promotion PRs, opened deliberately when ready to deploy. Merging to `main` triggers `deploy.yml`.
- Never open a PR targeting `main` from a feature branch — always go through `development`.
- To promote: `gh pr create --base main --head development --title "release: <date or summary>"`. **Merge commit, não squash** — ver abaixo.

#### Método de merge por degrau (mudou em 2026-08-27)

O repo aceita **squash e merge commit**; cada degrau usa um, e a escolha não é estética:

| Degrau | Método | Por quê |
|---|---|---|
| `feature/*` → `development` | **Squash** | As branches de sub-marco têm 10-19 commits de ciclo TDD. Squashar deixa `development` com um commit por PR, que é a granularidade útil pra ler o histórico e pra `git revert`. |
| `development` → `main` (release) | **Merge commit** | Preserva a ancestralidade. |

**O que o squash-only causava, e por que foi abandonado:** squashar `development → main` cria em `main` um commit cujo *conteúdo* é igual ao de `development`, mas que **não está no histórico dela**. Duas consequências, as duas medidas na release de 2026-08-27 (PR #62):

1. `main` deixa de ser ancestral de `development`. Como `main` é `strict: true`, **toda** release seguinte abre já "behind" e exige um "Update branch" antes de poder mergear.
2. O back-merge fica armado pra conflito bobo: git vê a mesma mudança chegando por dois caminhos (o squash em `main` e os 34 commits em `development`). Resolve limpo enquanto ninguém editou as mesmas linhas depois — e vira conflito confuso, sem causa aparente, quando alguém editou.

Com merge commit no degrau de release, `main` continua sendo ancestral de `development` e nada disso acontece. O histórico de `main` ganha os commits individuais de `development`, que já são um por PR justamente porque o degrau de baixo squasha — ou seja, a granularidade semântica de `main` **não** piora.

> **Espelhar em `copa-dos-reis`:** esta é uma mudança de playbook de merge/deploy, e os dois projetos são mantidos alinhados de propósito. Se lá o fluxo de duas etapas existir, a mesma regra vale.

#### Protection on `main`
- **Required status checks**: `Lint & Format Check`, `Unit Tests`, `E2E Tests`.
- **strict: true** — branch must be up to date.
- **enforce_admins: true** — even the repo owner cannot push directly to `main` or bypass.
- `allow_force_pushes: false`, `allow_deletions: false`.

#### Protection on `development`
- Same required status checks as `main`.
- **strict: false** (changed 2026-08-26) — a PR branch does **not** need to be up to date before merging. It used to be `true`, but with several PRs queued behind auto-merge, every merge left the others `BEHIND` and GitHub's auto-merge does **not** press "Update branch" — the queue stalled after each merge and needed a manual nudge per PR. Trade-off accepted: a PR tested against an older base can merge, so semantic conflicts (green PR + green base = broken merge) are possible. `main` keeps `strict: true`, since that is the branch that deploys.
- **enforce_admins: false** — admin can push directly if needed for emergency fixes, though normal flow is still feature → PR → squash.
- `allow_force_pushes: false`, `allow_deletions: false`.

Implication: do NOT `git push origin main` or `git push origin development` from a feature branch. Workflow is always: feature branch → PR to `development` → CI green → **squash** merge; then periodically `development → main` PR for deploy, com **merge commit** (ver "Método de merge por degrau").

## Architecture (the parts that span files)

Three Django apps under `apps/`:
- `apps.hymns` — domain core. `HymnBook` has publication state (`is_published`, `published_at/by`) with a custom `published()` / `visible_to(user)` manager; only published books are visible to anon users. `Hymn` carries `review_status` (NOT_REVIEWED / IN_REVIEW / REVIEWED) and `source` (MANUAL / OCR / YAML); a `pre_save`/`post_save` signal pair in `apps/hymns/signals.py` writes a `HymnRevision` row whenever editorial fields change (audit trail) and skips noise (loaddata, unrelated saves). `HymnAudio` has `waveform_peaks` (JSONField); a `post_save` signal calls `apps/hymns/services/audio.py::populate_waveform_for_audio` in a daemon thread to extract peaks via `ffmpeg` (does not block the request).
- `apps.users` — custom user, profiles, OAuth-ready.
- `apps.cms` and `apps.core` — Wagtail glue + the `/health/` endpoint Railway probes.

**No Celery in v1.** OCR (`apps.hymns.services.ocr`) and waveform generation (`apps.hymns.services.audio`) both spawn `threading.Thread(daemon=True)` inside the gunicorn worker. Trade-off: in-flight jobs are lost on container restart. Acceptable at current volume; switch to Celery (Redis is already provisioned) when this becomes a problem.

**OCR pipeline** lives in the external `hymn-ocr` package (pinned to a commit in `pyproject.toml`). It needs `tesseract-ocr` + `tesseract-ocr-por` + `poppler-utils` system packages — already in the `Dockerfile`. The Django side just calls into the lib.

**Permissions** — see `apps/hymns/permissions.py`. Mutar hinários/hinos (cadastrar, editar, deletar, publicar) é restrito a **Editores ou Admins**: membros do grupo `editor` (criado por `0008_editor_group_and_perms.py`) ou superusers. `owner_user` é apenas metadado de proveniência e **não** confere direitos. Helpers públicos: `can_create_hymnbook(user)` gateia views de criação; `can_edit_hymnbook(user, hb)` e `can_publish_hymnbook(user, hb)` gateiam mutação/publicação. Templates checam via `{% if perms.hymns.can_review_any_hymnbook %}` (ex.: botão "+ Novo hinário" no list). Editor workspace sob `/editor/` aplica a mesma regra (`apps/hymns/editor_views.py::_has_editor_access`).

**Frontend** — Tailwind CSS via the Play CDN (no Node build). Design tokens in `static/css/design-tokens.css`. The audio player is a custom component (`templates/hymns/_audio_player.html` + `static/js/audio-player.js`) that renders the waveform peaks as SVG bars and animates a `clip-path`. Dark mode toggle persists in `localStorage`.

**Typography has THREE roles** (defined in both `templates/base.html` Tailwind config and `static/css/design-tokens.css`):
- `font-display` → **Cormorant Garamond** (decorative serif for titles, h1/h2, brand, stats, monograms).
- `font-serif` → **Source Serif 4** (readable body face for hymn verses; corrido/carrossel/hymn_detail wrappers).
- `font-sans` → **Inter Tight** (UI/nav).

These are pinned by `tests/unit/test_typography_setup.py` (Google Fonts import + Tailwind config + tokens.css + template usage). If you flip a title to `font-serif` (or a body wrapper to `font-display`), tests break. The original design bundle from claude.ai/design lives at `_design/fase2-bundle/` for reference.

**Reading modes for a hymnbook are URL-driven**, not JS-toggled. `?mode=indice|corrido|carrossel` on `/hinarios/<slug>/` is read by `HymnBookDetailView.get_context_data` (validated against a whitelist) and the matching `<section data-mode-pane>` renders without `hidden`. The toggle pills are `<a href="?mode=...">` anchors — modes are shareable, deep-linkable, and back/forward navigable.

**Carousel is "Reader Focus"** — `templates/hymns/hymnbook_detail.html` carousel pane + `static/js/hymn-carousel.js`. One slide per viewport (`w-screen`), hero+toggle hidden, fixed chrome (top progress bar + counter + prev/next arrows + bottom dot pagination), ← → keys navigate, Esc returns to `?mode=indice`, respects `prefers-reduced-motion`.

**Hymn body horizontal centering** uses a `width: max-content` block (CSS in `static/css/components.css` under `.carousel-body` / `.hymn-body-centered`). The block is exactly the width of the longest verse, centered inside the wrapper, with verses kept left-aligned (page-de-cantador look). This treatment is shared by carrossel, corrido and the per-hymn detail page.

**Storage** — Django 5.x uses the `STORAGES` dict (legacy `DEFAULT_FILE_STORAGE` is a no-op). Production switches `STORAGES["default"]` to `S3Boto3Storage` only when `AWS_ACCESS_KEY_ID` is set; otherwise media goes to local `/media`. `populate_waveform_for_audio` falls back to a tempfile copy when the storage backend doesn't expose `.path` (i.e. R2/S3).

## Deploy: Railway + Cloudflare + R2

The deploy stack mirrors copa-dos-reis but with one crucial difference (the Worker, see below). Plan in `_plan/plano-deploy-railway.md`; step-by-step in `docs/DEPLOYMENT.md`.

```
Browser
  │ HTTPS (Let's Encrypt cert via Cloudflare)
  ▼
Cloudflare (proxy ON, SSL Full) → Worker `hinaria-proxy`
  │ HTTPS, Host: hinaria-production.up.railway.app, X-Original-Host: hinaria.com.br
  ▼
Railway (Dockerfile build → gunicorn 2w × 4t)
  │
  ├── Postgres (Railway managed)
  └── Cloudflare R2 (media.hinaria.com.br · bucket: hinaria-media)
```

### Railway IDs (pin once, reuse forever)

```
PROJECT_ID=b840e96a-933f-49c5-bd01-d3531031a375
PROJECT_NAME=hinaria
ENVIRONMENT_ID=985e62de-1a1c-4334-ad0d-477ac47b430e
ENVIRONMENT_NAME=production
SERVICE_ID_APP=feace17d-3883-41e7-b741-881674decdba
SERVICE_NAME_APP=hinaria
SERVICE_ID_DB=42bac6b5-748d-4fd4-a820-27c06a629b22
SERVICE_NAME_DB=Postgres
# (There is also a `Postgres-jA6G` duplicate from the initial CLI mishap; ignore or delete via dashboard.)
```

URL temporária do Railway: `https://hinaria-production.up.railway.app`. Sempre verde, mesmo quando o domínio público está sendo mexido — útil para smoke tests.

### Auto-deploy (default flow)

`.github/workflows/deploy.yml` deploys `main` to Railway automatically:
1. PR merged → push to `main` → `CI` workflow runs.
2. `CI` succeeds on `main` → `Deploy` workflow fires via `workflow_run` trigger.
3. Deploy job installs the Railway CLI (npm `@railway/cli@4`), runs `railway up --ci --service <SERVICE_ID>` with project/env/service IDs hardcoded in the workflow (no stateful `railway link` needed), then probes `https://hinaria.com.br/health/` until it returns 200 (up to 90s).

`workflow_dispatch` is also enabled — manual redeploy from the Actions UI when needed (e.g., re-run after a Railway-side hiccup that wasn't a code issue).

`concurrency: deploy-railway` cancels an in-flight deploy if a newer one starts.

The `RAILWAY_API_TOKEN` GitHub secret authenticates the CLI in CI (account-scoped Railway token, same one in `/Users/nitai/dev/copa-dos-reis/dev/portal/.env.railway`).

### Manual Railway commands (rarely needed)

For local debugging, env-var changes, log inspection, or hotfixing when CI is broken. **Don't use `railway up` to deploy normal feature work** — let CI do it so the `main` HEAD always equals what's running in prod.

```bash
railway link --project b840e96a-933f-49c5-bd01-d3531031a375 -e production -s hinaria
railway status
railway up -s hinaria --ci              # build + deploy from local working tree (emergency only)
railway logs --build --lines 100 <DEPLOYMENT_ID>
railway deployment list -s hinaria --limit 5
railway variables -s hinaria --kv       # list (kv format hides Railway-injected ones)
railway variables -s hinaria --set 'KEY=value' --skip-deploys
railway domain                          # add Railway-provided domain
railway domain hinaria.com.br           # add custom; returns the CNAME target to use
```

`railway run <cmd>` runs **locally** with Railway env vars injected — but `DATABASE_URL` will be the internal `postgres.railway.internal` host, **not reachable from your laptop**. To run management commands against prod from local, use the public DB URL pattern (same as copa-dos-reis):

```bash
DB_URL=$(railway variables -s Postgres --kv | grep "^DATABASE_PUBLIC_URL=" | sed 's/^DATABASE_PUBLIC_URL=//')
DATABASE_URL="$DB_URL" \
DJANGO_SECRET_KEY=temp \
DJANGO_ALLOWED_HOSTS="*" \
DJANGO_DEBUG=False \
DJANGO_SETTINGS_MODULE=config.settings.production \
SECURE_SSL_REDIRECT=False \
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
AWS_STORAGE_BUCKET_NAME=hinaria-media \
AWS_S3_ENDPOINT_URL=https://30e42ee3dd44243e67f0824fb1477351.r2.cloudflarestorage.com \
AWS_S3_CUSTOM_DOMAIN=media.hinaria.com.br \
uv run python manage.py <command>
```

Tokens for these env vars live in `.env` (gitignored) — see "Tokens & secrets" below.

`railway ssh` requires a running container with sshd; **the hinaria container does not run one** (unlike copa-dos-reis), so prefer `railway run` or the public DB URL pattern above.

### Healthcheck quirk

`railway.toml` has `healthcheckPath` **commented out**. Railway's internal probe gets blocked by `ALLOWED_HOSTS` (the probe Host doesn't match `.up.railway.app` etc.) and the deploy is marked unhealthy even though the app is fine. We monitor `/health/` externally (Cloudflare can be wired to do this). **Don't re-enable** the healthcheck unless you've solved the Host issue first.

### Cloudflare Worker (`hinaria-proxy`)

Railway didn't issue a Let's Encrypt cert for `hinaria.com.br` even after 1h+ of "VALIDATING_OWNERSHIP". A Cloudflare Worker named `hinaria-proxy` reverse-proxies `hinaria.com.br/*` and `www.hinaria.com.br/*` → `https://hinaria-production.up.railway.app/$path`, rewriting `Host:` so Railway routes correctly. Cloudflare terminates SSL with its own cert (`Let's Encrypt E7` via Cloudflare). The Worker source lives in `/tmp/hinaria-worker.js` during deploy; recreate from this snippet:

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, "https://hinaria-production.up.railway.app");
    const headers = new Headers(request.headers);
    headers.set("Host", "hinaria-production.up.railway.app");
    headers.set("X-Original-Host", url.host);
    headers.set("X-Forwarded-Proto", "https");
    return fetch(new Request(target.toString(), { method: request.method, headers, body: request.body, redirect: "manual" }));
  }
};
```

Routes: `hinaria.com.br/*` and `www.hinaria.com.br/*` → script `hinaria-proxy` (zone `52478c632c59cd33a3447a13fd548bad`).

Because the Worker overrides `Host`, Django needs the visitor's original host to build absolute URLs (OAuth callbacks, password-reset emails, sitemaps). The standard `X-Forwarded-Host` is overwritten by Railway's edge proxy, so the Worker uses a custom header `X-Original-Host` and `apps.core.middleware.original_host_middleware` (registered first in `config/settings/production.py:MIDDLEWARE`) copies it into `HTTP_HOST` after validating against `ALLOWED_HOSTS`.

If Railway eventually issues the cert later and you want to drop the Worker: delete the two routes (zone `workers/routes`), turn `proxied: false` back on the CNAMEs, and you can also drop the custom middleware (Railway's own headers will work without it).

### Cloudflare DNS / SSL state (current)

- Zone `hinaria.com.br` (id `52478c632c59cd33a3447a13fd548bad`)
- CNAME `@` → `40ggqcmg.up.railway.app` · proxied · DNS only at first to let Railway verify, then proxied
- CNAME `www` → `k4h5iyjl.up.railway.app` · proxied
- CNAME `media` → `public.r2.dev` · proxied (R2 custom domain, set up via R2 dashboard)
- SSL/TLS mode: **Full** (NOT Strict — Railway's wildcard origin cert wouldn't validate against `hinaria.com.br`, and we don't need strict because the origin is reached over HTTPS and verified by IP-pinning at Cloudflare's edge anyway)
- Always Use HTTPS: ON
- Automatic HTTPS Rewrites: ON

### R2 (media storage)

Bucket `hinaria-media`, location ENAM, account `30e42ee3dd44243e67f0824fb1477351`. Public via `media.hinaria.com.br` (custom domain) or `pub-08d6d8b7ccb4463b82c60dfefc3ed860.r2.dev` (managed dev URL — left enabled as fallback).

S3 API token stored in `.env` (key id `93bf29226108263dda92e44190309661`). Object Read & Write scoped to the bucket.

### Importing data to production (already done once for "O Justiceiro")

```bash
# Run from /Users/nitai/dev/hyms-platform/hymns-plat with the env wrapper above
uv run python manage.py import_yaml /Users/nitai/dev/hyms-platform/o-justiceiro-import.yaml
uv run python manage.py import_justiceiro_audios       # downloads ~250 MB to R2
uv run python manage.py backfill_audio_waveforms       # signal usually got most via post_save
```

After `import_yaml`, the hymnbook is `is_published=False`. Publish via shell with `owner_user`, `published_at=timezone.now()`, `published_by`. After `import_justiceiro_audios`, the audios are `is_approved=False` — bulk-approve with `HymnAudio.objects.filter(is_approved=False).update(is_approved=True)` if intentional.

## Tokens & secrets

All gitignored. **Never commit. Never echo full values to chat output (mask or redact).**

| Path | Purpose |
|---|---|
| `.env` | local `.env` for local dev AND for staging exports of prod tokens (R2 keys, account IDs etc.). |
| `~/.claude/projects/-Users-nitai-dev-hyms-platform/memory/.cloudflare-tokens` | Cloudflare API token with full zone+R2+Workers scope (see file for what each is for). Persists across Claude sessions. |
| `/Users/nitai/dev/copa-dos-reis/dev/portal/.env.cloudflare` | Legacy R2-only Cloudflare token. Was scoped to copa-dos-reis bucket initially; do not assume it can see hinaria zones. |
| `/Users/nitai/dev/copa-dos-reis/dev/portal/.env.railway` | Railway API token (account-level). Works for both projects (account-scoped). |

When adding new ops capabilities, prefer Cloudflare API + Railway GraphQL over dashboard clicks — it makes the playbook reproducible.

## Conventions

- Black, isort, ruff (configured in `pyproject.toml`). Run `uv run black . && uv run isort . && uv run ruff check .` before pushing.
- TDD-first when adding model/manager/signal logic — `tests/unit/test_<feature>.py` then implementation.
- All CLI prompts and user-facing strings are in **PT-BR**.
- Wagtail admin lives at `/admin/`; Django admin at `/django-admin/`.
- Plans live in `_plan/` (markdown docs); each substantial change has one before code.
- Original design bundle from claude.ai/design (HTML/CSS/JSX prototype + chat transcripts) is committed at `_design/fase2-bundle/` — re-import there when the design evolves so we stay traceable.
