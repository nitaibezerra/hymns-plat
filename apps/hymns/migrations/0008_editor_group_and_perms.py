# Marco 1.1 — adiciona permissões custom em HymnBook e cria grupo `editor`.

from django.db import migrations


def create_editor_group(apps, schema_editor):
    """
    Garante que as permissions custom existem e cria o grupo `editor` com elas.

    Em condições normais o `post_migrate` signal do app auth cria as Permission
    objects automaticamente, mas dentro de uma data migration precisamos
    criá-las explicitamente para podermos referenciá-las antes do fim do
    `migrate`. `get_or_create` torna a operação idempotente.
    """
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")
    HymnBook = apps.get_model("hymns", "HymnBook")

    content_type = ContentType.objects.get_for_model(HymnBook)
    review, _ = Permission.objects.get_or_create(
        codename="can_review_any_hymnbook",
        content_type=content_type,
        defaults={"name": "Pode revisar/editar qualquer hinário"},
    )
    publish, _ = Permission.objects.get_or_create(
        codename="can_publish_hymnbook",
        content_type=content_type,
        defaults={"name": "Pode publicar/despublicar hinários"},
    )

    group, _ = Group.objects.get_or_create(name="editor")
    group.permissions.add(review, publish)


def remove_editor_group(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")

    Group.objects.filter(name="editor").delete()
    Permission.objects.filter(
        codename__in=["can_review_any_hymnbook", "can_publish_hymnbook"],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("hymns", "0007_delete_comment"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="hymnbook",
            options={
                "ordering": ["name"],
                "permissions": [
                    ("can_review_any_hymnbook", "Pode revisar/editar qualquer hinário"),
                    ("can_publish_hymnbook", "Pode publicar/despublicar hinários"),
                ],
                "verbose_name": "Hinário",
                "verbose_name_plural": "Hinários",
            },
        ),
        migrations.RunPython(create_editor_group, remove_editor_group),
    ]
