"""
Tests for SMTP/email settings — espelham o padrão de copa-dos-reis (Resend).

Mistura inspeção do source de production.py (forma do gate) com asserts em
settings live (DEFAULT_FROM_EMAIL deve estar em base.py para sempre estar
presente, mesmo em dev/test).
"""

from pathlib import Path

from django.conf import settings

# ---------------------------------------------------------------------------
# Ciclo SMTP-1 — DEFAULT_FROM_EMAIL sempre presente (em base.py)
# ---------------------------------------------------------------------------


def test_default_from_email_is_set_in_base_settings():
    """DEFAULT_FROM_EMAIL deve ser um default de base.py, não condicional ao SMTP."""
    assert settings.DEFAULT_FROM_EMAIL == "Hinaria <noreply@hinaria.com.br>"


def test_default_from_email_declared_in_base_module():
    """O default deve estar fisicamente em base.py (não em production.py)."""
    base_src = (Path(settings.BASE_DIR) / "config" / "settings" / "base.py").read_text()
    assert "DEFAULT_FROM_EMAIL" in base_src
    assert "Hinaria <noreply@hinaria.com.br>" in base_src


# ---------------------------------------------------------------------------
# Ciclo SMTP-2 — SMTP backend ativo quando EMAIL_HOST_PASSWORD setada
# ---------------------------------------------------------------------------


def test_production_settings_smtp_block_matches_resend_pattern():
    """production.py espelha a config Resend do copa-dos-reis: smtp.resend.com:587/resend/TLS."""
    prod_src = (Path(settings.BASE_DIR) / "config" / "settings" / "production.py").read_text()

    assert "EMAIL_HOST_PASSWORD = env(" in prod_src
    assert "if EMAIL_HOST_PASSWORD:" in prod_src
    assert "django.core.mail.backends.smtp.EmailBackend" in prod_src
    assert '"smtp.resend.com"' in prod_src
    assert "EMAIL_PORT" in prod_src and "587" in prod_src
    assert '"resend"' in prod_src
    # TLS deve ser hardcoded True (igual copa-dos-reis), não env var configurável.
    assert "EMAIL_USE_TLS = True" in prod_src
    assert (
        'env.bool("EMAIL_USE_TLS"' not in prod_src
    ), "EMAIL_USE_TLS deve ser hardcoded True, não env var (Resend exige TLS)"


def test_production_does_not_redeclare_default_from_email():
    """DEFAULT_FROM_EMAIL deve estar só em base.py para evitar drift."""
    prod_src = (Path(settings.BASE_DIR) / "config" / "settings" / "production.py").read_text()
    assert (
        "DEFAULT_FROM_EMAIL" not in prod_src
    ), "DEFAULT_FROM_EMAIL deve viver apenas em base.py para evitar duplicação"


# ---------------------------------------------------------------------------
# Ciclo SMTP-3 — fallback console quando senha vazia
# ---------------------------------------------------------------------------


def test_production_falls_back_to_console_backend_when_password_missing():
    """Sem EMAIL_HOST_PASSWORD, production deve cair no console backend (regression guard)."""
    prod_src = (Path(settings.BASE_DIR) / "config" / "settings" / "production.py").read_text()
    assert "else:" in prod_src
    assert "django.core.mail.backends.console.EmailBackend" in prod_src
