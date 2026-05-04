# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sister project

This project (`hinaria.com.br` · "Portal de Hinários do Santo Daime") is operated as a **sister project** of `copa-dos-reis` (`/Users/nitai/dev/copa-dos-reis/dev/portal/`, `copadosreis.com.br`). Both are Django+Wagtail apps deployed to Railway with Cloudflare in front; we deliberately keep their infrastructure, deploy workflow, and ops conventions aligned so that any change to the playbook applies to both. **When evolving deploy/ops here, mirror the change in `copa-dos-reis`** (and vice-versa) — its CLAUDE.md cross-references this one.

Differences worth knowing:
- hinaria uses Poetry; copa-dos-reis uses pip + `requirements/*.txt`.
- hinaria env vars use the `DJANGO_*` prefix (`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`); copa-dos-reis uses unprefixed names (`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`).
- hinaria needs system binaries that copa doesn't (`ffmpeg`, `tesseract-ocr-por`, `poppler-utils`, `libmagic1`).
- hinaria sits behind a Cloudflare Worker (`hinaria-proxy`) that overrides the `Host` header; copa points DNS straight to Railway. See "Cloudflare Worker" below.

## Local development

```bash
poetry install
cp .env.example .env                    # then fill DJANGO_SECRET_KEY etc.
docker compose up -d                    # Postgres 16 + Redis 7
poetry run python manage.py migrate
poetry run python manage.py createsuperuser
poetry run python manage.py runserver

# Admin login (dev): username `nitai`, password `admin123`
# Wagtail admin: /admin/   ·   Django admin: /django-admin/
```

`config/settings/local.py` is the default. `config.settings.test` is used by pytest. `config.settings.production` is what Railway uses.

## Tests

```bash
DJANGO_SETTINGS_MODULE=config.settings.test poetry run pytest tests/unit/ -q
DJANGO_SETTINGS_MODULE=config.settings.test poetry run pytest tests/unit/test_audio_waveform.py::TestComputeWaveformPeaks -v   # single test
poetry run pytest tests/e2e/ -v         # E2E (requires a live server on :9000)
poetry run python tests/e2e/validate_fase2.py     # screenshot-driven Phase 2 visual validation
```

CI on every PR runs three jobs (`.github/workflows/ci.yml`):
1. **Lint** — `black --check`, `isort --check-only`, `ruff check`.
2. **Unit tests** — needs `ffmpeg` installed at runtime (already added to the workflow).
3. **E2E tests** — Playwright. Seed needs `is_published=True` on the sample HymnBook or anonymous lists render empty.

Before pushing, always run lint + unit suite locally; otherwise CI catches it. **Never skip git hooks** (`--no-verify` etc.) — see `.gitignore`/CI config.

### Branch protection on `main`

`main` is protected (configured via `gh api /repos/.../branches/main/protection`):
- **Required status checks**: `Lint & Format Check`, `Unit Tests`, `E2E Tests` — must all pass before merge.
- **strict: true** — branch must be up to date with `main` before merging (rebase/update if behind).
- **enforce_admins: true** — even the repo owner cannot push directly to `main` or merge a failing PR. Always go through PR.
- **No PR review required** (solo maintainer).
- `allow_force_pushes: false`, `allow_deletions: false`.

Implication: do NOT `git push origin main`. Workflow is always: feature branch → PR → CI green → squash merge.

## Architecture (the parts that span files)

Three Django apps under `apps/`:
- `apps.hymns` — domain core. `HymnBook` has publication state (`is_published`, `published_at/by`) with a custom `published()` / `visible_to(user)` manager; only published books are visible to anon users. `Hymn` carries `review_status` (NOT_REVIEWED / IN_REVIEW / REVIEWED) and `source` (MANUAL / OCR / YAML); a `pre_save`/`post_save` signal pair in `apps/hymns/signals.py` writes a `HymnRevision` row whenever editorial fields change (audit trail) and skips noise (loaddata, unrelated saves). `HymnAudio` has `waveform_peaks` (JSONField); a `post_save` signal calls `apps/hymns/services/audio.py::populate_waveform_for_audio` in a daemon thread to extract peaks via `ffmpeg` (does not block the request).
- `apps.users` — custom user, profiles, OAuth-ready.
- `apps.cms` and `apps.core` — Wagtail glue + the `/health/` endpoint Railway probes.

**No Celery in v1.** OCR (`apps.hymns.services.ocr`) and waveform generation (`apps.hymns.services.audio`) both spawn `threading.Thread(daemon=True)` inside the gunicorn worker. Trade-off: in-flight jobs are lost on container restart. Acceptable at current volume; switch to Celery (Redis is already provisioned) when this becomes a problem.

**OCR pipeline** lives in the external `hymn-ocr` package (pinned to a commit in `pyproject.toml`). It needs `tesseract-ocr` + `tesseract-ocr-por` + `poppler-utils` system packages — already in the `Dockerfile`. The Django side just calls into the lib.

**Permissions** — see `apps/hymns/permissions.py`. `can_edit_hymnbook(user, hb)` and `can_publish_hymnbook(user, hb)` are the public helpers; everything else (views, templates) calls through them. The `editor` group is created by migration `0008_editor_group_and_perms.py` and grants the editorial workspace under `/editor/`.

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
poetry run python manage.py <command>
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
poetry run python manage.py import_yaml /Users/nitai/dev/hyms-platform/o-justiceiro-import.yaml
poetry run python manage.py import_justiceiro_audios       # downloads ~250 MB to R2
poetry run python manage.py backfill_audio_waveforms       # signal usually got most via post_save
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

- Black, isort, ruff (configured in `pyproject.toml`). Run `poetry run black . && poetry run isort . && poetry run ruff check .` before pushing.
- TDD-first when adding model/manager/signal logic — `tests/unit/test_<feature>.py` then implementation.
- All CLI prompts and user-facing strings are in **PT-BR**.
- Wagtail admin lives at `/admin/`; Django admin at `/django-admin/`.
- Plans live in `_plan/` (markdown docs); each substantial change has one before code.
- Original design bundle from claude.ai/design (HTML/CSS/JSX prototype + chat transcripts) is committed at `_design/fase2-bundle/` — re-import there when the design evolves so we stay traceable.
