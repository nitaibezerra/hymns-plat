"""
Marco 5.A½ · Tarefa B8 — `apps/api/permissions.py` e `apps/api/context.py`.

Testes de unidade dos helpers em si (a migração dos call sites é refactor: a
suíte inteira continua verde sem teste novo).
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from graphql import GraphQLError

from apps.api.context import request_from_info, user_from_info
from apps.api.errors import PERMISSION_DENIED_MESSAGE, PermissionDeniedError
from apps.api.permissions import gate, is_authenticated, is_editor_or_admin, is_staff, require

# ---------- context ----------


def test_request_from_info_reads_dict_context():
    """Integração Django do Strawberry entrega o contexto como dict."""
    request = object()
    info = SimpleNamespace(context={"request": request})
    assert request_from_info(info) is request


def test_request_from_info_reads_object_context():
    """Em outras versões o contexto é um objeto com `.request`."""
    request = object()
    info = SimpleNamespace(context=SimpleNamespace(request=request))
    assert request_from_info(info) is request


def test_user_from_info_returns_request_user():
    user = object()
    info = SimpleNamespace(context={"request": SimpleNamespace(user=user)})
    assert user_from_info(info) is user


# ---------- gate ----------


def test_gate_returns_none_when_check_passes():
    assert gate(object(), lambda user: True) is None


def test_gate_returns_permission_denied_when_check_fails():
    denied = gate(object(), lambda user: False)
    assert isinstance(denied, PermissionDeniedError)
    assert denied.message == PERMISSION_DENIED_MESSAGE


def test_gate_forwards_extra_args_to_check():
    """`gate(user, can_edit_hymnbook, hymnbook)` — checks de objeto precisam
    receber o objeto."""
    seen = []

    def check(user, hymnbook, extra):
        seen.append((user, hymnbook, extra))
        return True

    sentinel_user, sentinel_book = object(), object()
    assert gate(sentinel_user, check, sentinel_book, "extra") is None
    assert seen == [(sentinel_user, sentinel_book, "extra")]


def test_gate_honors_custom_message():
    denied = gate(object(), lambda user: False, message="É preciso estar autenticado para enviar áudios.")
    assert denied.message == "É preciso estar autenticado para enviar áudios."


def test_gate_custom_message_is_ignored_when_check_passes():
    assert gate(object(), lambda user: True, message="nunca aparece") is None


# ---------- require ----------


def test_require_is_silent_when_check_passes():
    assert require(object(), lambda user: True) is None


def test_require_raises_graphql_error_when_check_fails():
    with pytest.raises(GraphQLError) as excinfo:
        require(object(), lambda user: False)
    assert str(excinfo.value) == PERMISSION_DENIED_MESSAGE


def test_require_raises_with_custom_message():
    with pytest.raises(GraphQLError) as excinfo:
        require(object(), lambda user: False, message="Sem acesso ao workspace.")
    assert str(excinfo.value) == "Sem acesso ao workspace."


def test_require_forwards_extra_args_to_check():
    sentinel = object()
    seen = []
    require(object(), lambda user, obj: seen.append(obj) or True, sentinel)
    assert seen == [sentinel]


# ---------- checks reexportados ----------


@pytest.mark.django_db
def test_is_editor_or_admin_matches_domain_helper(user_factory, django_user_model):
    from django.contrib.auth.models import AnonymousUser, Group

    comum = user_factory(email="comum@example.com")
    editor = user_factory(email="editor2@example.com")
    editor.groups.add(Group.objects.get(name="editor"))
    admin = user_factory(email="admin2@example.com")
    admin.is_superuser = True
    admin.save()

    assert is_editor_or_admin(AnonymousUser()) is False
    assert is_editor_or_admin(comum) is False
    assert is_editor_or_admin(editor) is True
    assert is_editor_or_admin(admin) is True


@pytest.mark.django_db
def test_is_authenticated_and_is_staff(user_factory):
    from django.contrib.auth.models import AnonymousUser

    comum = user_factory(email="comum2@example.com")
    staff = user_factory(email="staff@example.com")
    staff.is_staff = True
    staff.save()

    assert is_authenticated(AnonymousUser()) is False
    assert is_authenticated(comum) is True

    assert is_staff(AnonymousUser()) is False
    assert is_staff(comum) is False
    assert is_staff(staff) is True
