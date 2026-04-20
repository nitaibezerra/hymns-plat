from django.apps import AppConfig


class HymnsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.hymns"

    def ready(self):
        from apps.hymns import signals  # noqa: F401
