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
| Translate (one sentence) | About 1 per 4 characters of English (14 to 31 for one sentence) | `tokensRemaining` in each response, `backend/scripts/nkenne_test.py`, 23 Oct 2026 |
| TTS (one sentence) | Estimated at about 1 per 2 Swahili characters (about 30 for a 60-character sentence) | Inferred: 427 tokens spent minus about 256 for translation, spread over 318 spoken characters; confirm in Usage Analytics |
| Speech Translation (~10 s) | Pending | First attempt failed with a server-side 500 |

## Strategy

1. **Mock mode during development.** All app development and automated tests run with `NKENNE_MOCK=true`, which makes zero network calls. Mock output is labelled and never shown as a real integration.
2. **Translate templates once.** Each template is translated once per language and stored with a hash of its English source. Re-running the seed command costs nothing unless the English wording changes.
3. **Audio cached by content hash.** TTS runs once per unique (language, voice, text). Instructions that reuse the same wording reuse the same audio.
4. **Speech Translation instead of STT + translate.** One call per reply instead of two. Only if Speech Translation fails on NKENNEAi's side does a reply fall back to Speech-to-Text then Text-to-Text (two calls), so the clinic still gets the English.
5. **No wasted retries.** Only network errors and gateway errors (502, 503, 504) are retried, max 3 attempts. A 4xx or a plain 500 (which has meant a model failure) is not retried, since every attempt can be charged.
6. **Every call logged.** `ApiCallLog` records kind, cached/live, status and latency. The Usage screen (`/api/usage/`) summarises it and `/api/usage.csv` exports it.

## Consumption log

| Phase | Live calls | Tokens used | Notes |
|---|---|---|---|
| API exploration (`nkenne_test.py`) | 8 | 1,040 to 964 for the 5 translate calls, rest pending | Run twice: the first run stopped after 1 call on a response-field mismatch, the second skipped that sentence |
| Seeding template translations and fixed-sentence audio (`translate_templates --live`) | 31 (27 translate, 4 TTS) | 964 to 537 = 427, which also covers the smoke test's voices, TTS and failed Speech Translation calls | 1,025 English characters translated, 261 Swahili characters spoken |
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
