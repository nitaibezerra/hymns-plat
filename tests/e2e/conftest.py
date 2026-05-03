"""
Fixtures for E2E tests with Playwright.

NOTE: E2E tests run against a live server, NOT test database.
The server should be running on localhost:9000 before running tests.
"""

import os
import subprocess
from pathlib import Path

import pytest
from playwright.sync_api import Browser, Page, sync_playwright

PROJECT_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="session")
def browser():
    """Browser instance for the entire test session."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser: Browser):
    """New page for each test."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    yield page
    page.close()
    context.close()


@pytest.fixture
def base_url():
    """Base URL of Django server."""
    return "http://localhost:9000"


def _create_session_for(email: str) -> str:
    """Cria uma sessão Django no DB do servidor live e retorna o sessionid.

    Usado pela fixture `authenticated_page` — o site público é Google-only,
    então não dá pra entrar via form. Esse helper conversa direto com o ORM
    via management shell (mesma DB do `runserver` na :9000).
    """
    code = (
        "from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY;"
        "from django.contrib.sessions.backends.db import SessionStore;"
        "from apps.users.models import User;"
        f"u = User.objects.get(email={email!r});"
        "s = SessionStore();"
        "s[SESSION_KEY] = str(u.pk);"
        "s[BACKEND_SESSION_KEY] = 'django.contrib.auth.backends.ModelBackend';"
        "s[HASH_SESSION_KEY] = u.get_session_auth_hash();"
        "s.save();"
        "print(s.session_key)"
    )
    result = subprocess.run(
        ["poetry", "run", "python", "manage.py", "shell", "-c", code],
        env={**os.environ, "DJANGO_SETTINGS_MODULE": "config.settings.local"},
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip().splitlines()[-1]


@pytest.fixture
def authenticated_page(page: Page, base_url: str):
    """Page com sessão autenticada injetada via cookie.

    Pré-requisito: usuário `teste2e@example.com` existe no DB do servidor
    live (criado pelo step "Create test user" do CI ou manualmente em dev).
    """
    sessionid = _create_session_for("teste2e@example.com")
    page.goto(base_url)  # estabelece origem antes do set_cookie
    page.context.add_cookies(
        [
            {
                "name": "sessionid",
                "value": sessionid,
                "domain": "localhost",
                "path": "/",
            }
        ]
    )
    return page
