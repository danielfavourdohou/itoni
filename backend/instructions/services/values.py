"""Validation of a create-instruction payload.

VALUE_RULES is the single source for value limits: the API enforces them here and
sends them to the frontend (GET /api/templates/) so the form can show the same hints.
Error keys: top-level field names, or items.<template_key>.<placeholder>.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from django.utils import timezone

from instructions.models import Template
from instructions.services import rendering

PATIENT_LABEL_MAX = 60

VALUE_RULES: dict[str, dict] = {
    "dose": {"type": "text", "label": "Dose", "max_length": 20},
    "drug": {"type": "text", "label": "Medicine", "max_length": 60},
    "times_per_day": {"type": "integer", "label": "Times a day", "min": 1, "max": 6},
    "days": {"type": "integer", "label": "Number of days", "min": 1, "max": 90},
    # {date} is never sent per item: it is filled from the top-level follow_up_date.
    "date": {"type": "date", "label": "Return date", "source": "follow_up_date"},
}


@dataclass
class CleanedInstruction:
    patient_label: str
    follow_up_date: date | None
    items: list[tuple[Template, dict]]  # ordered by template position


def _clean_value(rule: dict, raw) -> tuple[object | None, str | None]:
    """Return (value, error). A blank value is (None, None) so missing_values reports it."""
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return None, None
    if rule["type"] == "text":
        if isinstance(raw, bool) or not isinstance(raw, (str, int, float)):
            return None, "Enter text."
        value = str(raw).strip()
        if len(value) > rule["max_length"]:
            return None, f"Use at most {rule['max_length']} characters."
        return value, None
    if rule["type"] == "integer":
        if isinstance(raw, bool):
            return None, "Enter a whole number."
        try:
            value = int(raw) if isinstance(raw, int) else int(str(raw).strip())
        except ValueError:
            return None, "Enter a whole number."
        if not rule["min"] <= value <= rule["max"]:
            return None, f"Must be between {rule['min']} and {rule['max']}."
        return value, None
    raise ValueError(f"Unknown rule type {rule['type']!r}")


def _clean_follow_up_date(raw, errors: dict) -> date | None:
    if raw in (None, ""):
        return None
    try:
        value = date.fromisoformat(raw) if isinstance(raw, str) else None
    except ValueError:
        value = None
    if value is None:
        errors["follow_up_date"] = ["Enter a date as YYYY-MM-DD."]
        return None
    if value < timezone.localdate():
        errors["follow_up_date"] = ["The return date cannot be in the past."]
        return None
    return value


def clean_instruction_payload(data: dict) -> tuple[CleanedInstruction | None, dict[str, list[str]]]:
    errors: dict[str, list[str]] = {}

    label = data.get("patient_label")
    label = label.strip() if isinstance(label, str) else ""
    if not label:
        errors["patient_label"] = ["Enter a patient label, such as initials."]
    elif len(label) > PATIENT_LABEL_MAX:
        errors["patient_label"] = [f"Use at most {PATIENT_LABEL_MAX} characters."]

    follow_up_date = _clean_follow_up_date(data.get("follow_up_date"), errors)

    raw_items = data.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        errors["items"] = ["Choose at least one instruction."]
        return None, errors

    requested: dict[str, dict] = {}
    item_errors: list[str] = []
    for raw in raw_items:
        key = raw.get("template_key") if isinstance(raw, dict) else None
        values = raw.get("values", {}) if isinstance(raw, dict) else None
        if not isinstance(key, str) or not isinstance(values, dict):
            item_errors.append("Each item needs a template_key and a values object.")
        elif key in requested:
            item_errors.append(f"{key} was chosen more than once.")
        else:
            requested[key] = values

    templates = {
        t.key: t for t in Template.objects.filter(
            key__in=requested, kind=Template.Kind.INSTRUCTION, is_active=True,
        )
    }
    item_errors += [f"Unknown instruction: {key}." for key in requested if key not in templates]
    if item_errors:
        errors["items"] = item_errors

    items: list[tuple[Template, dict]] = []
    for template in sorted(templates.values(), key=lambda t: t.position):
        given = requested[template.key]
        values: dict = {}
        for name in template.placeholders:
            if name == "date":
                values[name] = follow_up_date
                continue
            rule = VALUE_RULES.get(name)
            if rule is None:  # seed data drifted from VALUE_RULES; a server bug, not user input
                errors.setdefault("items", []).append(f"{template.title} uses an unsupported value: {name}.")
                continue
            value, error = _clean_value(rule, given.get(name))
            if error:
                errors[f"items.{template.key}.{name}"] = [error]
            values[name] = value

        for name in rendering.missing_values(template, values):
            if name == "date":
                errors.setdefault("follow_up_date", [f"Required for {template.title}."])
            else:
                errors.setdefault(f"items.{template.key}.{name}", ["Required."])
        items.append((template, values))

    if errors:
        return None, errors
    return CleanedInstruction(patient_label=label, follow_up_date=follow_up_date, items=items), {}
