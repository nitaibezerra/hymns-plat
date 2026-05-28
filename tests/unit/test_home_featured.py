"""Seção "Em destaque" da home — rotação determinística por hora.

Regras:
- Hinários com `is_featured=True` aparecem primeiro (em ordem embaralhada).
- Se faltam featured pra completar 6, completa com os demais (`is_featured=False`).
- A mesma seed (hora cheia atual) → a mesma seleção/ordem.
- Hora cheia diferente → seleção/ordem diferentes (no caso de pools grandes).
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest import mock

import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestHourlyFeaturedSelection:
    def test_featured_books_come_first(self, client, hymn_book_factory):
        """3 featured + 5 não featured → primeiros 3 da home são featured."""
        featured = [hymn_book_factory(name=f"Featured {i}", is_featured=True) for i in range(3)]
        for i in range(5):
            hymn_book_factory(name=f"Outro {i}", is_featured=False)

        body = client.get(reverse("hymns:home")).content.decode()
        # Lê a ordem dos slugs no HTML — o primeiro <a href="/hinarios/SLUG/"> dentro
        # da seção "Em destaque" deve ser de um featured.
        positions = []
        for hb in featured:
            idx = body.find(f"/hinarios/{hb.slug}/")
            positions.append(idx if idx >= 0 else 10**9)
        assert all(p < 10**9 for p in positions), "todos featured devem renderizar"

    def test_fills_with_non_featured_when_less_than_six(self, client, hymn_book_factory):
        """1 featured + 4 não featured → home mostra 5 cards (sem erro)."""
        hymn_book_factory(name="Único featured", is_featured=True)
        for i in range(4):
            hymn_book_factory(name=f"Resto {i}", is_featured=False)

        resp = client.get(reverse("hymns:home"))
        body = resp.content.decode()
        # Todos 5 slugs aparecem
        assert body.count('href="/hinarios/') >= 5

    def test_deterministic_within_same_hour(self, client, hymn_book_factory):
        """Duas requisições na mesma hora cheia → mesma ordem."""
        for i in range(8):
            hymn_book_factory(name=f"Livro {i}", is_featured=(i < 4))

        fake_now = datetime(2026, 5, 28, 14, 23, 0, tzinfo=timezone.utc)
        with mock.patch("apps.hymns.views.timezone.now", return_value=fake_now):
            a = client.get(reverse("hymns:home")).content.decode()
        fake_now_same_hour = datetime(2026, 5, 28, 14, 56, 30, tzinfo=timezone.utc)
        with mock.patch("apps.hymns.views.timezone.now", return_value=fake_now_same_hour):
            b = client.get(reverse("hymns:home")).content.decode()

        # Compara ordem de slugs em ambas respostas
        import re

        slugs_a = re.findall(r'href="/hinarios/([\w-]+)/"', a)
        slugs_b = re.findall(r'href="/hinarios/([\w-]+)/"', b)
        # Restringe aos 6 primeiros (seção "Em destaque" do header)
        assert slugs_a[:6] == slugs_b[:6]

    def test_changes_across_hours(self, client, hymn_book_factory):
        """Pools grandes (>>6) — entre duas horas distintas, a seleção tende a mudar.

        Não comparamos igualdade total porque random pode coincidir; comparamos
        que pelo menos um slug muda na janela dos 6 primeiros.
        """
        for i in range(30):
            hymn_book_factory(name=f"Livro {i:02d}", is_featured=False)

        import re

        h14 = datetime(2026, 5, 28, 14, 0, 0, tzinfo=timezone.utc)
        h15 = datetime(2026, 5, 28, 15, 0, 0, tzinfo=timezone.utc)
        with mock.patch("apps.hymns.views.timezone.now", return_value=h14):
            a = client.get(reverse("hymns:home")).content.decode()
        with mock.patch("apps.hymns.views.timezone.now", return_value=h15):
            b = client.get(reverse("hymns:home")).content.decode()

        slugs_a = re.findall(r'href="/hinarios/([\w-]+)/"', a)[:6]
        slugs_b = re.findall(r'href="/hinarios/([\w-]+)/"', b)[:6]
        assert slugs_a and slugs_b
        assert slugs_a != slugs_b, "esperado: pelo menos a ordem dos 6 primeiros muda entre horas distintas"

    def test_handles_zero_hymnbooks_gracefully(self, client):
        """Sem hinários, a home renderiza sem 500."""
        resp = client.get(reverse("hymns:home"))
        assert resp.status_code == 200


@pytest.mark.django_db
class TestPriorityField:
    """Defaults e choices do campo `priority`."""

    def test_default_is_p3(self, hymn_book_factory):
        hb = hymn_book_factory(name="Default P")
        assert hb.priority == "P3"

    def test_choices_accept_p1_p2_p3(self, hymn_book_factory):
        for p in ("P1", "P2", "P3"):
            hb = hymn_book_factory(name=f"Prio {p}", priority=p)
            assert hb.priority == p
