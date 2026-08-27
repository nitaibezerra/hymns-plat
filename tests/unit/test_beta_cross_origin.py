"""
Guarda de configuração: a SPA em `https://beta.hinaria.com.br` falando com o
Django em `https://hinaria.com.br/graphql/`.

Espelha o formato de `tests/unit/test_dev_csrf_origins.py`, que faz o mesmo
para o dev server, mas aqui o alvo é `config.settings.production` — e produção
não é o settings module da suíte, então cada teste **reimporta** o módulo do
zero com o env limpo (ver fixture `producao`). Sem isso o teste passaria a
depender do `.env` da máquina de quem roda.

## Por que isto é um teste de configuração e não de request

CORS e CSRF são duas checagens distintas (o próprio `local.py` documenta isso)
e nenhuma das duas aparece em teste de view: o sintoma delas é uma requisição
que o **navegador** recusa, ou um 403 "Origin checking failed" que o cliente vê
como "botão que não faz nada". Travar a lista aqui é o único ponto em que a
regressão fica visível antes do deploy.

O teste é bidirecional de propósito: prova que a origem do beta **está** na
lista, e prova que a lista **não** virou permissiva (nada de
`CORS_ALLOW_ALL_ORIGINS`, nada de localhost em produção, nada de origem
arbitrária).
"""

import importlib
import sys

import pytest

MODULO = "config.settings.production"

BETA = "https://beta.hinaria.com.br"
APEX = "https://hinaria.com.br"
ARBITRARIA = "https://hinaria.com.br.evil.example"

# Variáveis que esta frente introduz ou passa a ler. São limpas antes de cada
# import para que os asserts falem sobre o **default do código**, não sobre o
# `.env` de quem roda a suíte (`base.py` faz `read_env()` no import).
_ENV_DA_FRENTE = (
    "CORS_ALLOWED_ORIGINS",
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "SESSION_COOKIE_DOMAIN",
    "CSRF_COOKIE_DOMAIN",
)


@pytest.fixture
def producao(monkeypatch):
    """Devolve um carregador de `config.settings.production` sob env de produção.

    `production.py` exige `DJANGO_ALLOWED_HOSTS` (sem default, de propósito),
    então a fixture o injeta. Cada chamada descarta o módulo de `sys.modules`
    e reimporta, o que reexecuta as linhas de `production.py` com o env
    corrente — `base.py` fica em cache e não é reexecutado, o que é justamente
    o que se quer: os asserts são sobre o que produção decide.
    """

    def _carregar(**overrides: str):
        monkeypatch.setenv("DJANGO_SECRET_KEY", "chave-so-de-teste")
        monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "hinaria.com.br,www.hinaria.com.br")
        for nome in _ENV_DA_FRENTE:
            monkeypatch.delenv(nome, raising=False)
        for nome, valor in overrides.items():
            monkeypatch.setenv(nome, valor)
        sys.modules.pop(MODULO, None)
        return importlib.import_module(MODULO)

    yield _carregar
    # Não deixa a versão "de produção" do módulo para o teste seguinte.
    sys.modules.pop(MODULO, None)


# ---------------------------------------------------------------------------
# CORS — o navegador só entrega a resposta à SPA se a origem estiver liberada
# ---------------------------------------------------------------------------


class TestCorsEmProducao:
    def test_origem_do_beta_esta_liberada(self, producao):
        assert BETA in producao().CORS_ALLOWED_ORIGINS

    def test_producao_nao_herda_mais_o_localhost_do_base(self, producao):
        """`base.py` tem `localhost:5173` no default; em produção isso é buraco.

        Liberar `http://localhost:5173` com `CORS_ALLOW_CREDENTIALS = True`
        significa que qualquer página servida nessa porta na máquina de um
        usuário logado lê dados autenticados de produção.
        """
        origens = producao().CORS_ALLOWED_ORIGINS
        assert not [o for o in origens if "localhost" in o or "127.0.0.1" in o], origens

    def test_nao_libera_origem_arbitraria(self, producao):
        assert ARBITRARIA not in producao().CORS_ALLOWED_ORIGINS

    def test_nunca_libera_tudo(self, producao):
        """`CORS_ALLOW_ALL_ORIGINS` + credenciais é o anti-padrão a barrar."""
        prod = producao()
        assert getattr(prod, "CORS_ALLOW_ALL_ORIGINS", False) is False
        assert not getattr(prod, "CORS_ALLOWED_ORIGIN_REGEXES", [])

    def test_allow_credentials_continua_ligado(self, producao):
        """Sem isto o cookie de sessão não viaja no `fetch` cross-origin."""
        assert producao().CORS_ALLOW_CREDENTIALS is True

    def test_preflight_aceita_o_header_de_csrf(self, producao):
        """Mutation manda `X-CSRFToken`; se o preflight não o liberar, morre ali.

        `django-cors-headers` já traz `x-csrftoken` no default; o assert existe
        para que sobrescrever `CORS_ALLOW_HEADERS` sem incluí-lo fique vermelho.
        """
        from corsheaders.defaults import default_headers

        permitidos = getattr(producao(), "CORS_ALLOW_HEADERS", default_headers)
        assert "x-csrftoken" in [h.lower() for h in permitidos]

    def test_lista_e_configuravel_por_env(self, producao):
        prod = producao(CORS_ALLOWED_ORIGINS="https://outro.example")
        assert prod.CORS_ALLOWED_ORIGINS == ["https://outro.example"]


# ---------------------------------------------------------------------------
# CSRF — checagem separada da de CORS; o Django compara o header `Origin`
# ---------------------------------------------------------------------------


class TestCsrfTrustedOriginsEmProducao:
    def test_origem_do_beta_e_confiavel(self, producao):
        assert BETA in producao().CSRF_TRUSTED_ORIGINS

    def test_apex_e_railway_continuam_confiaveis(self, producao):
        """O admin/Wagtail em `hinaria.com.br` depende disto; não regredir."""
        origens = producao().CSRF_TRUSTED_ORIGINS
        assert APEX in origens
        assert "https://*.up.railway.app" in origens

    def test_nao_confia_em_origem_arbitraria(self, producao):
        assert ARBITRARIA not in producao().CSRF_TRUSTED_ORIGINS

    def test_origens_carregam_scheme_como_o_django_exige(self, producao):
        # Django rejeita entradas sem scheme desde a 4.0.
        for origem in producao().CSRF_TRUSTED_ORIGINS:
            assert "://" in origem, origem

    def test_lista_e_configuravel_por_env(self, producao):
        prod = producao(DJANGO_CSRF_TRUSTED_ORIGINS="https://outro.example")
        assert prod.CSRF_TRUSTED_ORIGINS == ["https://outro.example"]


# ---------------------------------------------------------------------------
# Cookies — o que atravessa (e o que NÃO atravessa) entre beta. e o apex
# ---------------------------------------------------------------------------


class TestCookiesCrossSubdominio:
    """`beta.hinaria.com.br` e `hinaria.com.br` são **same-site**, **cross-origin**.

    Same-site porque o domínio registrável (eTLD+1) é o mesmo, e é o domínio
    registrável que o `SameSite` olha — não o host. Logo `SameSite=Lax` não
    bloqueia nada aqui, nem em POST: Lax só gateia requisição *cross-site*.

    Cross-origin porque o host difere, e é por isso que o `fetch` da SPA
    precisa de `credentials: 'include'` (o default `same-origin` omitiria o
    cookie) e que as listas de CORS/CSRF acima existem.

    Consequência que **não** é óbvia: um cookie host-only de `hinaria.com.br`
    É enviado numa requisição PARA `hinaria.com.br`, venha ela de onde vier —
    o envio olha a URL de destino, não a origem da página. Ou seja, no caminho
    puramente client-side (query do urql já hidratado), a sessão funciona sem
    `Domain` nenhum.

    Onde host-only quebra são os dois caminhos em que o **host do beta** é
    quem precisa ver o cookie:

    1. `document.cookie` — todas as mutations leem `csrftoken` de lá
       (`web/src/lib/graphql/client.ts::getCsrfTokenFromCookie`, e também
       `auth.ts`, `crud.ts`, a página de revisão). Cookie host-only do apex é
       invisível numa página em `beta.`, então o header `X-CSRFToken` nunca é
       montado e toda escrita — login incluído — leva 403.
    2. SSR — o `handleFetch` de `web/src/hooks.server.ts` repassa
       `event.request.headers.get("cookie")`, ou seja o que o navegador mandou
       para `beta.hinaria.com.br`. Sem `Domain`, `sessionid` não está lá: o
       shell renderiza "Entrar" e o guard de `/editor/**` responde 302 para
       `/login` com um editor logado.

    Por isso os dois `*_COOKIE_DOMAIN` existem — mas **desligados por
    default**. Ligá-los alarga o escopo do cookie de sessão do site que já
    está no ar, e isso é decisão de operação (uma variável no Railway), não
    efeito colateral de um merge. Ver "SPA em beta" no CLAUDE.md.
    """

    def test_sessao_continua_host_only_por_default(self, producao):
        prod = producao()
        assert hasattr(prod, "SESSION_COOKIE_DOMAIN")
        assert prod.SESSION_COOKIE_DOMAIN is None

    def test_csrf_continua_host_only_por_default(self, producao):
        prod = producao()
        assert hasattr(prod, "CSRF_COOKIE_DOMAIN")
        assert prod.CSRF_COOKIE_DOMAIN is None

    def test_dominio_da_sessao_entra_por_env(self, producao):
        prod = producao(SESSION_COOKIE_DOMAIN=".hinaria.com.br")
        assert prod.SESSION_COOKIE_DOMAIN == ".hinaria.com.br"

    def test_dominio_do_csrf_entra_por_env(self, producao):
        prod = producao(CSRF_COOKIE_DOMAIN=".hinaria.com.br")
        assert prod.CSRF_COOKIE_DOMAIN == ".hinaria.com.br"

    def test_string_vazia_e_tratada_como_host_only(self, producao):
        """Django espera `None`, não `""` — desligar pela env não pode virar bug."""
        prod = producao(SESSION_COOKIE_DOMAIN="", CSRF_COOKIE_DOMAIN="")
        assert prod.SESSION_COOKIE_DOMAIN is None
        assert prod.CSRF_COOKIE_DOMAIN is None

    def test_samesite_lax_continua_servindo(self, producao):
        """`Lax` basta porque beta↔apex é same-site; não precisa virar `None`.

        Trocar para `SameSite=None` exigiria `Secure` e abriria o cookie para
        requisições genuinamente cross-site — surface a mais, sem ganho.
        """
        assert producao().SESSION_COOKIE_SAMESITE == "Lax"

    def test_csrf_cookie_continua_legivel_por_javascript(self, producao):
        """A SPA lê `csrftoken` de `document.cookie`; HttpOnly mataria as mutations."""
        assert getattr(producao(), "CSRF_COOKIE_HTTPONLY", False) is False

    def test_cookies_continuam_secure(self, producao):
        prod = producao()
        assert prod.SESSION_COOKIE_SECURE is True
        assert prod.CSRF_COOKIE_SECURE is True
