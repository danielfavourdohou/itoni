"""Fill values into translated templates and build instructions."""

from __future__ import annotations

import logging
from datetime import date

from django.db import transaction

from instructions.models import AudioClip, Instruction, InstructionItem, Template
from instructions.services import audio, nkenne, translation

logger = logging.getLogger(__name__)


def format_value(value) -> str:
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    return str(value).strip()


def render(text: str, values: dict) -> str:
    """Replace {name} with values. Unknown placeholders are left visible, never silently dropped."""
    def repl(m):
        name = m.group(1)
        return format_value(values[name]) if name in values and values[name] not in (None, "") else m.group(0)

    return translation.PLACEHOLDER_RE.sub(repl, text)


def missing_values(template: Template, values: dict) -> list[str]:
    return [p for p in template.placeholders if values.get(p) in (None, "")]


def create_instruction(*, user, patient_label: str, language: str, items: list[tuple[Template, dict]],
                       follow_up_date: date | None = None, force_live: bool = False) -> Instruction:
    """items: [(template, values), ...] in display order. Raises ValueError on missing values.

    Translations and audio are fetched before the transaction opens: each one is committed
    as soon as it is paid for, so if a later NKENNEAi call fails, a rollback cannot discard
    work (or ApiCallLog rows) that a retry would otherwise pay for again.

    A translation failure stops everything (the patient needs the text). A TTS failure does not:
    the item goes out without audio, still with its text and the digits box, and the next use of
    the same sentence tries the audio again (nothing is cached for a failed clip).
    """
    for template, values in items:
        missing = missing_values(template, values)
        if missing:
            raise ValueError(f"{template.title}: missing {', '.join(missing)}")

    prepared = []
    for template, values in items:
        tr = translation.get_or_create_translation(template, language, force_live=force_live)
        rendered = render(tr.text, values)
        clip = _clip_or_none(rendered, language, force_live)
        prepared.append((template, values, rendered, clip))

    with transaction.atomic():
        instruction = Instruction.objects.create(
            patient_label=patient_label, language=language, follow_up_date=follow_up_date, created_by=user,
        )
        InstructionItem.objects.bulk_create([
            InstructionItem(
                instruction=instruction, template=template, values={k: format_value(v) for k, v in values.items()},
                english_text=render(template.english_text, values), rendered_text=rendered,
                audio=clip, position=position,
            )
            for position, (template, values, rendered, clip) in enumerate(prepared)
        ])
    return instruction


def _clip_or_none(text: str, language: str, force_live: bool) -> AudioClip | None:
    try:
        return audio.get_or_create_clip(text, language, force_live=force_live)
    except nkenne.NkenneError as exc:
        logger.warning("Audio unavailable, sending text only (status %s): %s", exc.status_code, exc)
        return None
