from django.urls import path

from . import views, views_social

app_name = "hymns"

urlpatterns = [
    path("", views.home_view, name="home"),
    path("hinarios/", views.HymnBookListView.as_view(), name="hymnbook_list"),
    # Create rota antes de <slug> para evitar conflito
    path("hinarios/novo/", views.hymnbook_create_view, name="hymnbook_create"),
    path("hinarios/<slug:slug>/editar/", views.hymnbook_edit_view, name="hymnbook_edit"),
    path("hinarios/<slug:slug>/deletar/", views.hymnbook_delete_view, name="hymnbook_delete"),
    path("hinarios/<slug:slug>/hinos/novo/", views.hymn_create_view, name="hymn_create"),
    path("hinarios/<slug:slug>/", views.HymnBookDetailView.as_view(), name="hymnbook_detail"),
    path("hinos/<uuid:pk>/editar/", views.hymn_edit_view, name="hymn_edit"),
    path("hinos/<uuid:pk>/deletar/", views.hymn_delete_view, name="hymn_delete"),
    path("hinos/<uuid:pk>/", views.HymnDetailView.as_view(), name="hymn_detail"),
    path("busca/", views.search_view, name="search"),
    # Social features
    path("hinos/<uuid:hymn_id>/favoritar/", views_social.toggle_favorite, name="toggle_favorite"),
    path("hinos/<uuid:hymn_id>/upload-audio/", views_social.upload_audio, name="upload_audio"),
    path("audios/<uuid:audio_id>/download/", views_social.download_audio, name="download_audio"),
]
