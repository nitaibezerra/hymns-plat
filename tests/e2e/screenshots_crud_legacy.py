"""Screenshots das telas CRUD legadas pós-redesign.

Tira shots de:
  - Editar Hinário (staff): card "Curadoria editorial" presente
  - Editar Hinário (non-staff): card ausente
  - Editar Hinário (staff, tentativa de publicar com readiness falhando): banner rust
  - Editar Hino (staff): coluna metadados + LETRA, chips presentes
  - Editar Hino com chip clicado: estado is-active na pill

Pré-requisitos:
- `uv run python manage.py runserver 9000` rodando
- Postgres up

Uso:
    uv run python tests/e2e/screenshots_crud_legacy.py
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = PROJECT_ROOT / "_design/complete_crud/screenshots"
BASE_URL = "http://localhost:9000"


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


def _ensure_seed() -> tuple[str, str, str, str]:
    """Seeda 1 hinário publicado completo (`crud-shot`) + 1 hinário vazio
    (`crud-shot-vazio`) + 1 staff user + 1 non-staff editor.

    Retorna (book_slug_completo, book_slug_vazio, hymn_pk_para_edit, hymn_pk_para_chip)."""
    code = (
        "from django.contrib.auth.models import Group;"
        "from apps.hymns.models import Hymn, HymnBook;"
        "from apps.users.models import User;"
        "from django.utils import timezone;"
        "ed, _ = Group.objects.get_or_create(name='editor');"
        # staff user
        "u_staff, _ = User.objects.get_or_create(email='staffshot@example.com',"
        " defaults={'username': 'staffshot', 'is_active': True});"
        "u_staff.groups.add(ed); u_staff.is_staff = True; u_staff.save();"
        # non-staff editor
        "u_ed, _ = User.objects.get_or_create(email='editshot@example.com',"
        " defaults={'username': 'editshot', 'is_active': True});"
        "u_ed.groups.add(ed); u_ed.is_staff = False; u_ed.save();"
        # Hinário 1 - completo, publicável (já publicado)
        "hb, _ = HymnBook.objects.update_or_create(slug='crud-shot', defaults={"
        " 'name': 'O Convite (shot)', 'owner_name': 'Madrinha Júlia',"
        " 'description': 'Hinário recebido em 2002 — recortes da floresta.',"
        " 'is_published': True, 'published_at': timezone.now(),"
        " 'priority': 'P2', 'is_featured': True, 'owner_user': u_staff,"
        " });"
        "Hymn.objects.update_or_create(hymn_book=hb, number=1, defaults={"
        " 'title': 'Convite', 'text': 'Estou aqui, eu vim para dizer\\n"
        "Estou aqui, eu vim para ensinar\\nEu digo para todos meus irmãos\\n"
        "É numa noite de São João\\nQue vamos se transformar', 'style': 'Marcha'});"
        "Hymn.objects.update_or_create(hymn_book=hb, number=2, defaults={"
        " 'title': 'Floresta', 'text': 'Lá nas matas eu mirei', 'style': 'Valsa'});"
        # Hinário 2 - vazio (sem hino, sem desc) pra testar banner de readiness
        "hb_vazio, _ = HymnBook.objects.update_or_create(slug='crud-shot-vazio', defaults={"
        " 'name': 'Vazio (shot)', 'owner_name': 'Sem Dono',"
        " 'description': '', 'is_published': False, 'priority': 'P3', 'is_featured': False});"
        # PK do hino 1 do hinário completo
        "h = Hymn.objects.get(hymn_book=hb, number=1);"
        "print(hb.slug + '|' + hb_vazio.slug + '|' + str(h.pk) + '|' + str(u_staff.pk))"
    )
    out = _shell(code)
    book_slug, vazio_slug, hymn_pk, staff_pk = out.split("|")
    return book_slug.strip(), vazio_slug.strip(), hymn_pk.strip(), staff_pk.strip()


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
    book_slug, vazio_slug, hymn_pk, _staff_pk = _ensure_seed()
    sess_staff = _session_for("staffshot@example.com")
    sess_ed = _session_for("editshot@example.com")

    print(f"Saving screenshots to: {OUT_DIR}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # === Sessão STAFF: 1280x900 desktop ===
        ctx_staff = browser.new_context(viewport={"width": 1280, "height": 900})
        ctx_staff.add_cookies(
            [{"name": "sessionid", "value": sess_staff, "domain": "localhost", "path": "/"}]
        )
        ctx_staff.add_init_script(
            "document.addEventListener('DOMContentLoaded', function () {"
            "  var el = document.getElementById('djDebug');"
            "  if (el) el.remove();"
            "});"
        )
        page = ctx_staff.new_page()

        targets_staff = [
            ("01-hinario-edit-staff", f"/hinarios/{book_slug}/editar/"),
            ("02-hinario-edit-staff-vazio-publicar", f"/hinarios/{vazio_slug}/editar/"),
            ("03-hino-edit-staff", f"/hinos/{hymn_pk}/editar/"),
        ]
        for name, url in targets_staff:
            full = f"{BASE_URL}{url}"
            print(f"  → {name}  ({full})")
            page.goto(full, wait_until="networkidle")
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT_DIR / f"{name}.png"), full_page=True)

        # 04 — Hinário vazio, marcar Publicado + submit → banner rust
        print("  → 04-hinario-edit-staff-banner-publish")
        page.goto(f"{BASE_URL}/hinarios/{vazio_slug}/editar/", wait_until="networkidle")
        page.wait_for_timeout(200)
        # marca o checkbox de Publicado
        page.click('input[name="is_published"]')
        page.click('button[type="submit"]')
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT_DIR / "04-hinario-edit-staff-banner-publish.png"), full_page=True)

        # 05 — Hino edit, clica num chip de estilo → estado is-active
        print("  → 05-hino-edit-chip-active")
        page.goto(f"{BASE_URL}/hinos/{hymn_pk}/editar/", wait_until="networkidle")
        page.wait_for_timeout(200)
        # clica no primeiro chip de Repetições
        rep_chip = page.locator('.suggestion-chips[data-target$="repetitions"] .shortcut-pill').first
        rep_chip.click()
        page.wait_for_timeout(200)
        page.screenshot(path=str(OUT_DIR / "05-hino-edit-chip-active.png"), full_page=True)

        # 06 — Mobile vista do edit hinário
        ctx_mobile = browser.new_context(viewport={"width": 390, "height": 844})
        ctx_mobile.add_cookies(
            [{"name": "sessionid", "value": sess_staff, "domain": "localhost", "path": "/"}]
        )
        ctx_mobile.add_init_script(
            "document.addEventListener('DOMContentLoaded', function () {"
            "  var el = document.getElementById('djDebug');"
            "  if (el) el.remove();"
            "});"
        )
        page_m = ctx_mobile.new_page()
        for name, url in [
            ("06-hinario-edit-mobile", f"/hinarios/{book_slug}/editar/"),
            ("07-hino-edit-mobile", f"/hinos/{hymn_pk}/editar/"),
        ]:
            full = f"{BASE_URL}{url}"
            print(f"  → {name}  ({full})")
            page_m.goto(full, wait_until="networkidle")
            page_m.wait_for_timeout(300)
            page_m.screenshot(path=str(OUT_DIR / f"{name}.png"), full_page=True)

        # === Sessão NON-STAFF (editor): tela sem o card staff ===
        ctx_ed = browser.new_context(viewport={"width": 1280, "height": 900})
        ctx_ed.add_cookies(
            [{"name": "sessionid", "value": sess_ed, "domain": "localhost", "path": "/"}]
        )
        ctx_ed.add_init_script(
            "document.addEventListener('DOMContentLoaded', function () {"
            "  var el = document.getElementById('djDebug');"
            "  if (el) el.remove();"
            "});"
        )
        page_e = ctx_ed.new_page()
        print("  → 08-hinario-edit-non-staff")
        page_e.goto(f"{BASE_URL}/hinarios/{book_slug}/editar/", wait_until="networkidle")
        page_e.wait_for_timeout(300)
        page_e.screenshot(path=str(OUT_DIR / "08-hinario-edit-non-staff.png"), full_page=True)

        browser.close()

    print(f"\n✓ screenshots em {OUT_DIR}")


if __name__ == "__main__":
    main()
