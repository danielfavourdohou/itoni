"""TTS caching and reply audio conversion."""

from __future__ import annotations

import hashlib
import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg
from django.conf import settings

from instructions.models import ApiCallLog, AudioClip
from instructions.services import nkenne


class AudioConversionError(Exception):
    pass


def voice_for(language: str) -> str:
    return settings.NKENNE.get(f"VOICE_{language.upper()}", "") or ""


def clip_cache_key(language: str, voice: str, text: str) -> str:
    rate = settings.NKENNE["TTS_SPEAKING_RATE"]
    return hashlib.sha256(f"{language}|{voice}|{rate}|{text}".encode()).hexdigest()


def get_or_create_clip(text: str, language: str, *, force_live: bool = False) -> AudioClip:
    """One TTS call per unique (language, voice, rate, text). Mock clips are replaced when live."""
    voice = voice_for(language)
    key = clip_cache_key(language, voice, text)
    live_wanted = force_live or not nkenne.is_mock()

    clip = AudioClip.objects.filter(cache_key=key).first()
    if clip and not (clip.is_mock and live_wanted):
        ApiCallLog.objects.create(kind=ApiCallLog.Kind.TTS, language=language, cached=True,
                                  request_chars=len(text))
        return clip

    result = nkenne.tts(text, language, voice=voice, force_live=force_live)
    clip, _ = AudioClip.objects.update_or_create(
        cache_key=key,
        defaults={
            "language": language, "voice": voice, "text": text,
            "content_type": result.content_type, "data": result.data, "is_mock": not live_wanted,
        },
    )
    return clip


def convert_to_ogg(data: bytes, max_seconds: int | None = None) -> bytes:
    """Any browser recording (WebM/MP4/OGG/WAV/MP3) -> mono 16 kHz OGG/Opus.

    ffmpeg also acts as validation: anything that is not decodable audio fails here.
    """
    max_seconds = max_seconds or settings.ITONI["REPLY_MAX_SECONDS"]
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "input"
        dst = Path(tmp) / "output.ogg"
        src.write_bytes(data)
        cmd = [
            imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(src), "-t", str(max_seconds), "-vn", "-ac", "1", "-ar", "16000",
            "-c:a", "libopus", "-b:a", "24k", str(dst),
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=30)
        except subprocess.CalledProcessError as exc:
            raise AudioConversionError(exc.stderr.decode(errors="replace")[:300] or "ffmpeg failed") from exc
        except subprocess.TimeoutExpired as exc:
            raise AudioConversionError("Audio conversion timed out.") from exc
        out = dst.read_bytes() if dst.exists() else b""
    if len(out) < 100:
        raise AudioConversionError("Recording contained no audio.")
    return out
