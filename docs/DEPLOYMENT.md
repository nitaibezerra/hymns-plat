# Deploy do Hinaria (Railway · Cloudflare · R2)

Este guia documenta o setup de produção do Hinaria, hospedado no Railway com domínio `hinaria.com.br` proxiado pelo Cloudflare e media files em Cloudflare R2.

## Visão geral da stack

- **Hospedagem**: Railway (Dockerfile build)
- **Banco**: PostgreSQL gerenciado pelo Railway
- **DNS + CDN + SSL**: Cloudflare (free tier)
- **Storage de media**: Cloudflare R2 (S3-compatible) via `django-storages`
- **Statics**: WhiteNoise (servidos pelo gunicorn, comprimidos)
- **Email**: Resend SMTP (opcional; fallback console se `EMAIL_HOST_PASSWORD` vazio)

## Arquitetura do deploy

```
Browser
  │ HTTPS
  ▼
Cloudflare (proxy, CDN, SSL Full strict)
  │
  ▼
Railway (Dockerfile → gunicorn 2w × 4t)
  │
  ├── Postgres (Railway managed)
  └── Cloudflare R2 (media bucket: hinaria-media)
```

OCR de PDFs (`hymn-ocr`) e geração de waveform (`ffmpeg`) rodam em `threading.Thread(daemon=True)` dentro do gunicorn worker — sem Celery em v1.

## Etapas manuais

### 1. Domínio (Registro.br)

1. Registrar `hinaria.com.br` em https://registro.br/.
2. Não preencher os DNS ainda — o Cloudflare vai assumir.

### 2. Cloudflare (DNS + SSL)

1. **Add a Site** em https://dash.cloudflare.com/, plano Free.
2. Cloudflare mostra 2 nameservers. Copiar.
3. No painel do Registro.br, trocar para "DNS de outro provedor" e inserir os nameservers do Cloudflare. Aguardar propagação (`dig NS hinaria.com.br +short`).
4. **SSL/TLS**: modo **Full (strict)**. **Edge Certificates**: ativar **Always Use HTTPS** e **Automatic HTTPS Rewrites**.

### 3. Railway

1. **New Project** → Empty → nomear `hinaria`.
2. **+ New** → **Database** → **PostgreSQL**. Railway injeta `DATABASE_URL`.
3. **+ New** → **GitHub Repo** → conectar `nitaibezerra/hymns-plat` na branch `main`. Detecta o `Dockerfile`.
4. Anotar IDs (rodar `railway link` na pasta do projeto + `railway status`).

### 4. Variáveis de ambiente

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

### 5. Primeiro deploy

```bash
git push origin main          # ou: railway up
railway logs --service hinaria
railway domain                # gera URL temporária *.up.railway.app
curl https://<temp>.up.railway.app/health/   # → {"status":"ok"}
railway run python manage.py createsuperuser
```

### 6. Domínio customizado

1. **Railway → Settings → Networking → Custom Domain** → adicionar `hinaria.com.br` e `www.hinaria.com.br`. Anotar o target CNAME mostrado.
2. **Cloudflare DNS** → Add record:
   - `CNAME @ → <target-railway>`, **Proxy: OFF** inicialmente (pra Railway emitir cert).
   - `CNAME www → <target-railway>`, **Proxy: OFF**.
3. Quando o Railway marcar como Active (~5 min), **trocar Proxy pra ON** nos dois.
4. Testar: `curl -I https://hinaria.com.br/health/` → `200`, header `cf-ray` presente.

### 7. Cloudflare R2 (media)

1. **R2** no dashboard Cloudflare → **Create bucket** `hinaria-media`.
2. **Bucket → Settings → Custom Domains** → conectar `media.hinaria.com.br`.
3. **Manage R2 API Tokens** → **Create**. Permissions: Object Read & Write. Specify bucket: `hinaria-media`. Anotar Access Key ID, Secret, Account ID.
4. Adicionar envs no Railway:
   ```bash
   railway variables \
     --set AWS_ACCESS_KEY_ID=<r2-access-key> \
     --set AWS_SECRET_ACCESS_KEY=<r2-secret> \
     --set AWS_STORAGE_BUCKET_NAME=hinaria-media \
     --set AWS_S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com \
     --set AWS_S3_CUSTOM_DOMAIN=media.hinaria.com.br
   ```

### 8. Email (Resend) — opcional

1. Criar conta em https://resend.com/, adicionar domínio `hinaria.com.br`.
2. Resend mostra registros DNS (SPF, DKIM, DMARC). Adicionar no Cloudflare (Proxy OFF nesses).
3. Aguardar verificação. Criar API key (Sending access).
4. Envs no Railway:
   ```bash
   railway variables \
     --set EMAIL_HOST=smtp.resend.com \
     --set EMAIL_PORT=587 \
     --set EMAIL_HOST_USER=resend \
     --set EMAIL_HOST_PASSWORD=<resend-api-key> \
     --set DEFAULT_FROM_EMAIL='Hinaria <noreply@hinaria.com.br>'
   ```

### 9. Importar dados

```bash
# Subir o YAML local
railway run bash -c "python manage.py import_yaml /path/to/o-justiceiro.yaml"
railway run python manage.py import_justiceiro_audios
railway run python manage.py backfill_audio_waveforms
```

## Comandos úteis

```bash
railway logs                                  # tail dos logs
railway run python manage.py shell            # Django shell em prod
railway run bash                              # SSH-like
railway variables                             # listar envs
railway up                                    # deploy manual
railway redeploy                              # forçar redeploy do último build
```

## Troubleshooting

- **`ALLOWED_HOSTS` block**: garantir que `hinaria.com.br` está em `DJANGO_ALLOWED_HOSTS`.
- **CSRF 403 no admin**: incluir `https://hinaria.com.br` em `DJANGO_CSRF_TRUSTED_ORIGINS`.
- **Static 404**: build do Dockerfile precisa de `DJANGO_SECRET_KEY` (placeholder OK) pra `collectstatic`.
- **R2 upload falha**: confirmar `AWS_S3_ENDPOINT_URL` aponta pro endpoint de R2 (`https://<account-id>.r2.cloudflarestorage.com`), e o bucket existe.
- **Healthcheck timeout**: aumentar `healthcheckTimeout` no `railway.toml` se as migrations demorarem.
