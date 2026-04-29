# Plan: Deploy Hinaria em produção (hinaria.com.br · Railway · Cloudflare)

## Contexto

O Hinaria está pronto pra ar — Phase 2 mergeada, 519 testes verdes em CI. Falta colocar em produção: comprar `hinaria.com.br` no Registro.br, fazer deploy no Railway com Postgres, expor o domínio via Cloudflare (DNS + CDN), e usar Cloudflare R2 pra armazenar as imagens de capa e os 100+ áudios. O setup-alvo é **idêntico ao que já roda em `copa-dos-reis` (Railway + Cloudflare + R2 + Resend)**, ajustando os pontos onde os dois projetos divergem (binários de sistema do hymn-ocr/ffmpeg, env var names).

Estado atual do `hymns-plat` (de `/Users/nitai/dev/hyms-platform/hymns-plat`):

- ✅ `config/settings/production.py` existe (DEBUG=False, HSTS, X-Frame-Options=DENY)
- ✅ `gunicorn`, `whitenoise`, `psycopg2-binary`, `django-environ` em `pyproject.toml`
- ✅ 17 migrations consolidadas (apps.hymns/.users/.cms), seed de groups via migration
- ❌ Falta `Dockerfile`, `docker-entrypoint.sh`, `railway.toml`, `Procfile`
- ❌ Falta endpoint `/health/`
- ❌ Falta `CSRF_TRUSTED_ORIGINS`, `WAGTAILADMIN_BASE_URL`, `SECURE_PROXY_SSL_HEADER` em production.py
- ❌ Falta `django-storages` + `boto3` no pyproject (R2)
- ❌ Variáveis de ambiente do projeto usam prefixo `DJANGO_` (ex: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`) — diferente do `copa-dos-reis` (que usa `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`). **Vamos manter o prefixo `DJANGO_` que o projeto já usa.**

System deps necessários (não estão em copa-dos-reis):

- `ffmpeg` (waveform de áudios — `apps/hymns/services/audio.py`)
- `tesseract-ocr` + `tesseract-ocr-por` (OCR de PDFs via lib `hymn-ocr`)
- `poppler-utils` (pdf2image, dependência da hymn-ocr)
- `libmagic1` (python-magic, validação de upload)

## Decisões fixas

- **Um único processo web** (como em copa-dos-reis). OCR e waveform usam `threading.Thread(daemon=True)` dentro do gunicorn worker. **Sem Celery** no v1. Trade-off: se o worker reiniciar no meio de um OCR, o job se perde; aceitável dado o volume baixo (≤ 5 uploads/dia esperados). Quando isso virar problema, separa `worker:` no Procfile e ativa Celery.
- **Cloudflare R2 pra media** desde o primeiro deploy. Os áudios são pesados (≈ 1 GB total dos 124 já em local) e não cabem no disco efêmero do Railway. Statics ficam no Whitenoise (já configurado).
- **Resend pra email** (mesmo provider do copa-dos-reis). Começa com `console` backend e ativa quando o app for público.
- **Cloudflare DNS + CDN** com CNAME proxied apontando pro `*.up.railway.app`. SSL Full (strict). Mesmo padrão do copa-dos-reis.
- **Domínio root + www** (apex via CNAME flattening do Cloudflare). Sem subdomínios em v1.
- **Banco vazio no primeiro deploy** — não migra os hinários/áudios locais agora. Re-importa via management commands (`import_yaml`, `import_justiceiro_audios`) depois de o site estar de pé.
- **Sem Sentry** no v1 (custo cognitivo de configurar; logs do Railway resolvem por enquanto).

## Marcos

### Marco 1 — Código pronto pra Railway (TDD onde aplicável)

**Arquivos a criar:**

- `Dockerfile` — Python 3.12-slim + apt: `build-essential libpq-dev libmagic1 ffmpeg tesseract-ocr tesseract-ocr-por poppler-utils`. Instala via `pip install poetry==1.8.4 && poetry config virtualenvs.create false && poetry install --without dev --no-root`. ARGs de build pro `collectstatic` (igual copa-dos-reis). Roda como `appuser` não-root. ENTRYPOINT = `docker-entrypoint.sh`.
- `docker-entrypoint.sh` — `migrate --noinput` → `createcachetable` → `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120 --access-logfile - --error-logfile -`.
- `railway.toml` — `[build] builder=dockerfile dockerfilePath=Dockerfile`; `[deploy] healthcheckPath="/health/" healthcheckTimeout=300 restartPolicyType="on_failure" restartPolicyMaxRetries=3`.
- `Procfile` — `web: gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120` (fallback caso Railway ignore Dockerfile).
- `apps/core/views.py` — view `health_check(request)` retornando `JsonResponse({"status": "ok"})`. Não toca DB pra não falhar healthcheck quando Postgres ainda está subindo.
- `apps/core/urls.py` — `path("health/", health_check, name="health")`. Inclui em `config/urls.py`.
- `tests/unit/test_health.py` — `test_health_returns_200`, `test_health_returns_json_ok`.

**Arquivos a editar:**

- `config/settings/production.py`:
  - `CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=["https://*.up.railway.app"])`
  - `WAGTAILADMIN_BASE_URL = env("WAGTAILADMIN_BASE_URL", default="https://hinaria.com.br")`
  - `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")` (Railway→Cloudflare proxy)
  - `SESSION_COOKIE_SAMESITE = "Lax"` (allauth funciona com Lax; copa usa "None" por causa de WebView, não temos esse caso)
  - Bloco R2/S3 reescrito pra usar `AWS_S3_ENDPOINT_URL` (Cloudflare R2) e `AWS_S3_CUSTOM_DOMAIN` (domínio público do bucket). Mantém o flag `USE_S3` ou substitui por presença de `AWS_ACCESS_KEY_ID` (padrão copa).
  - Email: condicional como copa — se `EMAIL_HOST_PASSWORD` vazio → console backend.

- `pyproject.toml`:
  - Adicionar `django-storages = {extras = ["s3"], version = "^1.14"}` e `boto3 = "^1.35"` em `[tool.poetry.dependencies]`.
  - Garantir `python = "^3.11"` (Dockerfile usa 3.12, compatível).
  - Rodar `poetry lock --no-update` e commitar `poetry.lock` (atualmente gitignored — **vamos remover do .gitignore**, Railway precisa do lock pra builds determinísticos).

- `.gitignore`: remover `poetry.lock`.

- `.env.example` — criar (não existe), espelhar copa adaptado pros nomes `DJANGO_*`:
  ```
  DJANGO_SECRET_KEY=
  DJANGO_DEBUG=False
  DJANGO_ALLOWED_HOSTS=hinaria.com.br,www.hinaria.com.br,.up.railway.app
  DJANGO_CSRF_TRUSTED_ORIGINS=https://hinaria.com.br,https://www.hinaria.com.br,https://*.up.railway.app
  DJANGO_SETTINGS_MODULE=config.settings.production
  DATABASE_URL=
  REDIS_URL=
  WAGTAILADMIN_BASE_URL=https://hinaria.com.br
  SECURE_SSL_REDIRECT=True
  EMAIL_HOST=smtp.resend.com
  EMAIL_PORT=587
  EMAIL_HOST_USER=resend
  EMAIL_HOST_PASSWORD=
  DEFAULT_FROM_EMAIL=Hinaria <noreply@hinaria.com.br>
  AWS_ACCESS_KEY_ID=
  AWS_SECRET_ACCESS_KEY=
  AWS_STORAGE_BUCKET_NAME=hinaria-media
  AWS_S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
  AWS_S3_CUSTOM_DOMAIN=media.hinaria.com.br
  ```

- `docs/DEPLOYMENT.md` — criar documentando os passos manuais (espelha copa-dos-reis).

**Verificação**:
- `poetry install` local funciona.
- `pytest tests/unit/test_health.py` passa.
- `docker build .` funciona local (com `DATABASE_URL` placeholder).
- `docker run --rm -e DJANGO_SECRET_KEY=x -e DATABASE_URL=postgres://...` sobe gunicorn e responde 200 em `/health/`.

### Marco 2 — Etapas manuais (passo-a-passo no terminal e dashboards)

> **Pré-requisito**: Railway CLI instalada (`npm install -g @railway/cli`), Cloudflare CLI opcional (`brew install cloudflared` — só pra tunnel/test). As credenciais existentes em `/Users/nitai/dev/copa-dos-reis/dev/portal/.env.railway` e `.env.cloudflare` são do **outro projeto** — vamos criar novos tokens pro Hinaria.

**Passo 2.1 — Comprar o domínio `hinaria.com.br`** (Registro.br, manual)

1. Acessar https://registro.br/ logado com a conta pessoal do Nitai.
2. Buscar `hinaria.com.br`, comprar (R$ 40/ano).
3. **Não preencher os DNS ainda** — vai apontar pro Cloudflare no passo 2.2.

**Passo 2.2 — Criar a zona no Cloudflare e apontar nameservers**

1. Acessar https://dash.cloudflare.com/ → **Add a Site**.
2. Inserir `hinaria.com.br`, escolher plano **Free**.
3. Cloudflare vai mostrar 2 nameservers (ex.: `nala.ns.cloudflare.com`, `ada.ns.cloudflare.com`).
4. **No painel do Registro.br** (https://registro.br/painel → meus domínios → hinaria.com.br → editar):
   - Trocar para "DNS de outro provedor".
   - Inserir os 2 nameservers do Cloudflare. Salvar.
   - Propagação: 1 a 24h.
5. Verificar com `dig NS hinaria.com.br +short` — quando aparecer os do Cloudflare, prosseguir.

**Passo 2.3 — Criar o projeto no Railway**

1. https://railway.app/new → "Empty Project". Nomear `hinaria` (ou similar).
2. Dentro do projeto: **+ New** → **Database** → **PostgreSQL**. Aguardar provisionar (cerca de 30s).
3. **+ New** → **GitHub Repo** → autorizar acesso ao repo `nitaibezerra/hymns-plat`. Selecionar branch `main`.
4. Railway detecta o `Dockerfile` automaticamente. **Não dispara deploy ainda** — clicar em "Settings" e desativar deploys até as envs estarem prontas, ou simplesmente deixar ele falhar uma vez.
5. Anotar os IDs do projeto (vão pro `docs/DEPLOYMENT.md`):
   ```
   railway link  # interativo, escolher o projeto
   railway status  # mostra projectId, environmentId, serviceId
   ```

**Passo 2.4 — Configurar variáveis de ambiente no Railway**

Via dashboard (Variables tab do serviço hinaria) ou CLI:

```bash
railway variables \
  --set DJANGO_SECRET_KEY="$(python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')" \
  --set DJANGO_DEBUG=False \
  --set DJANGO_SETTINGS_MODULE=config.settings.production \
  --set DJANGO_ALLOWED_HOSTS=hinaria.com.br,www.hinaria.com.br,.up.railway.app \
  --set DJANGO_CSRF_TRUSTED_ORIGINS=https://hinaria.com.br,https://www.hinaria.com.br,https://*.up.railway.app \
  --set WAGTAILADMIN_BASE_URL=https://hinaria.com.br \
  --set SECURE_SSL_REDIRECT=True
```

`DATABASE_URL` é injetada automaticamente pelo Railway. Disparar deploy: `railway up` ou push pra `main`.

**Passo 2.5 — Validar deploy básico**

1. Aguardar build (~5 min — instalar tesseract+ffmpeg leva tempo).
2. `railway logs --service hinaria` — checar `Starting gunicorn`.
3. Pegar a URL pública: `railway domain` (gera um `*.up.railway.app`).
4. Acessar `https://<url>.up.railway.app/health/` — deve retornar `{"status":"ok"}`.
5. Acessar `https://<url>.up.railway.app/` — home renderiza (vazia, sem hinários).
6. Criar superuser:
   ```bash
   railway run python manage.py createsuperuser
   ```
7. Login em `/admin/` funciona.

**Passo 2.6 — Apontar domínio customizado**

1. **No Railway** → Settings do serviço → **Networking** → **Custom Domain** → adicionar `hinaria.com.br` e `www.hinaria.com.br`. Railway mostra um `<hash>.cnamesetup.up.railway.app` ou o próprio `*.up.railway.app` como target.
2. **No Cloudflare** → DNS → **Add record**:
   - Tipo `CNAME`, Nome `@`, Target `<o-target-do-railway>`, Proxy **OFF** inicialmente (pra Railway emitir o cert).
   - Tipo `CNAME`, Nome `www`, Target idem, Proxy **OFF**.
3. Aguardar Railway emitir cert (~5 min). Quando "Active", **trocar Proxy pra ON** nos dois registros.
4. **Cloudflare → SSL/TLS** → Modo **Full (strict)**. **Edge Certificates** → ativar **Always Use HTTPS** e **Automatic HTTPS Rewrites**.
5. Testar: `curl -I https://hinaria.com.br/health/` deve retornar `200`.

**Passo 2.7 — Cloudflare R2 (storage de media)**

1. https://dash.cloudflare.com/ → **R2** → ativar (cartão de crédito necessário, mas o tier free cobre nosso volume).
2. **Create bucket**: nome `hinaria-media`, região `Automatic`.
3. **Bucket → Settings → Custom Domains** → conectar `media.hinaria.com.br` (cria CNAME automaticamente no DNS do Cloudflare desde que o domínio esteja na conta).
4. **R2 → Manage R2 API Tokens** → **Create API token**:
   - Permissions: `Object Read & Write`.
   - Specify bucket: `hinaria-media`.
   - Anotar `Access Key ID`, `Secret Access Key`, e `Account ID` (canto direito do dashboard R2).
5. Adicionar envs no Railway:
   ```bash
   railway variables \
     --set AWS_ACCESS_KEY_ID=<r2-access-key-id> \
     --set AWS_SECRET_ACCESS_KEY=<r2-secret> \
     --set AWS_STORAGE_BUCKET_NAME=hinaria-media \
     --set AWS_S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com \
     --set AWS_S3_CUSTOM_DOMAIN=media.hinaria.com.br
   ```
6. Redeploy automático. Testar upload (subir uma imagem de capa via admin) — deve aparecer em `https://media.hinaria.com.br/...`.

**Passo 2.8 — Email via Resend** (opcional, pode adiar até precisar)

1. https://resend.com/ → criar conta. Adicionar domínio `hinaria.com.br`. Resend mostra registros DNS (TXT/CNAME para SPF, DKIM, DMARC).
2. Inserir esses registros no **Cloudflare DNS** (Proxy OFF nos registros de email).
3. Aguardar verificação no Resend (até 1h).
4. Criar **API Key** no Resend (escopo: Sending access).
5. Adicionar envs no Railway:
   ```bash
   railway variables \
     --set EMAIL_HOST=smtp.resend.com \
     --set EMAIL_PORT=587 \
     --set EMAIL_HOST_USER=resend \
     --set EMAIL_HOST_PASSWORD=<resend-api-key> \
     --set DEFAULT_FROM_EMAIL='Hinaria <noreply@hinaria.com.br>'
   ```
6. Testar: criar conta nova via signup → email de confirmação chega.

**Passo 2.9 — Importar dados** (depois que tudo estiver verde)

1. Conectar ao DB de produção: `railway run bash` → dentro do shell:
   ```bash
   python manage.py import_yaml /tmp/o-justiceiro.yaml
   python manage.py import_justiceiro_audios
   python manage.py backfill_audio_waveforms
   ```
2. (Alternativa, mais rápida) Subir o YAML local via SCP pro container ou usar `railway run < arquivo.yaml`.
3. Validar visualmente: `https://hinaria.com.br/hinarios/`.

### Marco 3 — Polish e DNS final

1. **Cloudflare Page Rules** (free tier permite 3):
   - `hinaria.com.br/static/*` → Cache Level: Cache Everything, Edge TTL 1 month.
   - `media.hinaria.com.br/*` → Cache Level: Cache Everything, Edge TTL 1 week.
2. **Cloudflare → Speed → Optimization** → ativar Brotli, Auto Minify (HTML/CSS/JS), Rocket Loader OFF (atrapalha allauth).
3. Atualizar `docs/DEPLOYMENT.md` com IDs reais do Railway, URLs, troubleshooting.
4. Opcional: criar token Railway no dashboard (`Account → Tokens`) e salvar em `.env.railway` (gitignored).

## Sequência de execução

1. Marco 1 (código) → push pra branch `feat/deploy-railway`, abrir PR, validar CI verde, merge.
2. Marco 2 passo 2.1 (comprar domínio) — pode rodar em paralelo com 2.2 (Cloudflare).
3. Marco 2 passos 2.3 → 2.5 (Railway up + smoke test em URL temporária).
4. **Esperar propagação dos nameservers** (1–24h) antes de 2.6.
5. Marco 2 passos 2.6 → 2.9 (domínio + R2 + email + dados).
6. Marco 3.

## Arquivos críticos

- `Dockerfile` (novo)
- `docker-entrypoint.sh` (novo)
- `railway.toml` (novo)
- `Procfile` (novo)
- `apps/core/views.py` (novo) + `apps/core/urls.py` (novo)
- `config/urls.py` (incluir health)
- `config/settings/production.py` (CSRF, R2, proxy header)
- `pyproject.toml` + `poetry.lock` (django-storages, boto3, retirar lock do gitignore)
- `.gitignore` (remover `poetry.lock`)
- `.env.example` (novo)
- `docs/DEPLOYMENT.md` (novo)
- `tests/unit/test_health.py` (novo)

## Verificação end-to-end

1. CI verde no GitHub Actions após o PR (lint + 520 unit tests + e2e).
2. `https://hinaria.com.br/health/` → `{"status":"ok"}`.
3. `https://hinaria.com.br/` carrega home com Tailwind, fonts, dark toggle.
4. Login → signup → email de confirmação chega via Resend.
5. Upload de imagem de capa via admin Wagtail → URL aponta pra `https://media.hinaria.com.br/`.
6. `import_yaml o-justiceiro.yaml && import_justiceiro_audios` rodam sem erro.
7. Player de áudio toca, waveform renderiza (ffmpeg disponível no container).
8. `curl -I https://hinaria.com.br` → headers `Strict-Transport-Security`, `X-Frame-Options: DENY`, `cf-ray:` (Cloudflare proxiando).
