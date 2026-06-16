"""
Marco 1 — Ciclo 1.9.

Comando `export_schema` escreve o SDL do schema GraphQL num arquivo. Usado pelo
frontend (Marco 3+) pra gerar tipos TypeScript via codegen.
"""

from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command

pytestmark = pytest.mark.django_db


def test_export_schema_command_writes_sdl_to_stdout(capsys):
    out = StringIO()
    call_command("export_schema", "apps.api.schema:schema", stdout=out)
    sdl = out.getvalue()

    # Smoke: tipos básicos do Marco 1 aparecem no SDL exportado.
    assert "type Query" in sdl
    assert "type HymnBookType" in sdl
    assert "type HymnType" in sdl
    assert "type HymnAudioType" in sdl
    assert "type GlobalStats" in sdl


def test_export_schema_command_writes_sdl_to_file(tmp_path):
    out_path = tmp_path / "schema.graphql"
    call_command("export_schema", "apps.api.schema:schema", path=str(out_path))

    content = out_path.read_text()
    assert "type Query" in content
    assert "hymnbooks" in content
    assert "globalStats" in content
