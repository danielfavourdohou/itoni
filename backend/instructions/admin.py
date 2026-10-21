from django.contrib import admin
from django.utils import timezone

from .models import ApiCallLog, AudioClip, Instruction, InstructionItem, Reply, Template, TemplateTranslation


class TranslationInline(admin.TabularInline):
    model = TemplateTranslation
    extra = 0
    fields = ("language", "text", "status", "uses_fallback", "is_mock")
    readonly_fields = ("uses_fallback", "is_mock")


@admin.register(Template)
class TemplateAdmin(admin.ModelAdmin):
    list_display = ("key", "kind", "title", "is_active", "position")
    list_filter = ("kind", "is_active")
    inlines = [TranslationInline]


@admin.action(description="Mark selected translations as reviewed and approved")
def approve(modeladmin, request, queryset):
    queryset.update(status=TemplateTranslation.Status.APPROVED, reviewed_by=request.user, reviewed_at=timezone.now())


@admin.register(TemplateTranslation)
class TemplateTranslationAdmin(admin.ModelAdmin):
    list_display = ("template", "language", "status", "uses_fallback", "is_mock", "updated_at")
    list_filter = ("status", "language", "is_mock")
    search_fields = ("template__key", "text")
    actions = [approve]


class ItemInline(admin.TabularInline):
    model = InstructionItem
    extra = 0
    fields = ("template", "values", "rendered_text", "audio")
    readonly_fields = fields


@admin.register(Instruction)
class InstructionAdmin(admin.ModelAdmin):
    list_display = ("patient_label", "language", "created_by", "created_at", "expires_at")
    readonly_fields = ("token",)
    inlines = [ItemInline]


@admin.register(Reply)
class ReplyAdmin(admin.ModelAdmin):
    list_display = ("instruction", "status", "is_resolved", "is_mock", "created_at")
    list_filter = ("status", "is_resolved")
    exclude = ("original_audio", "converted_audio")


@admin.register(AudioClip)
class AudioClipAdmin(admin.ModelAdmin):
    list_display = ("language", "voice", "short_text", "is_mock", "created_at")
    exclude = ("data",)

    @admin.display(description="Text")
    def short_text(self, obj):
        return obj.text[:60]


@admin.register(ApiCallLog)
class ApiCallLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "kind", "language", "cached", "mocked", "status_code", "latency_ms", "error")
    list_filter = ("kind", "cached", "mocked", "status_code")
