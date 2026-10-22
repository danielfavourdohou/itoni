"""Translated interface labels for the patient screen.

Every patient-facing string comes from here, so nothing on that screen is hardcoded English.
"""

from __future__ import annotations

from django.db.models import FilteredRelation, Q

from instructions.models import Template


def get_labels(language: str) -> dict[str, str]:
    """All active label_* texts in one query. A missing translation falls back to the English,
    which is better than a blank button; translate_templates fills the gap."""
    rows = (
        Template.objects.filter(kind=Template.Kind.LABEL, is_active=True)
        .annotate(tr=FilteredRelation("translations", condition=Q(translations__language=language)))
        .values_list("key", "english_text", "tr__text")
    )
    return {key: translated or english for key, english, translated in rows}
