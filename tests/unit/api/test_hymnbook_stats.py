"""
Marco 4.A · Ciclo 4A.1.

Expor `HymnBookType.stats` com contagens equivalentes às anotações de
`_annotate_card_counts` (`n_hymns_anno`, `n_audios_anno`) usadas pelos cards
do monolito + total de hinos revisados.
"""

from __future__ import annotations

import pytest

from ._helpers import gql

pytestmark = pytest.mark.django_db


def test_hymnbook_type_exposes_stats_field(client, hymn_book_factory, hymn_factory):
    from apps.hymns.models import Hymn, HymnAudio

    hb = hymn_book_factory(name="O Cruzeiro", slug="cruzeiro", is_published=True)
    h1 = hymn_factory(hymn_book=hb, number=1, title="Hino 1")
    hymn_factory(hymn_book=hb, number=2, title="Hino 2")
    h3 = hymn_factory(hymn_book=hb, number=3, title="Hino 3")

    h3.review_status = Hymn.ReviewStatus.REVIEWED
    h3.save()

    HymnAudio.objects.create(hymn=h1, audio_file="x.mp3", is_approved=True)
    HymnAudio.objects.create(hymn=h1, audio_file="y.mp3", is_approved=False)

    data = gql(
        client,
        "{ hymnbooks { slug stats { hymnsTotal hymnsReviewed audiosApproved } } }",
    )
    assert "errors" not in data, data
    by_slug = {row["slug"]: row["stats"] for row in data["data"]["hymnbooks"]}
    stats = by_slug["cruzeiro"]
    assert stats == {"hymnsTotal": 3, "hymnsReviewed": 1, "audiosApproved": 1}, stats
