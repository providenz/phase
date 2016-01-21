# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.contrib import admin

from documents.models import Document


class DocumentAdmin(admin.ModelAdmin):
    list_display = ('document_key', 'title', 'category', 'current_revision',
                    'created_on')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        """Disable document editing, but allows document listing."""
        return False if obj else True


admin.site.register(Document, DocumentAdmin)
