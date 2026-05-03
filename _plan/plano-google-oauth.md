# Plano: Login com Google (espelhando copa-dos-reis)

## Contexto

O sister project `copa-dos-reis` (`/Users/nitai/dev/copa-dos-reis/dev/portal/`) já oferece
"Continuar com Google" via `django-allauth` 65.x configurado de forma **declarativa** (credenciais
lidas de env vars, sem `SocialApp` em DB). O `hymns-plat` tem todo o esqueleto pronto —
`django-allauth` 65.3 instalado, apps `allauth.account` e `allauth.socialaccount` em
`INSTALLED_APPS`, middleware, backend, URLs `/accounts/` e templates de login/signup com Tailwind —
mas **não tem provider Google ativo**. O comentário "OAuth-ready" em `apps/users/` no CLAUDE.md
confirma que a integração é a próxima peça natural.

CLAUDE.md exige que mudanças de auth/ops fiquem **alinhadas entre os dois projetos**, então copiamos
o padrão exato (mesmas constantes, mesmos nomes de env var) para que evoluções futuras sejam
copy-paste entre as duas bases.

Resultado esperado:
- Botão "Continuar com Google" em `/accounts/login/` e `/accounts/signup/`.
- Login via Google cria `users.User` automaticamente, popula `first_name`/`last_name`/`email` e
  baixa o avatar do Google para o `ImageField` `user.avatar` na primeira vez.
- Vincular conta Google a usuário pré-existente quando os emails coincidirem (sem duplicar conta).
- Sem mudanças de schema, sem migrations novas (allauth já migrou o socialaccount).
- Sem botão visível quando a env var está vazia (graceful fallback p/ dev sem credenciais).

---

## Estado atual (verificado)

| Item | Estado |
|------|--------|
| `django-allauth` 65.3 instalado | ✅ |
| `allauth`, `allauth.account`, `allauth.socialaccount` em INSTALLED_APPS | ✅ |
| `allauth.account.middleware.AccountMiddleware` em MIDDLEWARE | ✅ |
| `AUTHENTICATION_BACKENDS` com `allauth.account.auth_backends.AuthenticationBackend` | ✅ |
| `path("accounts/", include("allauth.urls"))` em `config/urls.py` | ✅ |
| Templates `account/login.html` e `account/signup.html` Tailwind | ✅ |
| `AUTH_USER_MODEL = "users.User"` (com `bio` + `avatar` ImageField) | ✅ |
| `allauth.socialaccount.providers.google` em INSTALLED_APPS | ❌ falta |
| `SOCIALACCOUNT_PROVIDERS["google"]` config | ❌ falta |
| Env vars `GOOGLE_OAUTH_CLIENT_ID/SECRET` | ❌ falta |
| Botão Google nos templates | ❌ falta |
| `apps/users/signals.py` + `UsersConfig.ready()` | ❌ falta |

---

## Pré-requisitos (fora do código — fazer antes de mergear)

**Google Cloud Console** (https://console.cloud.google.com/apis/credentials):

1. Criar projeto "Hinaria" (ou reutilizar um existente).
2. **OAuth consent screen** → External, scopes `email` + `profile` + `openid`, app name "Hinaria",
   logo opcional, dev contact `nitaibezerra@gmail.com`.
3. **Credentials → Create OAuth 2.0 Client ID** → tipo "Web application".
4. **Authorized redirect URIs** (todas as 4):
   - `http://localhost:8000/accounts/google/login/callback/`
   - `https://hinaria.com.br/accounts/google/login/callback/`
   - `https://www.hinaria.com.br/accounts/google/login/callback/`
   - `https://hinaria-production.up.railway.app/accounts/google/login/callback/`
5. Copiar Client ID + Client Secret para o `.env` local e, depois do merge, para o Railway.

---

## Ordem de execução TDD

CLAUDE.md exige **TDD-first em model/manager/signal logic**. Cada ciclo abaixo é
**RED → GREEN → REFACTOR**, com o teste sendo escrito e visto falhando antes de qualquer
implementação.

### Ciclo 0 — preparação

- Branch `feat/google-oauth` (worktree em `/Users/nitai/dev/hyms-platform/hymns-plat-google-oauth/`)
- Criar `tests/unit/test_google_oauth.py` esqueleto importável vazio (somente import + classe)
  apenas para confirmar que o test runner enxerga o arquivo

### Ciclo 1 — provider registrado em settings

**Test (RED):** asserir que com `GOOGLE_OAUTH_CLIENT_ID` setado:
- `"allauth.socialaccount.providers.google"` está em `settings.INSTALLED_APPS`
- `settings.SOCIALACCOUNT_PROVIDERS["google"]["APP"]["client_id"]` corresponde ao env var
- `SOCIALACCOUNT_PROVIDERS["google"]["SCOPE"] == ["profile", "email"]`

Como `INSTALLED_APPS` é avaliado uma vez na inicialização, o teste vai usar
`django.conf.settings` direto + `pytest.fixture(autouse)` que faz `monkeypatch.setenv` antes
de re-importar `config.settings.base` via `importlib.reload`. Alternativa mais simples (escolhida):
test que apenas inspeciona a estrutura conforme está, e separadamente garante que a leitura
condicional `if env("GOOGLE_OAUTH_CLIENT_ID")` está presente no source de `base.py` via grep
(via `inspect.getsource` ou `Path.read_text`). Vamos com a inspeção do source para evitar
reload de settings (frágil em pytest-django).

**Implementação (GREEN):**
1. `INSTALLED_APPS`: adicionar `"allauth.socialaccount.providers.google"` após
   `"allauth.socialaccount"` (linha 66 de `config/settings/base.py`).
2. Adicionar bloco abaixo do `ACCOUNT_LOGOUT_REDIRECT_URL = "/"` (linha 195):
   ```python
   # django-allauth — social account
   SOCIALACCOUNT_AUTO_SIGNUP = True
   SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
   SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True
   SOCIALACCOUNT_LOGIN_ON_GET = True

   SOCIALACCOUNT_PROVIDERS = {}

   _google_client_id = env("GOOGLE_OAUTH_CLIENT_ID", default="")
   if _google_client_id:
       SOCIALACCOUNT_PROVIDERS["google"] = {
           "SCOPE": ["profile", "email"],
           "AUTH_PARAMS": {"access_type": "online"},
           "APP": {
               "client_id": _google_client_id,
               "secret": env("GOOGLE_OAUTH_CLIENT_SECRET", default=""),
               "key": "",
           },
       }
   ```

### Ciclo 2 — botão "Continuar com Google" em `account/login.html`

**Test (RED):** renderizar `templates/account/login.html` (via `django.template.loader.render_to_string` com contexto vazio) com setting injetado:

```python
@override_settings(
    SOCIALACCOUNT_PROVIDERS={"google": {"APP": {"client_id": "x", "secret": "y", "key": ""}, "SCOPE": ["profile", "email"]}},
    INSTALLED_APPS=settings.INSTALLED_APPS + ["allauth.socialaccount.providers.google"],
)
def test_login_template_renders_google_button(...):
    html = render_to_string("account/login.html", request=RequestFactory().get("/"))
    assert "Continuar com Google" in html
    assert "/accounts/google/login/" in html
```

(NB: `INSTALLED_APPS` já vai conter google após Ciclo 1 — `override_settings` é defensivo para o caso de teste rodar isoladamente.)

**Implementação (GREEN):** editar `templates/account/login.html`:
- Após `{% load i18n %}`, adicionar `{% load socialaccount %}`.
- Inserir antes do `<form ...>`:
  ```django
  {% get_providers as socialaccount_providers %}
  {% if socialaccount_providers %}
    <div class="mt-8 space-y-3">
      {% for provider in socialaccount_providers %}
        {% if provider.id == 'google' %}
          <a href="{% provider_login_url provider.id %}"
             class="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-full border border-ink/15 bg-cream/60 dark:bg-white/5 hover:bg-cream transition-colors text-sm font-medium">
            <svg class="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Continuar com Google</span>
          </a>
        {% endif %}
      {% endfor %}
    </div>
    <div class="mt-6 flex items-center gap-3 text-xs text-ink-soft">
      <span class="flex-1 h-px bg-ink/15"></span>
      <span>ou</span>
      <span class="flex-1 h-px bg-ink/15"></span>
    </div>
  {% endif %}
  ```
- Trocar `class="mt-8 card-soft p-8 space-y-5"` do `<form>` para `class="mt-6 card-soft p-8 space-y-5"`
  só quando provider está ativo? Mais simples: deixar `mt-6` fixo (sem prejuízo visual).

### Ciclo 3 — botão em `account/signup.html`

**Test (RED):** análogo ao Ciclo 2, mas verificando `"Cadastrar com Google"` e novamente
`/accounts/google/login/`.

**Implementação (GREEN):** mesmo bloco, texto trocado para "Cadastrar com Google".

### Ciclo 4 — sem env, sem botão (fallback)

**Test (RED):** com `SOCIALACCOUNT_PROVIDERS={}` (override), garantir que nenhum dos templates
contém "Continuar com Google" / "Cadastrar com Google" / `/accounts/google/login/`.

**Implementação:** já está atendido pelo `{% if socialaccount_providers %}` — esse teste serve
como **regression test** caso alguém remova o gate.

### Ciclo 5 — signal `import_google_avatar` (happy path)

**Test (RED):** criar `tests/unit/test_google_oauth.py::test_signal_imports_avatar`:
- Cria `user` via `user_factory` (sem avatar).
- Usa `unittest.mock.patch("apps.users.signals.requests.get")` retornando um `Mock` com
  `content=b"<jpeg bytes>"` e `raise_for_status` no-op.
- Constrói um `SocialLogin` mínimo: `account = SocialAccount(user=user, provider="google", extra_data={"picture": "https://example.com/avatar.jpg"})`.
- `sociallogin = SocialLogin(user=user, account=account)` (`SocialLogin` aceita user+account).
- `social_account_added.send(sender=SocialAccount, request=None, sociallogin=sociallogin)`.
- Recarrega user e asserir `user.avatar.name` foi setado e arquivo existe em MEDIA_ROOT.

**Implementação (GREEN):** criar `apps/users/signals.py`:

```python
import requests
from allauth.socialaccount.signals import social_account_added
from django.core.files.base import ContentFile
from django.dispatch import receiver


@receiver(social_account_added)
def import_google_avatar(sender, request, sociallogin, **kwargs):
    """Baixa a foto de perfil do Google na primeira vinculação e salva em user.avatar.

    Roda apenas em `social_account_added` (não em logins subsequentes), e só sobrescreve
    se o avatar atual estiver vazio — usuário sempre pode trocar manualmente depois.
    """
    if sociallogin.account.provider != "google":
        return
    user = sociallogin.user
    if user.avatar:
        return
    picture_url = sociallogin.account.extra_data.get("picture")
    if not picture_url:
        return
    try:
        resp = requests.get(picture_url, timeout=5)
        resp.raise_for_status()
    except requests.RequestException:
        return
    user.avatar.save(f"google-{user.pk}.jpg", ContentFile(resp.content), save=True)
```

E `apps/users/apps.py`:
```python
class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.users"

    def ready(self):
        from . import signals  # noqa: F401
```

### Ciclo 6 — signal não sobrescreve avatar existente

**Test (RED):** pré-popula `user.avatar.save("existing.jpg", ContentFile(b"..."))` antes de
emitir o signal; asserir que após o signal o `user.avatar.name` continua sendo `existing.jpg`
(implementação fallback do Ciclo 5 já cobre, mas o teste fixa o invariante).

### Ciclo 7 — signal lida com falha de rede silenciosamente

**Test (RED):** mockar `requests.get` para lançar `requests.RequestException("network down")`;
asserir que:
- O signal não levanta exceção (login não quebra).
- `user.avatar` permanece vazio.

(Implementação já cobre via `try/except`; teste é safety net.)

### Ciclo 8 — também ignora providers não-Google

**Test (RED):** emite signal com `account.provider = "facebook"` e `picture` populado; asserir
que `user.avatar` continua vazio (early-return do `if provider != "google"`).

### Ciclo 9 — signal ignora quando `picture` ausente

**Test (RED):** `extra_data={}`; asserir avatar continua vazio sem chamar `requests.get`
(`mock.assert_not_called()`).

---

## Após os ciclos: housekeeping

1. **`.env.example`** — adicionar bloco GOOGLE_OAUTH com as 4 redirect URIs documentadas.
2. **E2E test** (`tests/e2e/test_auth.py`):
   - `test_login_page_shows_google_button_when_provider_active` — visita `/accounts/login/`
     e asserir presença do texto "Continuar com Google" e link `/accounts/google/login/`.
   - Pular se env var `GOOGLE_OAUTH_CLIENT_ID` não estiver setada (`pytest.skip`) — assim CI passa
     sem credenciais reais e dev local com creds testa o flow.
3. **Lint**: `poetry run black . && poetry run isort . && poetry run ruff check .`
4. **Suíte unit completa**: `DJANGO_SETTINGS_MODULE=config.settings.test poetry run pytest tests/unit/ -q`

---

## Arquivos críticos

| Arquivo | Mudança |
|---------|---------|
| `config/settings/base.py` | INSTALLED_APPS + bloco SOCIALACCOUNT_* |
| `.env.example` | Documentar `GOOGLE_OAUTH_*` |
| `templates/account/login.html` | Botão Google + divisor |
| `templates/account/signup.html` | Botão Google + divisor |
| `apps/users/signals.py` | Novo arquivo (`import_google_avatar`) |
| `apps/users/apps.py` | `ready()` importa `signals` |
| `tests/unit/test_google_oauth.py` | Novo (todos os ciclos TDD acima) |
| `tests/e2e/test_auth.py` | Estender com checagem do botão |

---

## Verificação end-to-end

1. **Setup local**:
   - Criar credenciais no Google Console (passo "Pré-requisitos" acima).
   - Adicionar `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET` no `.env` local.
   - Não há migration nova; só `poetry run python manage.py runserver`.
2. **Smoke test manual**:
   - Abrir `http://localhost:8000/accounts/login/` → ver botão "Continuar com Google".
   - Clicar → consent screen do Google → autorizar.
   - Voltar redirecionado para `/` (LOGIN_REDIRECT_URL).
   - Conferir em `/django-admin/users/user/` que o usuário foi criado, com `email`, `first_name`,
     `last_name` e `avatar` populados.
   - Logout, logar de novo: deve reusar a mesma conta sem duplicar.
3. **Cenário de email pré-existente**:
   - Criar manualmente um `User` com email `X` via `/accounts/signup/` (senha tradicional).
   - Logout, clicar "Continuar com Google" usando conta Google de email `X`.
   - Esperado: vincula ao mesmo `User` (graças a `SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT`).
4. **Lint + testes**:
   ```bash
   poetry run black . && poetry run isort . && poetry run ruff check .
   DJANGO_SETTINGS_MODULE=config.settings.test poetry run pytest tests/unit/test_google_oauth.py -v
   poetry run pytest tests/e2e/test_auth.py -v
   ```
5. **Deploy**:
   - PR → CI verde → squash merge em `main` → auto-deploy (`.github/workflows/deploy.yml`).
   - Após deploy: setar env vars no Railway:
     ```bash
     railway variables -s hinaria \
       --set "GOOGLE_OAUTH_CLIENT_ID=<id>" \
       --set "GOOGLE_OAUTH_CLIENT_SECRET=<secret>"
     ```
     (sem `--skip-deploys` — queremos redeploy para o provider entrar em vigor).
   - Smoke test em `https://hinaria.com.br/accounts/login/`: botão visível, login completa, avatar
     puxado do Google. Conferir `/health/` segue 200.
6. **Mirror no copa-dos-reis** (CLAUDE.md exige): nenhuma mudança necessária — copa já é a fonte
   do padrão. Esse plano referencia
   `/Users/nitai/dev/copa-dos-reis/dev/portal/config/settings/base.py:200-217` como source-of-truth.

---

---

## Fase 2 — Alinhar SMTP / Email com copa-dos-reis

### Contexto

O hymns-plat já tem o **esqueleto** de SMTP em `production.py` muito parecido com copa-dos-reis
(mesmo `smtp.resend.com:587`, mesmo user `resend`, gate via `EMAIL_HOST_PASSWORD`), mas:

1. **`DEFAULT_FROM_EMAIL` está só em `production.py` dentro do `if EMAIL_HOST_PASSWORD`** — em
   dev local com `EMAIL_BACKEND=console`, qualquer envio de email cai no `webmaster@localhost`
   default do Django (ruim para depurar conteúdo). copa-dos-reis define em `base.py:245` como
   default, então o "from" é sempre o canônico.
2. **`EMAIL_USE_TLS` está como env var opcional** — copa hardcoda `True`. TLS é requerido pelo
   Resend; deixar como toggle adiciona uma variável que pode ser mal-configurada sem benefício.
3. **`EMAIL_HOST_PASSWORD` está vazia em produção** (Railway) hoje. Com o login Google chegando,
   o allauth pode disparar emails (verificação opcional, password reset, etc.) — sem SMTP real,
   esses emails caem no console do gunicorn e o usuário nunca recebe. **Funcionalmente bloqueante
   para password reset** mesmo do fluxo email/senha tradicional.

A solução é "usar a mesma configuração SMTP do copa-dos-reis" — ou seja: mesmo padrão de
settings (cópias quase idênticas), e operacionalmente reusar o **mesmo token Resend** (uma única
conta Resend serve os dois domínios; basta verificar `hinaria.com.br` no painel).

### Pré-requisitos operacionais (fora do código)

1. **Verificar `hinaria.com.br` no painel do Resend** (https://resend.com/domains):
   - Adicionar domínio → Resend devolve 4 registros DNS (SPF, DKIM x2, DMARC).
   - Criar esses registros como **DNS-only** (não proxied) na zona Cloudflare `hinaria.com.br`.
   - Aguardar verificação (~minutos).
2. **Token Resend**: usar o mesmo `re_*` token que está em `/Users/nitai/dev/copa-dos-reis/dev/portal/.env`
   (a conta Resend é a mesma — único domínio extra). Setar no Railway:
   ```bash
   railway variables -s hinaria \
     --set "EMAIL_HOST_PASSWORD=re_<token>"
   ```

### Mudanças no código (TDD)

**Ciclo SMTP-1 — `DEFAULT_FROM_EMAIL` sempre presente em `base.py`**

- *Test (RED):* `assert settings.DEFAULT_FROM_EMAIL == "Hinaria <noreply@hinaria.com.br>"` — falha
  hoje porque `DEFAULT_FROM_EMAIL` só existe quando `EMAIL_HOST_PASSWORD` é setado.
- *Implementação (GREEN):* mover a linha `DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default=...)`
  de `production.py` para `base.py` (próximo de `EMAIL_BACKEND`).

**Ciclo SMTP-2 — SMTP backend ativo quando `EMAIL_HOST_PASSWORD` setada**

- *Test (RED):* `monkeypatch.setenv("EMAIL_HOST_PASSWORD", "fake")` + reload
  `config.settings.production`; asserir que `EMAIL_BACKEND` é `smtp`, `EMAIL_HOST=smtp.resend.com`,
  `EMAIL_PORT=587`, `EMAIL_HOST_USER=resend`, `EMAIL_USE_TLS=True`. — Robustez via reload do
  módulo isolada (não interfere em test runner).
- *Implementação (GREEN):* trocar `EMAIL_USE_TLS = env.bool(...)` por `EMAIL_USE_TLS = True`
  hardcoded; remover linha de `DEFAULT_FROM_EMAIL` redundante (já em base).

**Ciclo SMTP-3 — fallback console quando senha vazia**

- *Test (RED):* `monkeypatch.delenv("EMAIL_HOST_PASSWORD", raising=False)` + reload; asserir
  `EMAIL_BACKEND` termina em `console.EmailBackend`.
- *Implementação:* já coberto — esse teste é **regression guard** caso alguém remova o gate.

### Verificação end-to-end

1. **Smoke test local** (com .env apontando pro Resend real):
   ```bash
   poetry run python manage.py shell -c "from django.core.mail import send_mail; send_mail('[Hinaria] Teste SMTP', 'Funciona', None, ['nitaibezerra@gmail.com'])"
   ```
   Esperado: email chega na inbox em segundos.
2. **Smoke test prod** (após setar token no Railway):
   - Visitar `https://hinaria.com.br/accounts/password/reset/`, pedir reset com email real.
   - Verificar que o email chega (assunto traduzido, link válido).
3. **Integração com Google OAuth**: como `ACCOUNT_EMAIL_VERIFICATION = "optional"`, login Google
   não dispara email obrigatório — mas verificação opcional via `/accounts/email/` deve funcionar.

### Arquivos críticos (Fase 2)

| Arquivo | Mudança |
|---------|---------|
| `config/settings/base.py` | `DEFAULT_FROM_EMAIL` movido pra cá |
| `config/settings/production.py` | Hardcode `EMAIL_USE_TLS=True`, remove `DEFAULT_FROM_EMAIL` daqui |
| `tests/unit/test_email_settings.py` | Novo (Ciclos SMTP-1/2/3) |

---

## Fora de escopo (decidido conscientemente)

- **CustomAccountAdapter** com redirect baseado em "perfil completo" — copa-dos-reis precisa
  porque vende ingresso (CPF/telefone obrigatórios). Hinaria não tem campo obrigatório fora do
  email; redirect padrão para `/` é suficiente.
- **Facebook / Apple providers** — copa expõe os dois opcionalmente; aqui ficam fora desta
  iteração para reduzir superfície. A estrutura `if _google_client_id:` deixa fácil estender
  depois se a demanda aparecer.
- **CustomSignupForm** com campos extras — não há campos obrigatórios extras hoje.
- **Migrations / SocialApp em DB** — django-allauth 65.x lê o app do dict, e fizemos questão
  de seguir esse padrão (sem fixture, sem entrada no admin).
