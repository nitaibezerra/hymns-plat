"""Signals para o app users.

`import_google_avatar` baixa a foto de perfil do Google quando o usuário vincula a conta
pela primeira vez. Falhas de rede são silenciosas — o login não pode quebrar por causa
de uma imagem.
"""

import requests
from allauth.socialaccount.signals import social_account_added
from django.core.files.base import ContentFile
from django.dispatch import receiver


@receiver(social_account_added)
def import_google_avatar(sender, request, sociallogin, **kwargs):
    if sociallogin.account.provider != "google":
        return
    user = sociallogin.user
    if user.avatar:
        return
    picture_url = sociallogin.account.extra_data.get("picture")
    if not picture_url:
        return
    try:
        resp = requests.get(picture_url, timeout=5)
        resp.raise_for_status()
    except requests.RequestException:
        return
    user.avatar.save(f"google-{user.pk}.jpg", ContentFile(resp.content), save=True)
