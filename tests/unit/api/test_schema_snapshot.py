"""
Marco 4.A · Ciclo 4A.13.

`schema.graphql` no root do repo precisa estar idêntico ao SDL gerado por
`export_schema`. Garante que o frontend (codegen) sempre vê o schema
publicado em prod e que mudanças no schema entram em commits explícitos.
"""

from __future__ import annotations

from io import StringIO
from pathlib import Path

import pytest
from django.core.management import call_command

pytestmark = pytest.mark.django_db


def test_schema_graphql_is_up_to_date():
    project_root = Path(__file__).resolve().parents[3]
    snapshot_path = project_root / "schema.graphql"

    out = StringIO()
    call_command("export_schema", "apps.api.schema:schema", stdout=out)
    expected = out.getvalue()

    actual = snapshot_path.read_text()
    if actual != expected:
        diff_msg = (
            "schema.graphql está fora de sincronia.\n"
            "Rode: `uv run python manage.py export_schema apps.api.schema:schema > schema.graphql`\n"
            "e commit o resultado."
        )
        raise AssertionError(diff_msg)
