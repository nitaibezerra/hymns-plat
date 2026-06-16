"""
Marco 4.A · Ciclos 4A.9 e 4A.10.

`Query.userProfile(username)` devolve `UserProfileType`:
- 4A.9: `user`, `followersCount`, `followingCount`, `uploadedAudios`.
- 4A.10: paginação `followers(first, offset)` / `following(first, offset)`.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def _make_audio(hymn, uploader=None, *, is_approved=True, title=""):
    from apps.hymns.models import HymnAudio

    return HymnAudio.objects.create(
        hymn=hymn,
        audio_file="x.mp3",
        is_approved=is_approved,
        uploaded_by=uploader,
        title=title,
    )


def test_user_profile_returns_user_with_counts_and_uploads(client, user_factory, hymn_book_factory, hymn_factory):
    from apps.users.models import UserFollow

    target = user_factory(email="target@example.com")
    follower1 = user_factory(email="f1@example.com")
    follower2 = user_factory(email="f2@example.com")
    followed = user_factory(email="other@example.com")
    UserFollow.objects.create(follower=follower1, followed=target)
    UserFollow.objects.create(follower=follower2, followed=target)
    UserFollow.objects.create(follower=target, followed=followed)

    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    h = hymn_factory(hymn_book=hb, number=1, title="Lua")
    a = _make_audio(h, uploader=target, is_approved=True, title="por target")

    data = gql(
        client,
        """
        {
          userProfile(username: "target") {
            user { username }
            followersCount
            followingCount
            uploadedAudios { id }
          }
        }
        """,
    )
    assert "errors" not in data, data
    profile = data["data"]["userProfile"]
    assert profile["user"]["username"] == "target"
    assert profile["followersCount"] == 2
    assert profile["followingCount"] == 1
    uploaded_ids = {row["id"] for row in profile["uploadedAudios"]}
    assert uploaded_ids == {str(a.id)}


def test_user_profile_returns_null_when_user_not_found(client):
    data = gql(client, '{ userProfile(username: "ghost") { user { username } } }')
    assert "errors" not in data, data
    assert data["data"]["userProfile"] is None


def test_followers_paginated(client, user_factory):
    from apps.users.models import UserFollow

    target = user_factory(email="target@example.com")
    followers = [user_factory(email=f"f{i}@example.com") for i in range(5)]
    for f in followers:
        UserFollow.objects.create(follower=f, followed=target)

    data = gql(
        client,
        '{ userProfile(username: "target") { followers(first: 2) { username } } }',
    )
    assert "errors" not in data, data
    first_page = [row["username"] for row in data["data"]["userProfile"]["followers"]]
    assert len(first_page) == 2

    data_next = gql(
        client,
        '{ userProfile(username: "target") { followers(first: 2, offset: 2) { username } } }',
    )
    assert "errors" not in data_next, data_next
    second_page = [row["username"] for row in data_next["data"]["userProfile"]["followers"]]
    assert len(second_page) == 2
    assert set(first_page).isdisjoint(set(second_page)), (first_page, second_page)


def test_following_paginated(client, user_factory):
    from apps.users.models import UserFollow

    target = user_factory(email="target@example.com")
    targets = [user_factory(email=f"t{i}@example.com") for i in range(5)]
    for t in targets:
        UserFollow.objects.create(follower=target, followed=t)

    data = gql(
        client,
        '{ userProfile(username: "target") { following(first: 3) { username } } }',
    )
    assert "errors" not in data, data
    page = [row["username"] for row in data["data"]["userProfile"]["following"]]
    assert len(page) == 3

    data_next = gql(
        client,
        '{ userProfile(username: "target") { following(first: 3, offset: 3) { username } } }',
    )
    assert "errors" not in data_next, data_next
    page_next = [row["username"] for row in data_next["data"]["userProfile"]["following"]]
    assert len(page_next) == 2
    assert set(page).isdisjoint(set(page_next))
