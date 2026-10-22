# Token Usage Report

Token efficiency is worth 5 points, and the submission must include "a brief explanation of token usage and testing approach." Keep this file updated as you go; it is the evidence judges will read.

## Allocation

| Date | Event | Tokens |
|---|---|---|
| 2026-10-21 | Free trial on signup | 50 |
| | Hackathon allocation (organizers) | 1,000 |
| | Additional batch (if requested) | |

## Cost per call (measured)

| Call | Tokens per call | How measured |
|---|---|---|
| Translate (one sentence) | | Usage Analytics before/after `backend/scripts/nkenne_test.py` |
| TTS (one sentence) | | |
| Speech Translation (~10 s) | | |

## Strategy

1. **Mock mode during development.** All app development and automated tests run with `NKENNE_MOCK=true`, which makes zero network calls. Mock output is labelled and never shown as a real integration.
2. **Translate templates once.** Each template is translated once per language and stored with a hash of its English source. Re-running the seed command costs nothing unless the English wording changes.
3. **Audio cached by content hash.** TTS runs once per unique (language, voice, text). Instructions that reuse the same wording reuse the same audio.
4. **Speech Translation instead of STT + translate.** One call per reply instead of two.
5. **No retries on 4xx.** Only network errors and 5xx are retried, max 3 attempts.
6. **Every call logged.** `ApiCallLog` records kind, cached/live, status and latency. The Usage screen (`/api/usage/`) summarises it and `/api/usage.csv` exports it.

## Consumption log

| Phase | Live calls | Tokens used | Notes |
|---|---|---|---|
| API exploration (`nkenne_test.py`) | 8 | | |
| Seeding template translations | | | 6 templates + 10 labels |
| Seeding template audio | | | |
| End-to-end testing on phone | | | |
| Demo recording | | | |
| **Total** | | | |

## Cache effectiveness (from the Usage screen at submission time)

| Kind | Live calls | Cache hits | Hit rate |
|---|---|---|---|
| translate | | | |
| tts | | | |
| st | | n/a | n/a |
