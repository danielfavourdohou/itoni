"""The only module that talks to NKENNEAi.

Every call: auth header, timeout, retry on network errors and 5xx only,
one ApiCallLog row, and a single NkenneError type for callers.
Mock mode returns labelled fake responses with no network call.
"""

from __future__ import annotations

import io
import logging
import math
import struct
import time
import wave
from dataclasses import dataclass

import requests
from django.conf import settings

from instructions.models import ApiCallLog, Language

logger = logging.getLogger(__name__)

# One place for language mapping. Add a row here to support a new language.
LANGUAGES = {
    Language.SWAHILI: {
        "translate_name": "Swahili",
        "tts_slug": "swahili",
        "reply_pair": "swahili-to-english",
    },
}

MOCK_TRANSLATE_PREFIX = "[MOCK-SW] "
MOCK_REPLY_TEXT = "(mock) I cannot find this medicine at the pharmacy and I feel worse."


class NkenneError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code

    @property
    def user_message(self) -> str:
        if self.status_code == 401:
            return "The translation service rejected our API key. Check NKENNE_API_KEY."
        if self.status_code == 413:
            return "The recording is too large to translate."
        if self.status_code and 400 <= self.status_code < 500:
            return f"The translation service could not process this request ({self.status_code})."
        return "The translation service is unavailable right now. Please try again in a moment."


@dataclass
class AudioResult:
    data: bytes
    content_type: str


def _cfg(key):
    return settings.NKENNE[key]


def is_mock(force_live: bool = False) -> bool:
    return False if force_live else bool(_cfg("MOCK"))


def _lang(language: str) -> dict:
    try:
        return LANGUAGES[language]
    except KeyError as exc:
        raise NkenneError(f"Unsupported language: {language}") from exc


def _extract_error(resp: requests.Response) -> str:
    try:
        return str(resp.json().get("error") or resp.text[:300])
    except ValueError:
        return resp.text[:300]


def _request(kind: str, method: str, path: str, *, language: str, timeout: int,
             request_chars=None, request_bytes=None, **kwargs) -> requests.Response:
    key = _cfg("API_KEY")
    if not key:
        raise NkenneError("NKENNE_API_KEY is not set.", status_code=401)

    headers = {"Authorization": key, **kwargs.pop("headers", {})}
    url = f"{_cfg('BASE_URL').rstrip('/')}{path}"
    attempts = _cfg("MAX_ATTEMPTS")
    last_error: NkenneError | None = None

    for attempt in range(1, attempts + 1):
        started = time.monotonic()
        status_code = None
        error = ""
        try:
            resp = requests.request(method, url, headers=headers, timeout=timeout, **kwargs)
            status_code = resp.status_code
            if resp.ok:
                return resp
            error = _extract_error(resp)
            last_error = NkenneError(error, status_code=status_code)
            if status_code < 500:
                break  # 4xx: our fault, retrying wastes tokens
        except (requests.ConnectionError, requests.Timeout) as exc:
            error = f"{type(exc).__name__}: {exc}"
            last_error = NkenneError(error)
        finally:
            ApiCallLog.objects.create(
                kind=kind, language=language, status_code=status_code,
                latency_ms=int((time.monotonic() - started) * 1000),
                request_chars=request_chars, request_bytes=request_bytes, error=error,
            )
            # Rewind file uploads so a retry sends the full body.
            for f in (kwargs.get("files") or {}).values():
                fileobj = f[1] if isinstance(f, tuple) else f
                if hasattr(fileobj, "seek"):
                    fileobj.seek(0)

        if attempt < attempts:
            backoff = 2 ** (attempt - 1)
            logger.warning("NKENNEAi %s attempt %s failed (%s); retrying in %ss", kind, attempt, error, backoff)
            time.sleep(backoff)

    assert last_error is not None
    logger.error("NKENNEAi %s failed: %s", kind, last_error)
    raise last_error


def translate(text: str, language: str, *, force_live: bool = False) -> str:
    """English -> target language."""
    lang = _lang(language)
    if is_mock(force_live):
        ApiCallLog.objects.create(kind=ApiCallLog.Kind.TRANSLATE, language=language, mocked=True,
                                  request_chars=len(text))
        return MOCK_TRANSLATE_PREFIX + text

    resp = _request(
        ApiCallLog.Kind.TRANSLATE, "POST", "/api/translate/with-api-key",
        language=language, timeout=_cfg("TIMEOUT_TRANSLATE"), request_chars=len(text),
        json={"text": text, "fromLanguage": "English", "toLanguage": lang["translate_name"]},
    )
    try:
        body = resp.json()
        # The live API answers snake_case; the PDF docs show camelCase. Accept both.
        out = body.get("translated_text", body.get("translatedText"))
        if out is None:
            raise KeyError("translated_text")
    except (ValueError, KeyError, AttributeError) as exc:
        raise NkenneError(f"Unexpected translate response: {resp.text[:200]}", resp.status_code) from exc
    if not isinstance(out, str) or not out.strip():
        raise NkenneError("Empty translation returned.", resp.status_code)
    return out.strip()


def tts(text: str, language: str, *, voice: str = "", force_live: bool = False) -> AudioResult:
    lang = _lang(language)
    if is_mock(force_live):
        ApiCallLog.objects.create(kind=ApiCallLog.Kind.TTS, language=language, mocked=True,
                                  request_chars=len(text))
        return AudioResult(_mock_wav(), "audio/wav")

    payload = {"text": text, "speaking_rate": _cfg("TTS_SPEAKING_RATE")}
    if voice:
        payload["voice_name"] = voice
    resp = _request(
        ApiCallLog.Kind.TTS, "POST", f"/api/tts/v1/{lang['tts_slug']}/with-api-key",
        language=language, timeout=_cfg("TIMEOUT_AUDIO"), request_chars=len(text), json=payload,
    )
    content_type = (resp.headers.get("Content-Type") or "audio/mpeg").split(";")[0].strip()
    if not content_type.startswith("audio/") or not resp.content:
        raise NkenneError(f"TTS returned {content_type}, {len(resp.content)} bytes.", resp.status_code)
    return AudioResult(resp.content, content_type)


def speech_translate(audio: bytes, filename: str, content_type: str, language: str,
                     *, force_live: bool = False) -> str:
    """Spoken target language -> English text."""
    lang = _lang(language)
    if is_mock(force_live):
        ApiCallLog.objects.create(kind=ApiCallLog.Kind.ST, language=language, mocked=True,
                                  request_bytes=len(audio))
        return MOCK_REPLY_TEXT

    resp = _request(
        ApiCallLog.Kind.ST, "POST", f"/api/st/v1/{lang['reply_pair']}/with-api-key",
        language=language, timeout=_cfg("TIMEOUT_AUDIO"), request_bytes=len(audio),
        files={"audio_file": (filename, io.BytesIO(audio), content_type)},
    )
    try:
        out = resp.json()["translated_text"]
    except (ValueError, KeyError) as exc:
        raise NkenneError(f"Unexpected speech translation response: {resp.text[:200]}", resp.status_code) from exc
    return (out or "").strip()


def list_voices(language: str) -> dict:
    lang = _lang(language)
    resp = _request(
        ApiCallLog.Kind.VOICES, "GET", f"/api/tts/v1/{lang['tts_slug']}/voices",
        language=language, timeout=_cfg("TIMEOUT_TRANSLATE"),
    )
    return resp.json()


def _mock_wav(seconds: float = 1.0, freq: float = 440.0, rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        frames = b"".join(
            struct.pack("<h", int(8000 * math.sin(2 * math.pi * freq * i / rate)))
            for i in range(int(seconds * rate))
        )
        w.writeframes(frames)
    return buf.getvalue()
