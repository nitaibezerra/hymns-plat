"""
Permissões do app hymns.

Centraliza as checagens usadas em views e templates. O grupo `editor` (criado
por data migration) recebe `can_review_any_hymnbook` e `can_publish_hymnbook`;
qualquer cadastro/edição de hinários e hinos é restrito a Editores e Admins.
Donos comuns (`owner_user`) ficam restritos a consulta — não conferem mais
direito de editar/deletar/publicar.
"""

from __future__ import annotations


def _is_authenticated(user) -> bool:
    return bool(user and getattr(user, "is_authenticated", False))


def _is_editor_or_admin(user) -> bool:
    """True se `user` é superuser ou pertence ao grupo `editor`."""
    if not _is_authenticated(user):
        return False
    if user.is_superuser:
        return True
    return user.has_perm("hymns.can_review_any_hymnbook")


def can_create_hymnbook(user) -> bool:
    """True se `user` pode cadastrar hinários (e, por extensão, hinos)."""
    return _is_editor_or_admin(user)


def can_edit_hymnbook(user, hymnbook) -> bool:
    """True se `user` pode editar/deletar `hymnbook` ou seus hinos."""
    return _is_editor_or_admin(user)


def can_publish_hymnbook(user, hymnbook) -> bool:
    """True se `user` pode publicar/despublicar `hymnbook`."""
    if not _is_authenticated(user):
        return False
    if user.is_superuser:
        return True
    return user.has_perm("hymns.can_publish_hymnbook")
