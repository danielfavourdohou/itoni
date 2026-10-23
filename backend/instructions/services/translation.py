"""Template translation with placeholder safety and caching.

A dose is safety-critical, so placeholders are swapped for sentinels before
translation, verified afterwards, and if they did not survive we translate a
placeholder-free fallback sentence instead. Values are then shown separately
(as digits) on the patient page.
"""

from __future__ import annotations

import hashlib
import logging
import re
from collections import Counter
from dataclasses import dataclass

from instructions.models import ApiCallLog, Template, TemplateTranslation
from instructions.services import nkenne

logger = logging.getLogger(__name__)

PLACEHOLDER_RE = re.compile(r"\{(\w+)\}")

# Measured 23 Oct 2026 (scripts/nkenne_test.py): plain {name} placeholders survive Swahili
# translation intact, so they are sent as-is first. [[n]] sentinels made the model invent a
# whole new sentence, so they are gone. XQnZ is untested and kept only as a second try
# before the placeholder-free fallback.
SENTINEL_STYLES = (
    lambda i: f"XQ{i}Z",
)


@dataclass
class TranslationResult:
    text: str
    uses_fallback: bool


def source_hash(text: str, language: str) -> str:
    return hashlib.sha256(f"{language}|{text}".encode()).hexdigest()


def protect(text: str, style) -> tuple[str, dict[str, str]]:
    """Replace each {name} with a sentinel. Returns protected text and sentinel->'{name}' map."""
    mapping: dict[str, str] = {}
    names: list[str] = []

    def repl(m: re.Match) -> str:
        name = m.group(1)
        if name not in names:
            names.append(name)
        sentinel = style(names.index(name) + 1)
        mapping[sentinel] = "{" + name + "}"
        return sentinel

    return PLACEHOLDER_RE.sub(repl, text), mapping


def restore(translated: str, mapping: dict[str, str]) -> str | None:
    """Swap sentinels back. Returns None if any sentinel is missing or duplicated."""
    for sentinel in mapping:
        if translated.count(sentinel) != 1:
            return None
    for sentinel, placeholder in mapping.items():
        translated = translated.replace(sentinel, placeholder)
    return translated


def placeholders_intact(source: str, translated: str) -> bool:
    """Same placeholders, same number of times: none lost, renamed, doubled or invented."""
    return Counter(PLACEHOLDER_RE.findall(source)) == Counter(PLACEHOLDER_RE.findall(translated))


def translate_with_placeholders(template: Template, language: str, *, force_live: bool = False) -> TranslationResult:
    text = template.english_text
    if not PLACEHOLDER_RE.search(text):
        return TranslationResult(nkenne.translate(text, language, force_live=force_live), False)

    # Placeholders as written: one call, and the translation keeps natural word order around them.
    translated = nkenne.translate(text, language, force_live=force_live)
    if placeholders_intact(text, translated):
        return TranslationResult(translated, False)
    logger.warning("Placeholders lost for %s as written: %s", template.key, translated)

    for style in SENTINEL_STYLES:
        protected, mapping = protect(text, style)
        translated = nkenne.translate(protected, language, force_live=force_live)
        restored = restore(translated, mapping)
        if restored is not None:
            return TranslationResult(restored, False)
        logger.warning("Placeholders lost for %s with style %r: %s", template.key, style(1), translated)

    fallback = template.fallback_english_text or template.english_text
    if PLACEHOLDER_RE.search(fallback):
        raise ValueError(f"Template {template.key} needs a placeholder-free fallback_english_text.")
    return TranslationResult(nkenne.translate(fallback, language, force_live=force_live), True)


def get_or_create_translation(template: Template, language: str, *, force_live: bool = False,
                              refresh: bool = False) -> TemplateTranslation:
    """Return a stored translation, calling NKENNEAi only when missing or the English changed."""
    h = source_hash(template.english_text, language)
    existing = TemplateTranslation.objects.filter(template=template, language=language).first()
    live_wanted = force_live or not nkenne.is_mock()

    if existing and not refresh and existing.source_hash == h and not (existing.is_mock and live_wanted):
        ApiCallLog.objects.create(kind=ApiCallLog.Kind.TRANSLATE, language=language, cached=True,
                                  request_chars=len(template.english_text))
        return existing

    result = translate_with_placeholders(template, language, force_live=force_live)
    obj, _ = TemplateTranslation.objects.update_or_create(
        template=template, language=language,
        defaults={
            "text": result.text,
            "uses_fallback": result.uses_fallback,
            "source_hash": h,
            "is_mock": not live_wanted,
            "status": TemplateTranslation.Status.MACHINE,
            "reviewed_by": None,
            "reviewed_at": None,
        },
    )
    return obj
