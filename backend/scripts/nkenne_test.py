"""NKENNEAi smoke test for Ìtọ́ni (Swahili only, per hackathon rules).

Spends real tokens: 5 translate calls, 1 voices lookup, 1 TTS call,
and 1 speech-translation call (round trip on the TTS audio).

Usage (from backend/):
    python scripts/nkenne_test.py

Reads NKENNE_API_KEY from the environment or backend/.env.
Writes audio to scripts/out/ (git-ignored by extension).
Afterwards, check Usage Analytics in the NKENNEAi dashboard and record
results in docs/NKENNEAI_API.md section 7 and docs/TOKEN_USAGE.md.
"""

import os
import time
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
    raise SystemExit("Set NKENNE_API_KEY in .env first.")

AUTH = {"Authorization": KEY}
JSON_HEADERS = {**AUTH, "Content-Type": "application/json"}
OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)


def timed(fn):
    t0 = time.monotonic()
    r = fn()
    return r, int((time.monotonic() - t0) * 1000)


def translate(text: str) -> str:
    r, ms = timed(
        lambda: requests.post(
            f"{BASE}/api/translate/with-api-key",
            headers=JSON_HEADERS,
            json={"text": text, "fromLanguage": "English", "toLanguage": "Swahili"},
            timeout=60,
        )
    )
    print(f"\n[translate] {r.status_code} in {ms} ms")
    print(f"  EN: {text}")
    print(f"  SW: {r.text}")
    r.raise_for_status()
    return r.json()["translatedText"]


def check(label: str, needles: list[str], text: str) -> None:
    missing = [n for n in needles if n not in text]
    print(f"  {label}: {'OK' if not missing else 'MISSING ' + ', '.join(missing)}")


# 1. Plain sentence
translate("Take this medicine after eating food.")

# 2. Danger signs (longest template, checks clarity)
translate(
    "Go to the hospital immediately if you find it hard to breathe, "
    "have a very high fever, or cannot keep food or water down."
)

# 3. Digits and units
sw_digits = translate("Take 500mg of Amoxicillin, 2 times a day, for 5 days.")
check("digits survive", ["500", "2", "5", "Amoxicillin"], sw_digits)

# 4. Curly placeholders
sw_curly = translate(
    "Take {dose} of {drug}, {times_per_day} times a day, for {days} days."
)
check(
    "curly placeholders survive",
    ["{dose}", "{drug}", "{times_per_day}", "{days}"],
    sw_curly,
)

# 5. Sentinel placeholders
sw_sent = translate("Take [[1]] of [[2]], [[3]] times a day, for [[4]] days.")
check("sentinels survive", ["[[1]]", "[[2]]", "[[3]]", "[[4]]"], sw_sent)

# 6. Voices
r, ms = timed(
    lambda: requests.get(f"{BASE}/api/tts/v1/swahili/voices", headers=AUTH, timeout=30)
)
print(f"\n[voices] {r.status_code} in {ms} ms\n  {r.text}")

# 7. TTS of the digits sentence (listen to how numbers are read)
r, ms = timed(
    lambda: requests.post(
        f"{BASE}/api/tts/v1/swahili/with-api-key",
        headers=JSON_HEADERS,
        json={"text": sw_digits},
        timeout=120,
    )
)
print(
    f"\n[tts] {r.status_code} in {ms} ms, {r.headers.get('Content-Type')}, {len(r.content)} bytes"
)
if not r.ok:
    raise SystemExit(f"  body: {r.text[:300]}")
ext = "wav" if "wav" in (r.headers.get("Content-Type") or "") else "mp3"
audio_path = OUT / f"swahili_digits.{ext}"
audio_path.write_bytes(r.content)
print(f"  saved {audio_path}")

# 8. Speech translation round trip on that audio (synthetic speech, test only)
with audio_path.open("rb") as f:
    r, ms = timed(
        lambda: requests.post(
            f"{BASE}/api/st/v1/swahili-to-english/with-api-key",
            headers=AUTH,
            files={
                "audio_file": (
                    audio_path.name,
                    f,
                    f"audio/{'wav' if ext == 'wav' else 'mpeg'}",
                )
            },
            timeout=120,
        )
    )
print(f"\n[speech translation] {r.status_code} in {ms} ms\n  {r.text}")

print(
    "\nDone. Now open Usage Analytics in the dashboard and note the token cost per call."
)
