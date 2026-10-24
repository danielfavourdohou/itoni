# Architecture

How Ìtọ́ni is built and why. The README covers the problem and the users; [SETUP.md](SETUP.md) covers running it. The repo is a monorepo: `backend/` (Django JSON API) and `frontend/` (React app).

## 1. At a glance

```
                  DEVELOPMENT                                 PRODUCTION
 Browser -> Vite dev server :5173                  Browser -> Vercel (itoni.vercel.app)
            | serves the React app                            | serves the built React app
            | forwards /api /admin /static --+                | forwards /api /admin /static
            v                                v                v
                 Django: localhost:8000 locally, itoni.onrender.com in production
                 +-------------------------------------------------+
                 | instructions app                                |
                 |   api/       JSON views, serializers, API docs  |
                 |   services/  business logic                     |
                 |     nkenne.py  the only NKENNEAi client --------+--> NKENNEAi
                 |     translation.py  audio.py  rendering.py      |      Text-to-Text
                 |     replies.py  values.py  review.py  usage.py  |      Text-to-Speech
                 +-------------------------+-----------------------+      Speech Translation
                                           |                              Speech-to-Text
                             PostgreSQL (SQLite locally)
               templates, translations, audio clips, instructions,
                         replies, the API call log
```

Three rules hold everything together:

1. **One origin.** The browser only talks to the Vite server in development and to Vercel in production; both forward the API to Django. Session cookies stay first-party (iPhone Safari blocks third-party cookies) and no CORS is needed.
2. **One NKENNEAi client.** Views never call `requests`. Every call goes through `services/nkenne.py`, which handles the key, timeouts, retries, mock mode, safe error logging and one `ApiCallLog` row per call. The frontend never sees the key.
3. **Cache before calling.** A sentence is translated once and spoken once; everything after that comes from the database.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Python 3.12, Django 5.2, plain `JsonResponse` views, session auth | Owns all business logic and every API call; no DRF needed for 22 endpoints |
| Frontend | React 18, TypeScript (strict), Vite, React Router, Tailwind CSS v4, `lucide-react` | A polished staff app and a light, fast patient screen |
| Data fetching | Native `fetch` through one wrapper (`src/lib/api.ts`) | Cookie and CSRF header in one place |
| Database | PostgreSQL in production, SQLite locally (`dj-database-url`) | One setting switches them |
| Audio storage | Database `BinaryField` | Render's disk is wiped on every deploy; clips are tens of KB |
| Audio conversion | `imageio-ffmpeg` (bundled binary) | Works on Render without system packages |
| QR codes | `qrcode`, rendered to SVG by the API | No external service |
| Hosting | Vercel (React app) and Render (Django, PostgreSQL) | Free tiers; Vercel's rewrites keep one origin |
| Background jobs | None | Free hosting has no worker; with caching, synchronous calls are fast enough (see section 8) |

## 3. Main flows

### 3.1 Translating a template (once)

1. `translate_templates` (or the first instruction that needs it) asks `translation.get_or_create_translation(template, language)`.
2. If a translation exists whose `source_hash` matches the current English, it is returned. **No API call.**
3. Otherwise the English goes to Text-to-Text and the placeholders are validated (section 5). The result is stored with `status=machine`.
4. A fluent reader corrects and approves it in the Translations screen (`PATCH /api/translations/<id>/`). An edit must keep every placeholder exactly once.

### 3.2 Creating an instruction

1. The form loads `GET /api/templates/` (templates and value rules) and posts `POST /api/instructions/` with `{patient_label, follow_up_date?, items: [{template_key, values}]}`.
2. `values.py` validates everything and answers 400 with per-field messages if needed.
3. `rendering.create_instruction()` gets each translation, fills in the values, then gets the audio with `audio.get_or_create_clip()`, cached by language, voice, speaking rate and text. Live audio arrives as WAV and is stored as 48 kbps MP3, about five times smaller for patients on mobile data.
4. Translations and audio are committed as soon as they are paid for, before the instruction is saved, so a later failure never throws away work a retry would pay for again.
5. If **translation** fails: 502 with a plain message, nothing created. If only **audio** fails: the item is created without audio (the patient still gets the text and digits) and the next use of that sentence tries again.
6. 201 with the instruction: English and Swahili per item, audio, review status, the QR code (`/api/instructions/<id>/qr.svg`) and the patient link.

### 3.3 The patient screen

1. The QR code opens the frontend route `/p/<token>`, which calls `GET /api/p/<token>/`. Unknown, expired and revoked links all answer the same 404, with Swahili labels so the screen can say so.
2. The response holds each item's Swahili text and audio URL, the digits box, every patient-screen label in Swahili, and `mock_mode`. Nothing on the patient screen is hardcoded in English.
3. Audio comes from `GET /api/p/<token>/audio/<item_id>/`, which checks the item belongs to that token.

### 3.4 A voice reply

1. The patient ticks the consent box; the recorder then records up to 60 s with MediaRecorder (or the patient picks a file). The browser posts `audio_file` and `consent=true` to `POST /api/p/<token>/reply/`.
2. `replies.py` checks consent, size (5 MB) and type, applies the rate limit (10 an hour per link), stores the original, and converts it to 16 kHz mono 16-bit PCM WAV, NKENNEAi's recommended format.
3. It transcribes the Swahili with Speech-to-Text, then translates the transcript to English with Text-to-Text. (Setting `NKENNE_REPLY_ROUTE=st` tries Speech Translation first and falls back to these two steps on a provider failure; it is off by default because, since 24 Oct 2026, Speech Translation returns audio instead of its documented text.)
4. The reply is stored as `done` with the English, or `failed` with a plain error. Either way the original recording is kept and staff can listen. The patient always gets "received" once the recording is stored.
5. Staff see it in the Inbox (`GET /api/replies/`), grouped by patient, unresolved first.

## 4. Data model

`backend/instructions/models.py` is the source of truth.

| Model | Holds | Notes |
|---|---|---|
| `Template` | One standard sentence or patient-screen label (`kind`) in English, its placeholders and a placeholder-free fallback | 6 instructions, 21 labels |
| `TemplateTranslation` | The Swahili for a template | `source_hash` of the English sent; `status` machine or approved; `reviewed_by`, `reviewed_at`; `uses_fallback`; `is_mock` |
| `AudioClip` | Audio bytes for one exact sentence | `cache_key` = sha256 of language, voice, rate and text; `content_type`; `is_mock` |
| `Instruction` | One patient's set of sentences | Unguessable `token` (`secrets.token_urlsafe(24)`); `patient_label` (initials only); `follow_up_date`; `expires_at` (30 days); `is_demo` marks the public sample |
| `InstructionItem` | One sentence of an instruction | `values`, `english_text`, `rendered_text` (Swahili with values), optional `audio` |
| `Reply` | A patient's voice note | Original and converted audio, `translated_text`, `status` (pending, done, failed), `error`, `is_mock`, `is_resolved` |
| `ApiCallLog` | One row per NKENNEAi request or cache hit | `kind` (translate, tts, st, stt, voices), `cached`, `mocked`, `status_code`, `latency_ms`, request size, safe `error` |

## 5. Placeholders and numbers (the risky part)

A changed dose is a safety bug, so numbers are protected in layers:

1. **Send as written.** NKENNEAi keeps `{name}` placeholders intact (measured 23 Oct 2026), so the English goes out unchanged: one call.
2. **Validate.** Every placeholder must appear exactly as often as in the English, none renamed or invented.
3. **Retry protected.** If not, each `{name}` becomes a sentinel (`XQ1Z`) for one more try. (`[[1]]` sentinels were tested and dropped: the model rewrote the whole sentence.)
4. **Fall back.** If that fails too, the placeholder-free fallback is translated instead ("Take this medicine as shown in the box below.") and marked `uses_fallback`.

Whatever the sentence says, the patient screen **always** shows the values as digits in a box: medicine, dose, times a day, days and the return date, exactly as staff typed them. A mistranslated number is therefore always visible.

## 6. Mock mode

`NKENNE_MOCK=true` (the default locally) makes the client return fake responses without any network call:

| Call | Mock response |
|---|---|
| Text-to-Text | `"[MOCK-SW] <the English>"` |
| Text-to-Speech | A 1-second test tone |
| Speech Translation | `"(mock) I cannot find this medicine at the pharmacy and I feel worse."` |
| Speech-to-Text | A fixed Swahili sentence marked `(mock)` |

Mocked calls are logged with `mocked=True`. The API reports `mock_mode` (in `/api/auth/csrf/`, `/api/auth/me/` and `/api/p/<token>/`), and while it is true every screen shows a red, non-dismissable "MOCK MODE: responses are simulated" banner. This is the organizer rule: mocks must be disclosed. Production runs with mock mode off.

## 7. The NKENNEAi client

`services/nkenne.py` exposes `translate`, `translate_to_english`, `tts`, `speech_translate`, `transcribe` and `list_voices`.

- **Auth:** `Authorization: <key>` (no "Bearer"), from `NKENNE_API_KEY`.
- **Timeouts:** 30 s for text, `NKENNE_TIMEOUT_AUDIO` (60 s, 35 s in production) for audio.
- **Retries:** network failures and gateway errors (502, 503, 504) only, up to 3 attempts with 1 s and 2 s backoff. A 4xx or a plain 500 is not retried, since each attempt can be charged.
- **Responses:** accepts both the live (`translated_text`) and documented (`translatedText`) field names.
- **Errors:** one `NkenneError(message, status_code)` with a staff-safe `user_message`. The logged error keeps only NKENNEAi's short `message` and `error` strings, or for a non-JSON reply a 120-character summary with anything token-like redacted. Raw error bodies are never stored (one leaked internal credentials; see [NKENNEAI_API.md](NKENNEAI_API.md), section 8).

## 8. Deployment decisions

- **No task queue.** Render's free plan has no worker. Translation runs once per template, TTS once per sentence, speech once per reply; with caching, synchronous calls are fine. The service layer is pure, so moving behind a queue later is small work.
- **gunicorn `--timeout 120`** matches Vercel's 120 s proxy limit; `NKENNE_TIMEOUT_AUDIO=35` keeps three attempts under it.
- **Audio in the database**, because Render's disk does not survive a deploy.
- **One origin through Vercel rewrites.** Django trusts the Vercel origin for CSRF (`CSRF_TRUSTED_ORIGINS`) and builds patient links from `FRONTEND_BASE_URL`. API responses default to `Cache-Control: private, no-store`, so Vercel never caches sessions or patient data.
- **Health check before host checks.** Render's checker calls `/healthz` over plain HTTP with an internal Host header, so a first-in-chain middleware answers it directly.
- **Sleeping free tier.** A GitHub Action pings `/healthz` every 10 minutes, and the frontend retries its first request for up to two minutes while the server wakes.
- **Data copied, not re-bought.** Production's translations, audio and call log were copied from the laptop with `dumpdata` and `loaddata` instead of calling NKENNEAi again.

## 9. Security

- The API key lives only in environment variables: never in git, the frontend bundle or a `VITE_*` variable. A history scan before submission found none.
- Production: `DEBUG=False`, explicit `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`, HTTPS redirect, secure cookies, HSTS. `python manage.py check --deploy` is clean.
- Patient links use 32-character random tokens; unknown and expired links look the same; every audio and reply endpoint checks ownership.
- Staff endpoints answer 401 JSON without a session; CSRF on every POST and PATCH; `/api/` never returns an HTML error page.
- Reply uploads: consent required, 5 MB maximum, audio types only, ffmpeg rejects anything undecodable, 10 an hour per link.
- Patient labels are initials or nicknames; the demo data is fake.
- Raw NKENNEAi error bodies are never stored or shown.

## 10. API

The full reference, with schemas and examples, is live at https://itoni.vercel.app/api/docs (OpenAPI 3.1 at `/api/openapi.json`). A test fails if any route is missing from it. Summary:

| Method | Path | Purpose | Access |
|---|---|---|---|
| GET | `/api/auth/csrf/` | Set the CSRF cookie; report `mock_mode` | public |
| POST | `/api/auth/login/`, `/api/auth/logout/` | Log in, log out | public |
| GET | `/api/auth/me/` | Current staff user | staff |
| GET | `/api/dashboard/` | Counts and recent instructions | staff |
| GET | `/api/templates/` | Standard instructions and value rules | staff |
| GET, POST | `/api/instructions/` | List, create | staff |
| GET | `/api/instructions/<id>/` | Detail with English, Swahili, audio, review status, patient link | staff |
| GET | `/api/instructions/<id>/qr.svg` | QR code of the patient link | staff |
| POST | `/api/instructions/<id>/revoke/` | Withdraw the patient link at once | staff |
| GET | `/api/instructions/<id>/items/<item_id>/audio/` | Audio preview | staff |
| GET | `/api/replies/` | Inbox; `?resolved=true` or `false` filters | staff |
| POST | `/api/replies/<id>/resolve/` | Resolve or reopen | staff |
| GET | `/api/replies/<id>/audio/` | Original recording | staff |
| GET | `/api/translations/` | Every template with its Swahili and review status | staff |
| PATCH | `/api/translations/<id>/` | Edit and or approve | staff |
| GET | `/api/usage/`, `/api/usage.csv` | Call summary, full CSV | staff |
| GET | `/api/demo/` | Link to the public sample patient | public |
| GET | `/api/p/<token>/` | Patient screen data | token |
| GET | `/api/p/<token>/audio/<item_id>/` | Patient audio | token |
| POST | `/api/p/<token>/reply/` | Voice reply (multipart) | token |
| GET | `/api/docs/`, `/api/openapi.json` | API reference | public when `ITONI_API_DOCS_PUBLIC=true`, else staff |
| GET | `/healthz` | Health check | public |

Frontend routes: `/` (landing page, or the dashboard when logged in), `/login`, `/instructions/new`, `/instructions/:id`, `/inbox`, `/translations`, `/usage`, and the public `/p/:token`.

## 11. Project layout

```
itoni/
├── backend/
│   ├── config/               settings (all from environment), urls, wsgi, health check
│   ├── instructions/
│   │   ├── models.py  admin.py  seed_data.py
│   │   ├── api/              auth, staff, patient, usage, docs views; serializers; OpenAPI spec
│   │   ├── services/         nkenne, translation, audio, rendering, replies, values, review, usage, labels, qr
│   │   ├── management/commands/   seed_templates, translate_templates [--live], seed_demo
│   │   ├── migrations/
│   │   └── tests/            134 tests, all offline
│   ├── scripts/              setup_local_db.sh, nkenne_test.py
│   ├── build.sh              Render build
│   ├── requirements.txt
│   ├── .env.example          local settings (copy to .env, git-ignored)
│   └── .env.production.example
├── frontend/
│   ├── src/
│   │   ├── lib/              api.ts (fetch wrapper), types.ts, auth, theme
│   │   ├── components/       layout, MOCK banner, audio players, recorder, digits box, dialogs, illustrations
│   │   ├── pages/            Landing, NotFound, staff/*, patient/PatientInstruction
│   │   └── App.tsx  StaffApp.tsx  main.tsx  index.css
│   ├── public/               favicon
│   ├── scripts/              capture_patient_screens.sh
│   ├── vite.config.ts        dev proxy to :8000
│   └── vercel.json           production rewrites to Render
├── .github/workflows/        keep-warm.yml
├── docs/
└── README.md
```

## 12. Tests

`cd backend && python manage.py test` runs 134 tests, always in mock mode; live paths are tested by patching `requests`. They cover:

- the NKENNEAi client: response parsing, retry rules, safe error logging, the reply fallback
- caching: a second request for the same template or sentence makes no call
- placeholders: validation, sentinels, the fallback sentence
- every staff endpoint: 401 without a session; ownership checks on patient and staff audio
- creating instructions: success, field errors, translation failure, audio failure
- replies: consent, size, type, rate limit, conversion, stored audio on failure
- production settings: health check, CSRF through the Vercel origin, no CDN caching, API docs access, and that the spec documents every route

The frontend is checked by its strict TypeScript build and by hand on desktop and phone sizes, in light and dark themes.
