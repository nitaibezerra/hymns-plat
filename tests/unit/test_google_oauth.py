"""
Tests for Google OAuth integration via django-allauth.

Espelha a configuração de copa-dos-reis (sister project) — declarativa via
SOCIALACCOUNT_PROVIDERS, sem SocialApp em DB. Cobre: registro do provider,
botões nos templates, e o signal que importa o avatar do Google na primeira
vinculação.
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import requests
from allauth.socialaccount.models import SocialAccount, SocialLogin
from allauth.socialaccount.signals import social_account_added
from django.conf import settings
from django.template.loader import render_to_string
from django.test import RequestFactory, override_settings

GOOGLE_PROVIDER_OVERRIDE = {
    "google": {
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
        "APP": {
            "client_id": "test-client-id",
            "secret": "test-client-secret",
            "key": "",
        },
    }
}


# ---------------------------------------------------------------------------
# Ciclo 1 — provider registrado em settings
# ---------------------------------------------------------------------------


def test_google_provider_in_installed_apps():
    """O app do provider Google está sempre carregado (gate é via env, não via INSTALLED_APPS)."""
    assert "allauth.socialaccount.providers.google" in settings.INSTALLED_APPS


def test_settings_base_reads_google_oauth_env_vars():
    """base.py lê GOOGLE_OAUTH_CLIENT_ID/SECRET e popula SOCIALACCOUNT_PROVIDERS['google']."""
    base_py = Path(settings.BASE_DIR) / "config" / "settings" / "base.py"
    src = base_py.read_text()

    assert "GOOGLE_OAUTH_CLIENT_ID" in src, "settings deve ler env var GOOGLE_OAUTH_CLIENT_ID"
    assert "GOOGLE_OAUTH_CLIENT_SECRET" in src, "settings deve ler env var GOOGLE_OAUTH_CLIENT_SECRET"
    assert "SOCIALACCOUNT_PROVIDERS" in src
    assert '"google"' in src
    assert '"profile"' in src and '"email"' in src, "scope deve incluir profile + email"


def test_socialaccount_login_settings_present():
    """Settings de UX do socialaccount estão configuradas (auto-signup, auto-connect, login on get)."""
    assert getattr(settings, "SOCIALACCOUNT_AUTO_SIGNUP", False) is True
    assert getattr(settings, "SOCIALACCOUNT_EMAIL_AUTHENTICATION", False) is True
    assert getattr(settings, "SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT", False) is True
    assert getattr(settings, "SOCIALACCOUNT_LOGIN_ON_GET", False) is True


# ---------------------------------------------------------------------------
# Ciclo 2 — botão "Continuar com Google" em account/login.html
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER_OVERRIDE)
def test_login_template_renders_google_button_when_provider_active():
    request = RequestFactory().get("/accounts/login/")
    html = render_to_string("account/login.html", request=request)
    assert "Continuar com Google" in html
    assert "/accounts/google/login/" in html
    # base.html aplica hx-boost="true" no body — todo <a> vira XHR e o redirect
    # 302 do allauth para accounts.google.com quebra por CORS. O link Google
    # precisa opt-out explícito.
    assert 'hx-boost="false"' in html


# ---------------------------------------------------------------------------
# Ciclo 3 — botão "Cadastrar com Google" em account/signup.html
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER_OVERRIDE)
def test_signup_template_renders_google_button_when_provider_active():
    request = RequestFactory().get("/accounts/signup/")
    html = render_to_string("account/signup.html", request=request)
    assert "Cadastrar com Google" in html
    assert "/accounts/google/login/" in html
    assert 'hx-boost="false"' in html


# ---------------------------------------------------------------------------
# Ciclo 4 — sem provider configurado, botão não aparece (graceful fallback)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@override_settings(SOCIALACCOUNT_PROVIDERS={})
def test_login_template_omits_google_button_when_provider_disabled():
    request = RequestFactory().get("/accounts/login/")
    html = render_to_string("account/login.html", request=request)
    assert "Continuar com Google" not in html
    assert "/accounts/google/login/" not in html


@pytest.mark.django_db
@override_settings(SOCIALACCOUNT_PROVIDERS={})
def test_signup_template_omits_google_button_when_provider_disabled():
    request = RequestFactory().get("/accounts/signup/")
    html = render_to_string("account/signup.html", request=request)
    assert "Cadastrar com Google" not in html


# ---------------------------------------------------------------------------
# Helpers para os testes do signal (Ciclos 5–9)
# ---------------------------------------------------------------------------


def _make_sociallogin(user, provider="google", picture_url="https://example.com/avatar.jpg"):
    extra_data = {"picture": picture_url} if picture_url is not None else {}
    account = SocialAccount(user=user, provider=provider, uid="google-uid-123", extra_data=extra_data)
    return SocialLogin(user=user, account=account)


def _fire_signal(sociallogin):
    social_account_added.send(sender=SocialAccount, request=None, sociallogin=sociallogin)


# ---------------------------------------------------------------------------
# Ciclo 5 — signal import_google_avatar (happy path)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_signal_imports_google_avatar(user_factory):
    user = user_factory(email="alice@example.com")
    assert not user.avatar

    fake_response = MagicMock()
    fake_response.content = b"\xff\xd8\xff\xe0fake-jpeg-bytes"
    fake_response.raise_for_status.return_value = None

    with patch("apps.users.signals.requests.get", return_value=fake_response) as mock_get:
        _fire_signal(_make_sociallogin(user))
        mock_get.assert_called_once_with("https://example.com/avatar.jpg", timeout=5)

    user.refresh_from_db()
    assert user.avatar.name, "user.avatar deve ter sido populado"
    assert user.avatar.read() == b"\xff\xd8\xff\xe0fake-jpeg-bytes"


# ---------------------------------------------------------------------------
# Ciclo 6 — signal não sobrescreve avatar existente
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_signal_does_not_overwrite_existing_avatar(user_factory, sample_image):
    user = user_factory(email="bob@example.com")
    user.avatar.save("preexisting.jpg", sample_image, save=True)
    original_name = user.avatar.name

    with patch("apps.users.signals.requests.get") as mock_get:
        _fire_signal(_make_sociallogin(user))
        mock_get.assert_not_called()

    user.refresh_from_db()
    assert user.avatar.name == original_name


# ---------------------------------------------------------------------------
# Ciclo 7 — signal lida com falha de rede silenciosamente
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_signal_swallows_network_errors(user_factory):
    user = user_factory(email="carol@example.com")

    with patch(
        "apps.users.signals.requests.get",
        side_effect=requests.RequestException("network down"),
    ):
        # Não deve levantar
        _fire_signal(_make_sociallogin(user))

    user.refresh_from_db()
    assert not user.avatar, "avatar deve permanecer vazio quando download falha"


# ---------------------------------------------------------------------------
# Ciclo 8 — providers não-Google são ignorados
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_signal_ignores_non_google_providers(user_factory):
    user = user_factory(email="dave@example.com")

    with patch("apps.users.signals.requests.get") as mock_get:
        _fire_signal(_make_sociallogin(user, provider="facebook"))
        mock_get.assert_not_called()

    user.refresh_from_db()
    assert not user.avatar


# ---------------------------------------------------------------------------
# Ciclo 9 — signal ignora quando picture ausente
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_signal_skips_when_picture_url_missing(user_factory):
    user = user_factory(email="eve@example.com")

    with patch("apps.users.signals.requests.get") as mock_get:
        _fire_signal(_make_sociallogin(user, picture_url=None))
        mock_get.assert_not_called()

    user.refresh_from_db()
    assert not user.avatar


# ---------------------------------------------------------------------------
# Google-only — desabilitar login interno (email/senha)
# ---------------------------------------------------------------------------


def test_custom_account_adapter_disables_signup():
    """O adapter custom deve bloquear signup tradicional (Google-only)."""
    from allauth.account.adapter import get_adapter

    adapter = get_adapter()
    assert adapter.is_open_for_signup(request=None) is False


def test_settings_uses_custom_account_adapter():
    assert settings.ACCOUNT_ADAPTER == "apps.users.adapters.CustomAccountAdapter"


@pytest.mark.django_db
@override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER_OVERRIDE)
def test_login_template_has_no_password_form():
    """Login só com Google — sem inputs de email/senha."""
    request = RequestFactory().get("/accounts/login/")
    html = render_to_string("account/login.html", request=request)
    assert 'name="login"' not in html
    assert 'name="password"' not in html
    assert 'type="password"' not in html


@pytest.mark.django_db
@override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER_OVERRIDE)
def test_login_template_has_no_signup_or_password_reset_links():
    """Sem signup interno e sem password reset — esses fluxos não existem mais."""
    request = RequestFactory().get("/accounts/login/")
    html = render_to_string("account/login.html", request=request)
    assert "/accounts/password/reset/" not in html
    assert "/accounts/signup/" not in html
    assert "Esqueceu" not in html
    assert "Criar conta" not in html


@pytest.mark.django_db
def test_signup_url_renders_signup_closed_message(client):
    """GET /accounts/signup/ deve renderizar signup_closed (não o form de signup)."""
    resp = client.get("/accounts/signup/")
    assert resp.status_code == 200
    body = resp.content.decode()
    # Mensagem do signup_closed.html
    assert "Google" in body
    # E não deve ter o form de signup tradicional
    assert 'name="password1"' not in body
    assert 'name="password2"' not in body


@pytest.mark.django_db
def test_header_anonymous_does_not_show_create_account(client):
    """Header anonymous esconde 'Criar conta' (signup interno desativado)."""
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.content.decode()
    assert "Criar conta" not in body
