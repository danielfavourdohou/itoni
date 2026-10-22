"""Response shapes for the API, as plain functions returning dicts.

Keep these in step with frontend/src/lib/types.ts.
"""

from __future__ import annotations

from django.conf import settings
from django.urls import reverse

from instructions.models import Instruction, InstructionItem, Template, TemplateTranslation

REVIEW_MISSING = "missing"  # no translation stored yet; treated as unreviewed


def mock_mode() -> bool:
    return bool(settings.NKENNE["MOCK"])


def user_to_dict(user) -> dict:
    return {"id": user.id, "username": user.username}


def session_to_dict(user) -> dict:
    return {"user": user_to_dict(user), "mock_mode": mock_mode()}


def patient_url(request, instruction: Instruction) -> str:
    """Frontend route the QR code points to. FRONTEND_BASE_URL wins so tunnels get https."""
    path = f"/p/{instruction.token}"
    base = settings.ITONI["FRONTEND_BASE_URL"]
    return f"{base}{path}" if base else request.build_absolute_uri(path)


def template_to_dict(template: Template) -> dict:
    return {
        "key": template.key,
        "title": template.title,
        "english_text": template.english_text,
        "placeholders": template.placeholders,
    }


def instruction_summary(instruction: Instruction) -> dict:
    """Needs the item_count and has_unreviewed annotations (see api.staff.instruction_list_qs)."""
    return {
        "id": instruction.id,
        "patient_label": instruction.patient_label,
        "follow_up_date": instruction.follow_up_date,
        "created_at": instruction.created_at,
        "expires_at": instruction.expires_at,
        "is_expired": instruction.is_expired,
        "item_count": instruction.item_count,
        "has_unreviewed": instruction.has_unreviewed,
    }


def item_to_dict(item: InstructionItem, translation: TemplateTranslation | None) -> dict:
    return {
        "id": item.id,
        "template_key": item.template.key,
        "title": item.template.title,
        "english_text": item.english_text,
        "swahili_text": item.rendered_text,
        "values": item.values,
        "audio_url": reverse("api-item-audio", args=[item.instruction_id, item.id]) if item.audio_id else None,
        "review_status": translation.status if translation else REVIEW_MISSING,
        "uses_fallback": bool(translation and translation.uses_fallback),
    }


def instruction_to_dict(request, instruction: Instruction) -> dict:
    items = list(instruction.items.select_related("template"))
    translations = {
        tr.template_id: tr for tr in TemplateTranslation.objects.filter(
            template_id__in={i.template_id for i in items}, language=instruction.language,
        )
    }
    item_dicts = [item_to_dict(i, translations.get(i.template_id)) for i in items]
    return {
        "id": instruction.id,
        "patient_label": instruction.patient_label,
        "language": instruction.language,
        "follow_up_date": instruction.follow_up_date,
        "created_at": instruction.created_at,
        "expires_at": instruction.expires_at,
        "is_expired": instruction.is_expired,
        "patient_url": patient_url(request, instruction),
        "qr_url": reverse("api-instruction-qr", args=[instruction.id]),
        "has_unreviewed": any(i["review_status"] != TemplateTranslation.Status.APPROVED for i in item_dicts),
        "items": item_dicts,
    }
