"""
Marco 2.1.0 — testes de smoke do novo layout base.

Validamos só a presença de ganchos chave (Tailwind, fonts, dark toggle, header
nav). O conteúdo visual em si valida-se manualmente comparando com o PDF.
"""

import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestBaseLayout:
    def test_loads_tailwind_cdn(self, client):
        resp = client.get(reverse("hymns:home"))
        assert b"cdn.tailwindcss.com" in resp.content

    def test_loads_three_font_families(self, client):
        resp = client.get(reverse("hymns:home")).content.decode()
        assert "Cormorant+Garamond" in resp
        assert "Inter" in resp
        assert "JetBrains+Mono" in resp

    def test_dark_toggle_present(self, client):
        resp = client.get(reverse("hymns:home")).content.decode()
        assert "data-theme-toggle" in resp

    def test_header_renders_nav_when_authenticated(self, authenticated_client):
        resp = authenticated_client.get(reverse("hymns:home")).content.decode()
        assert ">Editor<" in resp
        assert ">Contribuir<" in resp

    def test_header_hides_editor_for_anon(self, client):
        resp = client.get(reverse("hymns:home")).content.decode()
        assert ">Editor<" not in resp

    def test_skip_link_present_for_a11y(self, client):
        resp = client.get(reverse("hymns:home")).content.decode()
        assert "Pular para conteúdo" in resp

    def test_header_authenticated_does_not_show_logout_link(self, authenticated_client):
        """Logout vive na página de perfil — não deve aparecer no cabeçalho."""
        resp = authenticated_client.get(reverse("hymns:home")).content.decode()
        assert "/accounts/logout/" not in resp
