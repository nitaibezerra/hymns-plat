"""Custom adapters para o app users.

`CustomAccountAdapter` desabilita signup tradicional (email/senha). O site
público é Google-only; admins (`/django-admin/`, `/admin/`) seguem com login
próprio fora do allauth.
"""

from allauth.account.adapter import DefaultAccountAdapter


class CustomAccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return False
