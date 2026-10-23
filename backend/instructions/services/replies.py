"""Patient voice replies: validate, store, convert, translate.

Rejections (no consent, too big, not audio, rate limit) store nothing. Once a recording
is stored it is never thrown away: if Speech Translation fails, the reply is kept with
status=failed so staff can still listen to the original. Replies are never auto-answered.
"""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.utils import timezone

from instructions.models import Instruction, Reply
from instructions.services import audio, nkenne


class ReplyRejected(Exception):
    """The upload was refused before anything was stored. `code` maps to a translated label."""

    def __init__(self, status: int, message: str, code: str):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code


def _check_rate_limit(instruction: Instruction) -> None:
    since = timezone.now() - timedelta(hours=1)
    if Reply.objects.filter(instruction=instruction, created_at__gte=since).count() >= settings.ITONI["REPLY_RATE_PER_HOUR"]:
        raise ReplyRejected(429, "Too many replies for this instruction. Try again later.", "rate_limited")


def submit_reply(instruction: Instruction, upload: UploadedFile | None, consent: bool) -> Reply:
    """Every check runs before the (token-spending) Speech Translation call."""
    if not consent:
        raise ReplyRejected(400, "Consent is required before a recording can be sent.", "consent_required")
    if upload is None:
        raise ReplyRejected(400, "No recording was attached.", "no_audio")
    if upload.size > settings.ITONI["REPLY_MAX_BYTES"]:
        raise ReplyRejected(413, "The recording is too large.", "too_large")
    content_type = (upload.content_type or "").split(";")[0].strip().lower()
    if not content_type.startswith("audio/"):
        raise ReplyRejected(400, "Only audio recordings can be sent.", "not_audio")
    _check_rate_limit(instruction)

    original = upload.read()
    try:
        wav = audio.convert_for_translation(original)
    except audio.AudioConversionError as exc:
        # Not decodable audio: nothing a member of staff could listen to, so nothing is stored.
        raise ReplyRejected(400, f"The recording could not be read: {exc}", "not_audio") from exc

    reply = Reply.objects.create(
        instruction=instruction,
        original_audio=original,
        original_content_type=content_type,
        converted_audio=wav,
        is_mock=nkenne.is_mock(),
    )
    try:
        reply.translated_text = nkenne.speech_translate(wav, "reply.wav", "audio/wav", instruction.language)
        reply.status = Reply.Status.DONE
    except nkenne.NkenneError as exc:
        reply.status = Reply.Status.FAILED
        reply.error = exc.user_message
    reply.save(update_fields=["translated_text", "status", "error"])
    return reply
