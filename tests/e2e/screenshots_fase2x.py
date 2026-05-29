"""Screenshots de cada tela modificada na Fase 2.x para comparação visual com
o bundle de design.

Pré-requisitos:
- `uv run python manage.py runserver 9000` rodando.
- User `teste2e@example.com` no grupo `editor` + is_staff (criado automaticamente).
- Pelo menos um hinário publicado no DB local — o script cria um seed
  específico (`screenshots-fase2x`) idempotente.

Uso:
    uv run python tests/e2e/screenshots_fase2x.py

Saída: `_design/ui_v3/screenshots/*.png` com viewport 1280×900 (desktop).
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = PROJECT_ROOT / "_design/ui_v3/screenshots"
BASE_URL = "http://localhost:9000"
SEED_SLUG = "screenshots-fase2x"


def _shell(code: str) -> str:
    result = subprocess.run(
        ["uv", "run", "python", "manage.py", "shell", "-c", code],
        env={**os.environ, "DJANGO_SETTINGS_MODULE": "config.settings.local"},
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    lines = [ln for ln in result.stdout.strip().splitlines() if ln.strip()]
    return lines[-1] if lines else ""


def _ensure_seed() -> tuple[str, str]:
    """Garante: editor+staff user, hinário publicado com hino e uma série de
    hinários com prioridades diferentes pro workspace ficar interessante.

    Retorna (book_slug_para_detail, hymn_pk_para_revise)."""
    code = (
        "from django.contrib.auth.models import Group;"
        "from apps.hymns.models import Hymn, HymnBook;"
        "from apps.users.models import User;"
        "from django.utils import timezone;"
        "ed, _ = Group.objects.get_or_create(name='editor');"
        "u, _ = User.objects.get_or_create(email='teste2e@example.com', defaults={'username': 'teste2e', 'is_active': True});"
        "u.groups.add(ed);"
        "u.is_staff = True;"
        "u.save();"
        # Seed principal pra detail/revise
        f"hb, _ = HymnBook.objects.update_or_create(slug={SEED_SLUG!r}, defaults={{'name': 'Hinário Teste Fase 2x', 'owner_name': 'Mestre Teste', 'is_published': True, 'published_at': timezone.now(), 'priority': 'P2', 'is_featured': True}});"
        "h1, _ = Hymn.objects.update_or_create(hymn_book=hb, number=1, defaults={'title': 'Lua Branca', 'text': 'Lua branca da luz serena\\nQue clareia o meu caminho', 'style': 'Valsa', 'review_status': 'reviewed'});"
        "Hymn.objects.update_or_create(hymn_book=hb, number=2, defaults={'title': 'Tuperci', 'text': 'Tuperci'});"
        # Seeds adicionais para o workspace ficar rico
        f"HymnBook.objects.filter(slug__startswith='shot-').delete();"
        "hbA = HymnBook.objects.create(name='Z Urgente', slug='shot-p1', owner_name='Padrinho A', is_published=False, priority='P1', is_featured=True);"
        "Hymn.objects.create(hymn_book=hbA, number=1, title='H1', text='a', style='Marcha', review_status='reviewed');"
        "Hymn.objects.create(hymn_book=hbA, number=2, title='H2', text='b');"
        "hbB = HymnBook.objects.create(name='Z Atencao', slug='shot-p2', owner_name='Madrinha B', is_published=False, priority='P2');"
        "Hymn.objects.create(hymn_book=hbB, number=1, title='H1', text='a');"
        "hbC = HymnBook.objects.create(name='Z Calmo', slug='shot-p3', owner_name='Visitante C', is_published=False, priority='P3');"
        "Hymn.objects.create(hymn_book=hbC, number=1, title='H1', text='a');"
        # Output: slug do detail + pk do hino 1
        "print(hb.slug + '|' + str(h1.pk))"
    )
    out = _shell(code)
    book_slug, hymn_pk = out.split("|")
    return book_slug.strip(), hymn_pk.strip()


def _session_for(email: str) -> str:
    code = (
        "from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY;"
        "from django.contrib.sessions.backends.db import SessionStore;"
        "from apps.users.models import User;"
        f"u = User.objects.get(email={email!r});"
        "s = SessionStore();"
        "s[SESSION_KEY] = str(u.pk);"
        "s[BACKEND_SESSION_KEY] = 'django.contrib.auth.backends.ModelBackend';"
        "s[HASH_SESSION_KEY] = u.get_session_auth_hash();"
        "s.save();"
        "print(s.session_key)"
    )
    return _shell(code)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    book_slug, hymn_pk = _ensure_seed()
    sessionid = _session_for("teste2e@example.com")

    targets = [
        # nome → URL relativa
        ("01-workspace-list", "/editor/hinarios/"),
        ("02-workspace-list-priority-p1", "/editor/hinarios/?priority=P1"),
        ("03-workspace-list-sort-audio-asc", "/editor/hinarios/?sort=audio:asc"),
        ("04-workspace-list-combined", "/editor/hinarios/?priority=P1&sort=audio:asc"),
        ("05-hymnbook-detail-with-staff-strip", f"/hinarios/{book_slug}/"),
        ("06-hymn-detail-no-origem", f"/hinos/{hymn_pk}/"),
        ("07-revise-hymn-no-ocr-toggle", f"/editor/hinos/{hymn_pk}/revisar/"),
        ("08-home-with-cta-pill", "/"),
    ]

    print(f"Saving screenshots to: {OUT_DIR}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        # Esconde Debug Toolbar antes do primeiro paint
        context.add_init_script(
            "document.addEventListener('DOMContentLoaded', function () {"
            "  var el = document.getElementById('djDebug');"
            "  if (el) el.remove();"
            "});"
        )
        # Inject session
        context.add_cookies([{"name": "sessionid", "value": sessionid, "domain": "localhost", "path": "/"}])
        page = context.new_page()

        for name, url in targets:
            full = f"{BASE_URL}{url}"
            print(f"  → {name}  ({full})")
            page.goto(full, wait_until="networkidle")
            # Pequeno wait pra fontes/imagens estabilizarem
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT_DIR / f"{name}.png"), full_page=True)

        browser.close()

    print(f"\n✓ {len(targets)} screenshots em {OUT_DIR}")


if __name__ == "__main__":
    main()
