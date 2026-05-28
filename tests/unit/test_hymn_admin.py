"""
Unit tests for HymnBook and Hymn Admin classes.
"""

import pytest
from django.contrib import admin

from apps.hymns.admin import HymnAdmin, HymnBookAdmin, HymnInline
from apps.hymns.models import Hymn, HymnBook


@pytest.mark.django_db
class TestHymnBookAdmin:
    """Tests for HymnBookAdmin class."""

    def test_hymnbook_admin_registered(self):
        """Test that HymnBookAdmin is registered."""
        assert isinstance(admin.site._registry[HymnBook], HymnBookAdmin)

    def test_list_display_fields(self):
        """Test correct list_display configuration."""
        expected = [
            "name",
            "intro_name",
            "owner_name",
            "owner_user",
            "priority",
            "is_featured",
            "hymn_count",
            "created_at",
        ]
        assert HymnBookAdmin.list_display == expected

    def test_search_fields(self):
        """Test search_fields configuration."""
        expected = ["name", "intro_name", "owner_name", "description"]
        assert HymnBookAdmin.search_fields == expected

    def test_list_filter_fields(self):
        """Test list_filter configuration."""
        expected = ["priority", "is_featured", "is_published", "created_at", "owner_name"]
        assert HymnBookAdmin.list_filter == expected

    def test_list_editable_fields(self):
        """Curadoria editorial (priority + featured) editável direto na lista."""
        assert HymnBookAdmin.list_editable == ["priority", "is_featured"]

    def test_readonly_fields(self):
        """Test readonly_fields configuration."""
        expected = ["id", "created_at", "updated_at", "hymn_count"]
        assert HymnBookAdmin.readonly_fields == expected

    def test_prepopulated_fields(self):
        """Test prepopulated_fields configuration."""
        expected = {"slug": ("name",)}
        assert HymnBookAdmin.prepopulated_fields == expected

    def test_fieldsets_structure(self):
        """Test fieldsets configuration structure."""
        # 4 grupos: Básicas, Proprietário, Curadoria editorial, Metadados
        assert len(HymnBookAdmin.fieldsets) == 4

        # Informações Básicas
        assert HymnBookAdmin.fieldsets[0][0] == "Informações Básicas"
        assert "name" in HymnBookAdmin.fieldsets[0][1]["fields"]
        assert "slug" in HymnBookAdmin.fieldsets[0][1]["fields"]

        # Proprietário
        assert HymnBookAdmin.fieldsets[1][0] == "Proprietário"
        assert "owner_name" in HymnBookAdmin.fieldsets[1][1]["fields"]
        assert "owner_user" in HymnBookAdmin.fieldsets[1][1]["fields"]

        # Curadoria editorial
        assert HymnBookAdmin.fieldsets[2][0] == "Curadoria editorial"
        assert "priority" in HymnBookAdmin.fieldsets[2][1]["fields"]
        assert "is_featured" in HymnBookAdmin.fieldsets[2][1]["fields"]

        # Metadados (último)
        assert HymnBookAdmin.fieldsets[3][0] == "Metadados"
        assert "id" in HymnBookAdmin.fieldsets[3][1]["fields"]
        assert "collapse" in HymnBookAdmin.fieldsets[3][1]["classes"]

    def test_inlines_configuration(self):
        """Test that HymnBookVersionInline and HymnInline are properly configured."""
        assert len(HymnBookAdmin.inlines) == 2
        assert HymnInline in HymnBookAdmin.inlines


@pytest.mark.django_db
class TestHymnAdmin:
    """Tests for HymnAdmin class."""

    def test_hymn_admin_registered(self):
        """Test that HymnAdmin is registered."""
        assert isinstance(admin.site._registry[Hymn], HymnAdmin)

    def test_list_display_fields(self):
        """Test correct list_display configuration."""
        expected = ["number", "title", "hymn_book", "style", "received_at", "created_at"]
        assert HymnAdmin.list_display == expected

    def test_search_fields(self):
        """Test search_fields configuration."""
        expected = ["title", "text", "hymn_book__name"]
        assert HymnAdmin.search_fields == expected

    def test_list_filter_fields(self):
        """Test list_filter configuration."""
        expected = ["hymn_book", "style", "received_at", "created_at"]
        assert HymnAdmin.list_filter == expected

    def test_readonly_fields(self):
        """Test readonly_fields configuration."""
        expected = ["id", "created_at", "updated_at", "full_title"]
        assert HymnAdmin.readonly_fields == expected

    def test_list_select_related(self):
        """Test list_select_related configuration."""
        expected = ["hymn_book"]
        assert HymnAdmin.list_select_related == expected

    def test_fieldsets_structure(self):
        """Test fieldsets configuration structure."""
        assert len(HymnAdmin.fieldsets) == 3

        # Test first fieldset - Informações Básicas
        assert HymnAdmin.fieldsets[0][0] == "Informações Básicas"
        assert "hymn_book" in HymnAdmin.fieldsets[0][1]["fields"]
        assert "number" in HymnAdmin.fieldsets[0][1]["fields"]
        assert "title" in HymnAdmin.fieldsets[0][1]["fields"]
        assert "text" in HymnAdmin.fieldsets[0][1]["fields"]

        # Test second fieldset - Detalhes
        assert HymnAdmin.fieldsets[1][0] == "Detalhes"
        assert "style" in HymnAdmin.fieldsets[1][1]["fields"]
        assert "received_at" in HymnAdmin.fieldsets[1][1]["fields"]

        # Test third fieldset - Metadados
        assert HymnAdmin.fieldsets[2][0] == "Metadados"
        assert "id" in HymnAdmin.fieldsets[2][1]["fields"]
        assert "full_title" in HymnAdmin.fieldsets[2][1]["fields"]
        assert "collapse" in HymnAdmin.fieldsets[2][1]["classes"]


@pytest.mark.django_db
class TestHymnInline:
    """Tests for HymnInline class."""

    def test_hymn_inline_model(self):
        """Test that HymnInline uses correct model."""
        assert HymnInline.model == Hymn

    def test_hymn_inline_extra(self):
        """Test that HymnInline has no extra forms."""
        assert HymnInline.extra == 0

    def test_hymn_inline_fields(self):
        """Test HymnInline fields configuration."""
        expected = ["number", "title", "style", "received_at"]
        assert HymnInline.fields == expected

    def test_hymn_inline_ordering(self):
        """Test HymnInline ordering configuration."""
        expected = ["number"]
        assert HymnInline.ordering == expected
