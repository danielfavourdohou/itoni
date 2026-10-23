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
    data, content_type = result.data, result.content_type
    if live_wanted and content_type in WAV_TYPES:
        data, content_type = compress_speech(data, content_type)
    clip, _ = AudioClip.objects.update_or_create(
        cache_key=key,
        defaults={
            "language": language, "voice": voice, "text": text,
            "content_type": content_type, "data": data, "is_mock": not live_wanted,
        },
    )
    return clip


WAV_TYPES = {"audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"}


def compress_speech(data: bytes, content_type: str) -> tuple[bytes, str]:
    """Live TTS is 16 kHz PCM WAV (about 32 KB a second). Patients listen on mobile data,
    so store mono 48 kbps MP3 instead: about 5x smaller and playable on every phone browser.
    If ffmpeg fails, keep the original rather than lose audio that was already paid for.
    """
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "input.wav"
        dst = Path(tmp) / "output.mp3"
        src.write_bytes(data)
        cmd = [
            imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(src), "-vn", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "48k", str(dst),
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=30)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            return data, content_type
        out = dst.read_bytes() if dst.exists() else b""
    return (out, "audio/mpeg") if len(out) >= 100 else (data, content_type)


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
