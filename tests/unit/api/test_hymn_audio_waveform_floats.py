"""
Marco 4 — Frente 1, achado da validação ponta-a-ponta.

`HymnAudioType.waveformPeaks` estava tipado `[Int!]!`, mas
`apps.hymns.services.audio.compute_waveform_peaks` devolve peaks
**normalizados 0..1** (`list[float]`) — é o que está gravado em produção e no
banco de dev. Resultado: qualquer operação que pedisse `waveformPeaks` de um
áudio real morria com `Int cannot represent non-integer value: 0.4583`, e o
`data` inteiro vinha `null` (o campo é non-null, então o erro sobe até a raiz).

Ficou invisível até agora por dois motivos somados: o 403 de CSRF impedia o
SSR de chegar ao Django, e o teste que cobria o campo semeava peaks inteiros
(`[10, 20, 30, 40, 50]`) — valores que a extração real nunca produz.
"""

from __future__ import annotations

import pytest

from apps.hymns.models import HymnAudio

from ._helpers import gql

pytestmark = pytest.mark.django_db


AUDIO_QUERY = """
query($pk: ID!) {
  hymn(pk: $pk) {
    audios { waveformPeaks }
  }
}
"""

# Amostra do formato real: RMS normalizado entre 0 e 1.
PEAKS_REAIS = [0.0, 0.4583, 0.9127, 1.0]


def test_waveform_peaks_accepts_normalized_floats(client, hymn_book_factory, hymn_factory):
    book = hymn_book_factory(name="O Justiceiro", slug="o-justiceiro")
    hymn = hymn_factory(book, number=1, title="Lua Branca")
    HymnAudio.objects.create(hymn=hymn, title="Gravação", waveform_peaks=PEAKS_REAIS, is_approved=True)

    data = gql(client, AUDIO_QUERY, variables={"pk": str(hymn.pk)})
    assert "errors" not in data, data
    assert data["data"]["hymn"]["audios"][0]["waveformPeaks"] == PEAKS_REAIS
