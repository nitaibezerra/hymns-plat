"""
Privacidade das LISTAS sociais de `UserProfileType`.

O Django é a fonte de verdade de produto: `/perfil/<u>/` é público e mostra as
CONTAGENS (`apps/users/views.py::profile_view` — sem `@login_required`), mas
`/perfil/<u>/seguidores/` e `/perfil/<u>/seguindo/` são `@login_required`
(`apps/users/views_social.py::followers_list` / `following_list`).

A API entregava as duas listas pra anônimo — o gate simplesmente não existia.
Estes testes travam o alinhamento:

- `followers` / `following` (listas): exigem sessão;
- `followersCount` / `followingCount`: seguem públicos;
- a paginação (`first`/`offset` e o cap de 100) continua valendo pra quem passa
  pelo gate — o gate não pode ter regredido o contrato de página.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db

FOLLOWERS_QUERY = '{ userProfile(username: "target") { followers { username } } }'
FOLLOWING_QUERY = '{ userProfile(username: "target") { following { username } } }'


def _assert_auth_error(data: dict) -> None:
    """A resposta é um erro de autenticação, não uma lista vazia silenciosa."""
    assert "errors" in data, data
    msg = data["errors"][0]["message"].lower()
    assert "auten" in msg or "permiss" in msg, data["errors"]


def _follow(follower, followed):
    from apps.users.models import UserFollow

    return UserFollow.objects.create(follower=follower, followed=followed)


@pytest.fixture
def target_with_social(user_factory):
    """`target` com 2 seguidores e seguindo 1 pessoa."""
    target = user_factory(email="target@example.com")
    f1 = user_factory(email="f1@example.com")
    f2 = user_factory(email="f2@example.com")
    other = user_factory(email="other@example.com")
    _follow(f1, target)
    _follow(f2, target)
    _follow(target, other)
    return target


def test_followers_list_blocks_anon(client, target_with_social):
    _assert_auth_error(gql(client, FOLLOWERS_QUERY))


def test_following_list_blocks_anon(client, target_with_social):
    _assert_auth_error(gql(client, FOLLOWING_QUERY))


def test_followers_list_visible_to_authenticated(client, target_with_social, user_factory):
    viewer = user_factory(email="viewer@example.com")
    data = gql(client, FOLLOWERS_QUERY, user=viewer)
    assert "errors" not in data, data
    usernames = {row["username"] for row in data["data"]["userProfile"]["followers"]}
    assert usernames == {"f1", "f2"}, usernames


def test_following_list_visible_to_authenticated(client, target_with_social, user_factory):
    viewer = user_factory(email="viewer@example.com")
    data = gql(client, FOLLOWING_QUERY, user=viewer)
    assert "errors" not in data, data
    usernames = {row["username"] for row in data["data"]["userProfile"]["following"]}
    assert usernames == {"other"}, usernames


def test_counts_stay_public_for_anon(client, target_with_social):
    """A página pública do Django mostra as contagens — a API também."""
    data = gql(
        client,
        '{ userProfile(username: "target") { followersCount followingCount } }',
    )
    assert "errors" not in data, data
    assert data["data"]["userProfile"] == {"followersCount": 2, "followingCount": 1}


def test_pagination_survives_the_gate(client, user_factory):
    """`first`/`offset` continuam paginando pra quem está logado."""
    target = user_factory(email="target@example.com")
    for i in range(5):
        _follow(user_factory(email=f"p{i}@example.com"), target)
    viewer = user_factory(email="viewer@example.com")
    client.force_login(viewer)

    first_page = gql(client, '{ userProfile(username: "target") { followers(first: 2) { username } } }')
    assert "errors" not in first_page, first_page
    page1 = [row["username"] for row in first_page["data"]["userProfile"]["followers"]]
    assert len(page1) == 2, page1

    second_page = gql(
        client,
        '{ userProfile(username: "target") { followers(first: 2, offset: 2) { username } } }',
    )
    assert "errors" not in second_page, second_page
    page2 = [row["username"] for row in second_page["data"]["userProfile"]["followers"]]
    assert len(page2) == 2, page2
    assert set(page1).isdisjoint(set(page2)), (page1, page2)


def test_first_cap_of_100_survives_the_gate(client, user_factory):
    """`first` acima de 100 continua capado — o gate não pode ter liberado o teto."""
    from apps.users.models import User, UserFollow

    target = user_factory(email="target@example.com")
    followers = User.objects.bulk_create([User(username=f"cap{i}", email=f"cap{i}@example.com") for i in range(101)])
    UserFollow.objects.bulk_create([UserFollow(follower=f, followed=target) for f in followers])
    viewer = user_factory(email="viewer@example.com")
    client.force_login(viewer)

    data = gql(client, '{ userProfile(username: "target") { followers(first: 5000) { username } } }')
    assert "errors" not in data, data
    assert len(data["data"]["userProfile"]["followers"]) == 100
