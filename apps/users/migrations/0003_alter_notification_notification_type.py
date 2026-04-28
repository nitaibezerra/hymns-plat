from django.db import migrations, models


def delete_comment_notifications(apps, schema_editor):
    Notification = apps.get_model("users", "Notification")
    Notification.objects.filter(notification_type="comment").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_notification_userfollow"),
        ("hymns", "0007_delete_comment"),
    ]

    operations = [
        migrations.RunPython(delete_comment_notifications, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="notification",
            name="notification_type",
            field=models.CharField(
                choices=[
                    ("follow", "Novo seguidor"),
                    ("favorite", "Favorito"),
                    ("upload_approved", "Upload aprovado"),
                    ("audio_approved", "Áudio aprovado"),
                ],
                default="favorite",
                max_length=20,
                verbose_name="Tipo",
            ),
        ),
    ]
