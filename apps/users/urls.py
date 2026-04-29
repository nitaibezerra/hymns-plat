"""
URLs for the users app.
"""

from django.urls import path

from . import api_views, views, views_social

app_name = "users"

urlpatterns = [
    path("perfil/<str:username>/", views.profile_view, name="profile"),
    path("perfil/<str:username>/editar/", views.profile_edit_view, name="profile_edit"),
    # Upload flow
    path("contribuir/", views.upload_view, name="upload"),
    path("contribuir/processando/", views.upload_processing_view, name="upload_processing"),
    path(
        "contribuir/ocr-status/<uuid:task_id>/",
        views.upload_ocr_status_view,
        name="upload_ocr_status",
    ),
    path("contribuir/desambiguar/", views.upload_disambiguate_view, name="upload_disambiguate"),
    path("contribuir/preview/", views.upload_preview_view, name="upload_preview"),
    path("contribuir/confirmar/", views.upload_confirm_view, name="upload_confirm"),
    # Social features
    path("perfil/<str:username>/seguir/", views_social.toggle_follow, name="toggle_follow"),
    path("perfil/<str:username>/seguindo/", views_social.following_list, name="following_list"),
    path("perfil/<str:username>/seguidores/", views_social.followers_list, name="followers_list"),
    path("notificacoes/", views_social.notifications_list, name="notifications"),
    path(
        "notificacoes/<uuid:notification_id>/marcar-lida/",
        views_social.mark_notification_read,
        name="mark_notification_read",
    ),
    path("notificacoes/nao-lidas/", views_social.unread_notifications_count, name="unread_notifications_count"),
    # API endpoints (Marco 2.0.3)
    path("api/users/<str:username>/heatmap/", api_views.api_user_heatmap, name="api_user_heatmap"),
]
