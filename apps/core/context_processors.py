"""Context processors do app core.

`seo` expõe valores usados pelas meta tags globais em `base.html`:
- `google_site_verification` — token da meta tag de verificação do Google Search
  Console (env `GOOGLE_SITE_VERIFICATION`); vazio em dev, então a tag não renderiza.
- `bing_site_verification` — equivalente para o Bing Webmaster Tools (env
  `BING_SITE_VERIFICATION`).
"""

from __future__ import annotations

from django.conf import settings


def seo(request):
    return {
        "google_site_verification": getattr(settings, "GOOGLE_SITE_VERIFICATION", ""),
        "bing_site_verification": getattr(settings, "BING_SITE_VERIFICATION", ""),
    }
