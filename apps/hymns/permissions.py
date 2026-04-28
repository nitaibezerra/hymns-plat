"""
Permissões do app hymns.

Centraliza as checagens usadas em views e templates. O grupo `editor` (criado por
data migration) recebe `can_review_any_hymnbook` e `can_publish_hymnbook` —
permitindo que editores revisem/publiquem hinários de outros donos sem serem
superusuários globais.
"""

from __future__ import annotations


def _is_authenticated(user) -> bool:
    return bool(user and getattr(user, "is_authenticated", False))


def can_edit_hymnbook(user, hymnbook) -> bool:
    """True se `user` pode editar/deletar `hymnbook` ou seus hinos."""
    if not _is_authenticated(user):
        return False
    if user.is_superuser:
        return True
    if user == hymnbook.owner_user:
        return True
    return user.has_perm("hymns.can_review_any_hymnbook")


def can_publish_hymnbook(user, hymnbook) -> bool:
    """True se `user` pode publicar/despublicar `hymnbook`."""
    if not _is_authenticated(user):
        return False
    if user.is_superuser:
        return True
    if user == hymnbook.owner_user:
        return True
    return user.has_perm("hymns.can_publish_hymnbook")
