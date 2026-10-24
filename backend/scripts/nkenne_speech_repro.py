"""Reproduce the NKENNEAi speech failures for the NKENNEAi team (2 live calls).

Calls Speech Translation and Speech-to-Text exactly as the official docs show
(raw key in Authorization, multipart field audio_file, a 16-bit PCM WAV) and
prints a screenshot-ready report.

Usage (from backend/):
    python scripts/nkenne_speech_repro.py [path/to/audio.wav]

Defaults to scripts/out/swahili_digits.wav, Swahili speech made by NKENNEAi's
own Text-to-Speech. Reads NKENNE_API_KEY from the environment or backend/.env
and never prints it. Anything token-like in a response body is redacted, so the
report is safe to share.
"""

import os
import re
import sys
import time
import wave
from datetime import datetime, timezone
from pathlib import Path

import requests

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

BASE = os.environ.get("NKENNE_BASE_URL", "https://developers-api.nkenne.ai")
KEY = os.environ.get("NKENNE_API_KEY")
if not KEY:
    raise SystemExit("Set NKENNE_API_KEY in backend/.env first.")

AUDIO = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "out" / "swahili_digits.wav"
if not AUDIO.exists():
    raise SystemExit(f"Audio file not found: {AUDIO}")

TOKEN_LIKE = re.compile(r"(?i)bearer\s+[A-Za-z0-9._~+/=-]+|[A-Za-z0-9_\-]{24,}")
ENDPOINTS = [
    ("Speech Translation", "/api/st/v1/swahili-to-english/with-api-key"),
    ("Speech-to-Text", "/api/stt/v1/swahili/with-api-key"),
]


def describe_audio(path: Path) -> str:
    try:
        with wave.open(str(path)) as w:
            seconds = w.getnframes() / w.getframerate()
            return (f"{path.name}, {path.stat().st_size:,} bytes, WAV {w.getframerate()} Hz, "
                    f"{w.getnchannels()} channel(s), {8 * w.getsampwidth()}-bit PCM, {seconds:.1f} s")
    except wave.Error:
        return f"{path.name}, {path.stat().st_size:,} bytes"


def safe(text: str, limit: int = 600) -> str:
    return TOKEN_LIKE.sub("[redacted]", " ".join(text.split()))[:limit]


print("NKENNEAi speech API reproduction")
print(f"Base URL : {BASE}")
print(f"Audio    : {describe_audio(AUDIO)}")
print(f"API key  : set ({len(KEY)} characters, not shown)")

for name, path in ENDPOINTS:
    started_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"\nCalling {name} at {started_at} (waits up to 120 s)...", flush=True)
    t0 = time.monotonic()
    with AUDIO.open("rb") as f:
        try:
            r = requests.post(f"{BASE}{path}", headers={"Authorization": KEY},
                              files={"audio_file": (AUDIO.name, f, "audio/wav")}, timeout=120)
        except requests.RequestException as exc:
            print(f"\n[{name}] POST {path}\n  Time   : {started_at}\n  Result : network error: {exc}")
            continue
    ms = int((time.monotonic() - t0) * 1000)
    print(f"\n[{name}] POST {path}")
    print(f"  Time         : {started_at}")
    print(f"  Status       : {r.status_code} in {ms} ms")
    print(f"  Content-Type : {r.headers.get('Content-Type')}")
    print(f"  Server       : {r.headers.get('Server')}")
    print(f"  Body         : {safe(r.text)}")

print("\nDone: 2 live calls.")
