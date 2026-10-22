"""Human review of template translations.

A dose sentence is safety-critical, so an edit must keep the placeholders the renderer fills
({dose}, {drug}, ...). An edited text is human-written: it is marked non-mock so a later
`translate_templates --live` cannot overwrite the reviewer's work. Audio needs no cleanup:
its cache key includes the text, so new wording gets new audio on next use.
"""

from __future__ import annotations

from django.db.models import FilteredRelation, Q, QuerySet
from django.utils import timezone

from instructions.models import Template, TemplateTranslation
from instructions.services.translation import PLACEHOLDER_RE

TEXT_MAX = 1000


class ReviewError(Exception):
    def __init__(self, message: str, fields: dict[str, list[str]] | None = None):
        super().__init__(message)
        self.message = message
        self.fields = fields or {}


def templates_with_translation(language: str) -> QuerySet[Template]:
    """Every active template with its translation (if any) in one query, labels after instructions."""
    return (
        Template.objects.filter(is_active=True)
        .annotate(tr=FilteredRelation("translations", condition=Q(translations__language=language)))
        .select_related("tr", "tr__reviewed_by")
        .order_by("kind", "position")
    )


def _placeholder_errors(template: Template, text: str, uses_fallback: bool) -> list[str]:
    found = PLACEHOLDER_RE.findall(text)
    unknown = sorted(set(found) - set(template.placeholders))
    if unknown:
        return [f"Unknown placeholder: {', '.join('{' + n + '}' for n in unknown)}."]
    if uses_fallback:
        return []  # fallback wording carries no values; they show in the digits box instead
    problems = [p for p in template.placeholders if found.count(p) != 1]
    if problems:
        return [f"Keep each of these exactly once: {', '.join('{' + p + '}' for p in problems)}."]
    return []


def update_translation(tr: TemplateTranslation, *, user, text: str | None = None,
                       approve: bool | None = None) -> TemplateTranslation:
    """Edit and/or approve. Editing approved text un-approves it unless `approve` is also true."""
    if text is None and approve is None:
        raise ReviewError("Nothing to change: send text, approve, or both.")

    if text is not None:
        if not isinstance(text, str) or not text.strip():
            raise ReviewError("Please fix the highlighted fields.", {"text": ["Enter the Swahili text."]})
        text = text.strip()
        if len(text) > TEXT_MAX:
            raise ReviewError("Please fix the highlighted fields.", {"text": [f"Use at most {TEXT_MAX} characters."]})
        errors = _placeholder_errors(tr.template, text, tr.uses_fallback)
        if errors:
            raise ReviewError("Please fix the highlighted fields.", {"text": errors})
        if text != tr.text:
            tr.text = text
            tr.is_mock = False
            if approve is None and tr.status == TemplateTranslation.Status.APPROVED:
                approve = False  # the reviewed wording changed; it needs a fresh review

    if approve is True:
        if tr.is_mock:
            raise ReviewError("This is a mock translation. Edit it into real Swahili or run the live translation first.")
        tr.status = TemplateTranslation.Status.APPROVED
        tr.reviewed_by = user
        tr.reviewed_at = timezone.now()
    elif approve is False:
        tr.status = TemplateTranslation.Status.MACHINE
        tr.reviewed_by = None
        tr.reviewed_at = None

    tr.save()
    return tr
