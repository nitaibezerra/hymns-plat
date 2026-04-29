# Marco 1.2 — adiciona estado de publicação a HymnBook + backfill.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


def backfill_existing_as_published(apps, schema_editor):
    """
    Hinários que já existiam antes desta feature são considerados publicados —
    eles foram cadastrados em um mundo onde o conceito de "rascunho" não
    existia ainda. Marca-os com `is_published=True` e `published_at=now`.
    """
    HymnBook = apps.get_model("hymns", "HymnBook")
    HymnBook.objects.update(is_published=True, published_at=timezone.now())


def noop_reverse(apps, schema_editor):
    """Reversal não desfaz o backfill — preservar histórico de publicação."""


class Migration(migrations.Migration):

    dependencies = [
        ("hymns", "0008_editor_group_and_perms"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="hymnbook",
            name="is_published",
            field=models.BooleanField(
                default=False,
                help_text="Hinário visível em listas/busca para o público",
                verbose_name="Publicado",
            ),
        ),
        migrations.AddField(
            model_name="hymnbook",
            name="published_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="Publicado em"),
        ),
        migrations.AddField(
            model_name="hymnbook",
            name="published_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="published_hymnbooks",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Publicado por",
            ),
        ),
        migrations.RunPython(backfill_existing_as_published, noop_reverse),
    ]
