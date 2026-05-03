from django.urls import path

from . import api_views, editor_views, views, views_social

app_name = "hymns"

urlpatterns = [
    path("editor/hinarios/", editor_views.editor_hymnbook_list, name="editor_hymnbook_list"),
    path(
        "editor/hinarios/<slug:slug>/",
        editor_views.editor_hymnbook_detail,
        name="editor_hymnbook_detail",
    ),
    path(
        "editor/hinarios/<slug:slug>/proximo/",
        editor_views.editor_next_hymn,
        name="editor_next_hymn",
    ),
    path(
        "editor/hinos/<uuid:pk>/revisar/",
        editor_views.editor_revise_hymn,
        name="editor_revise_hymn",
    ),
    path("editor/audios/", editor_views.editor_pending_audios, name="editor_pending_audios"),
    path("editor/audios/<uuid:pk>/aprovar/", editor_views.editor_approve_audio, name="editor_approve_audio"),
    path("editor/audios/<uuid:pk>/rejeitar/", editor_views.editor_reject_audio, name="editor_reject_audio"),
    path("", views.home_view, name="home"),
    path("hinarios/", views.HymnBookListView.as_view(), name="hymnbook_list"),
    # Create rota antes de <slug> para evitar conflito
    path("hinarios/novo/", views.hymnbook_create_view, name="hymnbook_create"),
    path("hinarios/<slug:slug>/editar/", views.hymnbook_edit_view, name="hymnbook_edit"),
    path("hinarios/<slug:slug>/deletar/", views.hymnbook_delete_view, name="hymnbook_delete"),
    path("hinarios/<slug:slug>/publicar/", views.hymnbook_publish_view, name="hymnbook_publish"),
    path("hinarios/<slug:slug>/publicar/check/", views.hymnbook_publish_check_view, name="hymnbook_publish_check"),
    path("hinarios/<slug:slug>/despublicar/", views.hymnbook_unpublish_view, name="hymnbook_unpublish"),
    path("hinarios/<slug:slug>/hinos/novo/", views.hymn_create_view, name="hymn_create"),
    path("hinarios/<slug:slug>/", views.HymnBookDetailView.as_view(), name="hymnbook_detail"),
    path("hinos/<uuid:pk>/editar/", views.hymn_edit_view, name="hymn_edit"),
    path("hinos/<uuid:pk>/revisar/", views.revise_hymn_view, name="hymn_revise"),
    path("hinos/<uuid:pk>/historico/", views.hymn_history_view, name="hymn_history"),
    path("hinos/<uuid:pk>/deletar/", views.hymn_delete_view, name="hymn_delete"),
    path("hinos/<uuid:pk>/", views.HymnDetailView.as_view(), name="hymn_detail"),
    path("busca/", views.search_view, name="search"),
    # Social features
    path("hinos/<uuid:hymn_id>/favoritar/", views_social.toggle_favorite, name="toggle_favorite"),
    path("hinos/<uuid:hymn_id>/upload-audio/", views_social.upload_audio, name="upload_audio"),
    path("audios/<uuid:audio_id>/download/", views_social.download_audio, name="download_audio"),
    # API endpoints (Marco 2.0.3)
    path("api/stats/global/", api_views.api_global_stats, name="api_global_stats"),
    path("api/editor/resume/", api_views.api_editor_resume, name="api_editor_resume"),
    path("api/hymns/<uuid:pk>/history/", api_views.api_hymn_history, name="api_hymn_history"),
    path("api/hymns/<uuid:pk>/diff/", api_views.api_hymn_diff, name="api_hymn_diff"),
    path("api/hinarios/<slug:slug>/queue/", api_views.api_hymnbook_queue, name="hymnbook_queue_json"),
]
