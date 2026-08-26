"""
Guarda de configuração: a SPA em dev precisa estar em CSRF_TRUSTED_ORIGINS.

Sem isso, toda mutation vinda do SvelteKit é recusada pelo CsrfViewMiddleware
com "Origin checking failed", e o sintoma na tela (autosave que falha, botão
inerte) não aponta pra causa. `CORS_ALLOW_ALL_ORIGINS` não cobre — CORS e a
checagem de Origin do CSRF são mecanismos distintos.
"""

import importlib


def _local_settings():
    return importlib.import_module("config.settings.local")


class TestDevCsrfTrustedOrigins:
    def test_local_settings_define_csrf_trusted_origins(self):
        assert hasattr(_local_settings(), "CSRF_TRUSTED_ORIGINS")

    def test_sveltekit_dev_origin_is_trusted(self):
        origins = _local_settings().CSRF_TRUSTED_ORIGINS
        assert "http://localhost:5173" in origins
        assert "http://127.0.0.1:5173" in origins

    def test_origins_carregam_scheme_como_o_django_exige(self):
        # Django rejeita entradas sem scheme desde a 4.0.
        for origin in _local_settings().CSRF_TRUSTED_ORIGINS:
            assert "://" in origin, origin
