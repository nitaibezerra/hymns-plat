"""Health check endpoint for Railway probe."""

from django.urls import reverse


def test_health_returns_200(client):
    response = client.get(reverse("health"))
    assert response.status_code == 200


def test_health_returns_json_ok(client):
    response = client.get(reverse("health"))
    assert response.json() == {"status": "ok"}


def test_health_works_without_db(client):
    """Health endpoint must not depend on DB so Railway can probe before
    Postgres is fully ready."""
    response = client.get(reverse("health"))
    assert response.status_code == 200
