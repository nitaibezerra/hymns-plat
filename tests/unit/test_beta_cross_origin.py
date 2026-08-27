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
