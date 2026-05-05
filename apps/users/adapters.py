"""Custom adapters para o app users.

`CustomAccountAdapter` desabilita signup tradicional (email/senha). O site
público é Google-only; admins (`/django-admin/`, `/admin/`) seguem com login
próprio fora do allauth.

`CustomSocialAccountAdapter` permite signup via flow social. Sem ele, o
`DefaultSocialAccountAdapter.is_open_for_signup` delega para o account
adapter, herdando o `False` e bloqueando o callback do Google para usuários
novos (que ficam num loop de volta à tela de login).
"""

from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter


class CustomAccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return False


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def is_open_for_signup(self, request, sociallogin):
        return True
