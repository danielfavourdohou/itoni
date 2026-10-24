# Token Usage

Ìtọ́ni built and seeded the whole product on **592 NKENNEAi tokens** out of 1,050, and serves patients from its cache afterwards: on production, **73% of requests were answered without an API call**.

As of 24 Oct 2026, 06:18 WAT (NKENNEAi dashboard): **458 tokens left**.

## Allocation and spend

| | Tokens |
|---|---|
| Free trial on signup (21 Oct) | 50 |
| Hackathon allocation (organizers, 23 Oct) | 1,000 |
| **Total received** | **1,050** |
| Balance on 24 Oct, 06:18 WAT | 458 |
| **Spent** | **592** |

## Where the tokens went

| Step | Live calls | Tokens | How we know |
|---|---|---|---|
| API exploration, first run (`backend/scripts/nkenne_test.py`) | 1 translate | 10 | `tokensRemaining` 1,050 to 1,040 |
| API exploration, second run | 4 translate | 76 | `tokensRemaining` 1,040 to 964 (31, 14, 17, 14) |
| Smoke test voices, TTS and Speech Translation, then seeding every template (`translate_templates --live`) | 3 + 31 (27 translate, 4 TTS) | 427 | Balance 964 to 537 |
| Demo patients (`seed_demo`), end-to-end tests including failed speech calls | about 10 | 79 | Balance 537 to 458 |
| **Total** | | **592** | |

What the 27 translations covered: 6 instruction templates and 21 patient-screen labels, 1,025 English characters, so the whole patient interface exists in Swahili after one pass.

## Cost per call (measured)

| Call | Cost | Source |
|---|---|---|
| Text-to-Text | About 1 token per 4 characters of English (14 to 31 for one sentence) | `tokensRemaining` in each translate response |
| Text-to-Speech | About 1 token per 2 Swahili characters (about 30 for a 60-character sentence) | Inferred from the balance drop over 318 spoken characters |
| Speech-to-Text | 12 tokens for a 3.7 s clip | `tokensUsed` in the response, 24 Oct 2026 |
| Speech Translation | About 20 tokens (balance difference); returns translated speech (audio), not text | 24 Oct 2026 |
| A failed call | 1 token each | NKENNEAi dashboard history: the 500 and 503 failures on 24 Oct were each charged 1 token |

## Cache effectiveness (production Usage screen, 24 Oct)

| API | Live calls | Cache hits | Hit rate |
|---|---|---|---|
| Text-to-Text | 27 | 143 | 72% |
| Text-to-Speech | 7 | 74 | 80% |
| Speech Translation | 2 (both refused, see below) | not cacheable | n/a |
| **All** | **36** | **217** | **73%** |

Plus 44 mocked calls from development, which cost nothing. Read it as: every template was paid for once (27 translations), every unique sentence was spoken once (7 clips), and everything after that came from the database.

Notes for checking these numbers:
- Production's log includes the seeding calls, because the seeded data and its call log were copied from the laptop to production rather than paid for twice.
- The 2 Speech Translation "live calls" on production were refused by NKENNEAi's Cloudflare in about 0.3 s (issue 2) and very likely not charged.
- The smoke-test script calls the API directly, so its 8 calls are counted above from `tokensRemaining`, not in the app's log.

## How the design saves tokens

1. **Mock mode for development.** All development and the 134 automated tests run with `NKENNE_MOCK=true`: no network calls. Mock output is labelled, and every screen shows a red MOCK banner.
2. **Translate each template once.** Translations are stored with a hash of their English source; rerunning the seed command costs nothing unless the wording changes.
3. **Speak each sentence once.** Audio is cached by language, voice, speaking rate and text. Fixed sentences are spoken once at seeding; a new instruction only pays for its dose and return-date lines when those values are new.
4. **Copy, don't re-buy.** Production got its translations and audio by copying the database rows from the laptop, not by translating again (which would have cost about 430 more tokens).
5. **The cheapest working reply route.** Replies go through Speech-to-Text, then Text-to-Text (about 27 tokens). Speech Translation returns translated speech, not text (confirmed by NKENNEAi), so it cannot give staff something to read; calling it would cost about 20 tokens per reply. It stays off by default (`NKENNE_REPLY_ROUTE=st` enables it).
6. **No wasted retries.** Only network failures and gateway errors (502, 503, 504) are retried. A refused request (4xx) or a plain 500 (which has meant a model failure) is not, since each attempt can be charged.
7. **Every call logged.** `ApiCallLog` records kind, cached or live, mocked, status and latency. The Usage screen summarises it and `/api/usage.csv` exports every row.

## Testing approach

- **Automated:** `cd backend && python manage.py test` runs 134 tests in mock mode, covering the NKENNEAi client (parsing, retries, safe error logging), caching (a second request makes no call), placeholder validation, every endpoint's auth and errors, the reply pipeline and its fallback. Live-path behaviour is tested by patching `requests`, never by calling the network.
- **Live, by hand:** a smoke test script (8 calls) to measure costs and response shapes, one seeding run, then end-to-end checks on a laptop and phone. Each live step was planned with a call count first.
