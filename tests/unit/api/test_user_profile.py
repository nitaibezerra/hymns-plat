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


# Ciclo 4A.10 — paginação followers/following: testes adicionados a seguir.
