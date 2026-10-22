# Ìtọ́ni: Architecture and Data Model

This document is the technical design. The README covers the problem and the users. The repo is a monorepo: `backend/` (Django JSON API) and `frontend/` (React SPA).

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Backend language | Python 3.12 (production) | Mature web framework, strong ecosystem for audio and HTTP |
| Backend framework | Django 5.2, plain `JsonResponse` views, session auth | Owns all business logic and every NKENNEAi call; no DRF needed for this many endpoints |
| Frontend | React 18 + TypeScript (strict) + Vite | A polished staff and patient UI; Vite gives a dev proxy and a static build |
| Routing | React Router | Staff screens plus the public `/p/:token` patient route |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react` icons | Fast, consistent look without a component library |
| Client data | Native `fetch` through one wrapper (`src/lib/api.ts`) | Session cookie + CSRF header in one place; no axios or React Query |
| Database | SQLite locally, PostgreSQL in production | `dj-database-url` switches between them |
| Audio storage | Postgres `BinaryField` | Render's disk is ephemeral; clips are small (tens of KB) |
| Audio conversion | `imageio-ffmpeg` (bundled ffmpeg binary) | Works on Render without apt packages |
| QR codes | `qrcode` rendered to SVG by the API | No external service |
| Static files | WhiteNoise serves Django static and the built frontend | One web service, one origin |
| Background jobs | **None this week** (synchronous + cache) | Render free tier has no worker; see §8 |
| Hosting | Vercel (static SPA) + Render (Django API, Postgres) | Vercel proxies `/api` to Render, so the browser sees one origin and needs no CORS |

## 2. System overview

```
                        DEVELOPMENT                              PRODUCTION
 Browser --> Vite dev server :5173                     Browser --> Vercel (<app>.vercel.app)
             |  serves React SPA                                    |  serves the built SPA
             |  proxies /api, /admin, /static ---+                  |  proxies /api, /admin, /static
             v                                   v                  v
                Django :8000 locally, <api>.onrender.com in production  (backend/)
                         +--------------------------------------+
                         |  instructions app                    |
                         |   api/  (JSON views, serializers) ---+--> services/
                         |   services/                          |      nkenne.py  ----------> NKENNEAi API
                         |     nkenne.py   (client, mock, log)  |        - /api/translate/with-api-key
                         |     translation.py  audio.py         |        - /api/tts/v1/{lang}/with-api-key
                         |     rendering.py    qr.py  replies.py|        - /api/st/v1/{pair}/with-api-key
                         +------------------+-------------------+
                                            |
                                   PostgreSQL / SQLite
                       (templates, translations, instructions,
                        audio clips, replies, api call log)
```

**Rules:**
- The browser only ever talks to one origin. In development that is the Vite server; in production it is Vercel. Both serve the SPA and proxy the API to Django, so session cookies and CSRF work the same way in both, and the cookie stays first-party (iPhone Safari blocks third-party cookies).
- The frontend never calls NKENNEAi and never sees the API key.
- API views never call `requests` directly. Every NKENNEAi call goes through `backend/instructions/services/nkenne.py`, which handles auth, retries, logging, and mock mode. That one rule is what keeps the token budget alive.

## 3. Main flows

### 3.1 Template translation (once per template per language)
1. A management command (or the first instruction that needs it) requests a translation for `(template, language)`.
2. `translation.get_or_create_translation()` checks `TemplateTranslation`. If it exists and `source_hash` matches the current English text, return it. **No API call.**
3. Otherwise, protect placeholders (§5), call Text-to-Text, validate placeholders, store with `status=machine`.
4. A reviewer edits the text and approves it on the Translations screen (`PATCH /api/translations/<id>/`) or in Django admin.

### 3.2 Create instruction
1. The New Instruction screen loads `GET /api/templates/` (templates, placeholders, value rules), then posts `POST /api/instructions/` with `{patient_label, follow_up_date?, items:[{template_key, values}]}`. Language is always Swahili.
2. The API validates values (`rendering.missing_values` plus field rules) and returns 400 with `fields` on error. `follow_up_date` fills `{date}` and is stored on the instruction.
3. `rendering.create_instruction()` (atomic): for each template, get the translation (3.1), render values into it (§5), then `audio.get_or_create_clip(rendered_text, language)`, which hashes `(language, voice, text)`. A cache hit returns the existing `AudioClip`; a miss calls TTS and stores the bytes.
4. 201 with the instruction detail. The frontend navigates to Instruction Detail, which shows English vs Swahili, audio, review badges, the QR (`/api/instructions/<id>/qr.svg`) and the patient link.
5. On `NkenneError` the API returns 502 with a staff-safe message and nothing is saved.

### 3.3 Patient view
1. The QR code points to the frontend route `/p/<token>`. The SPA calls `GET /api/p/<token>/` (404 JSON if unknown or expired).
2. The response holds each item's Swahili text and `audio_url`, the digits-box values, the translated `labels`, the follow-up date and `mock_mode`. All patient-facing text comes from `labels`; nothing is hardcoded in English.
3. Audio is served by `GET /api/p/<token>/audio/<item_id>/`, which checks the item belongs to that token.

### 3.4 Voice reply
1. Patient ticks the consent box (translated `label_reply_consent`), taps Reply. The `Recorder` component requests the microphone, records with MediaRecorder (max 60 s), and uploads multipart `audio_file` + `consent=true` to `POST /api/p/<token>/reply/`. A file input (`accept="audio/*"`) is the fallback, which also lets a Swahili speaker's recorded voice note be used in testing.
2. `services/replies.py` checks consent, size and MIME, applies the per-instruction rate limit, stores the original bytes, converts to OGG/Opus with ffmpeg (Chrome records WebM, which NKENNEAi does not list).
3. Calls Speech Translation with pair `swahili-to-english`.
4. Stores `translated_text`, `status=done` (or `failed` with the error, keeping the original audio). Returns 201 `{status}`.
5. The staff Inbox (`GET /api/replies/`) lists replies, unresolved first.

## 4. Data model

`backend/instructions/models.py` is the source of truth. It extends the sketch below with `Template.kind` (instruction or interface label), `is_mock` flags on translations, clips and replies, `InstructionItem.english_text`, and `ApiCallLog.request_chars` / `request_bytes`.

```python
class Language(models.TextChoices):
    SWAHILI = "swahili", "Swahili"   # the only language allowed in this hackathon


class Template(models.Model):
    key = models.SlugField(unique=True)                # "medication_dose"
    title = models.CharField(max_length=100)           # shown to staff
    english_text = models.TextField()                  # may contain {placeholders}
    fallback_english_text = models.TextField(blank=True)  # same meaning, no placeholders
    placeholders = models.JSONField(default=list)      # ["dose", "drug", ...]
    position = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)


class TemplateTranslation(models.Model):
    class Status(models.TextChoices):
        MACHINE = "machine", "Machine translated"
        APPROVED = "approved", "Reviewed and approved"

    template = models.ForeignKey(Template, on_delete=models.CASCADE, related_name="translations")
    language = models.CharField(max_length=32, choices=Language.choices)
    text = models.TextField()
    uses_fallback = models.BooleanField(default=False)   # placeholders did not survive
    source_hash = models.CharField(max_length=64)        # sha256 of the English sent
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.MACHINE)
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["template", "language"], name="uniq_template_language")]


class AudioClip(models.Model):
    cache_key = models.CharField(max_length=64, unique=True)  # sha256(language|voice|text)
    language = models.CharField(max_length=32, choices=Language.choices)
    voice = models.CharField(max_length=64, blank=True)
    text = models.TextField()
    content_type = models.CharField(max_length=32, default="audio/mpeg")
    data = models.BinaryField()
    created_at = models.DateTimeField(auto_now_add=True)


class Instruction(models.Model):
    token = models.CharField(max_length=40, unique=True, default=new_token)  # secrets.token_urlsafe(24)
    patient_label = models.CharField(max_length=60)   # initials or a nickname; no real names needed
    language = models.CharField(max_length=32, choices=Language.choices)
    follow_up_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()               # default now + 30 days


class InstructionItem(models.Model):
    instruction = models.ForeignKey(Instruction, on_delete=models.CASCADE, related_name="items")
    template = models.ForeignKey(Template, on_delete=models.PROTECT)
    values = models.JSONField(default=dict)           # {"dose": "500mg", "times_per_day": 2, ...}
    rendered_text = models.TextField()                # translated text with values filled in
    audio = models.ForeignKey(AudioClip, null=True, blank=True, on_delete=models.SET_NULL)
    position = models.PositiveSmallIntegerField(default=0)


class Reply(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        DONE = "done"
        FAILED = "failed"

    instruction = models.ForeignKey(Instruction, on_delete=models.CASCADE, related_name="replies")
    original_audio = models.BinaryField()
    original_content_type = models.CharField(max_length=64)
    converted_audio = models.BinaryField(null=True, blank=True)   # OGG sent to NKENNEAi
    duration_seconds = models.FloatField(null=True, blank=True)
    translated_text = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    error = models.TextField(blank=True)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class ApiCallLog(models.Model):
    kind = models.CharField(max_length=16)        # translate | tts | st
    language = models.CharField(max_length=32, blank=True)
    cached = models.BooleanField(default=False)   # True = served from cache, no API call
    mocked = models.BooleanField(default=False)
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

Indexes: `Reply(is_resolved, created_at)`, `ApiCallLog(created_at)`. Everything else is covered by unique constraints.

## 5. Placeholders and numbers (the risky part)

Translation APIs often change, translate, or drop placeholders and numbers. A changed dose is a safety bug, so the design has three layers:

1. **Protect.** Before sending, replace each `{name}` with a sentinel the model is unlikely to touch, e.g. `[[1]]`, `[[2]]`. Keep the mapping.
2. **Validate.** After translation, check every sentinel appears exactly once. If yes, convert back to `{name}` and store with `uses_fallback=False`.
3. **Fall back.** If validation fails (after one retry with a different sentinel style, e.g. `XQ1`), translate `fallback_english_text` instead ("Take this medicine as shown in the box below.") and store with `uses_fallback=True`. The values then appear only in the structured block.

Regardless of the path, the patient page **always** shows a structured block with digits:

```
Amoxicillin  ·  500mg  ·  2 times a day  ·  5 days
Come back: 24/10/2026
```

The block's labels ("times a day", "days", "Come back") are themselves short templates, translated and reviewed once.

Which sentinel style survives is unknown until you run `backend/scripts/nkenne_test.py`. Update this section with the result.

## 6. Mock mode

`NKENNE_MOCK=true` (default in `.env.example`) makes the client return fake responses with no network call:

| Call | Mock response |
|---|---|
| translate | `"[MOCK-SW] <original text>"`, sentinels preserved |
| tts | A 1-second generated WAV tone (stdlib `wave` + `math`) |
| st | `"(mock) I can't find the drug and I feel worse."` |

Every mocked call is logged with `mocked=True`. Build and test the whole app in mock mode. Switch to live only to (a) seed real translations once and (b) test end to end and record the demo.

**Organizer rule:** mocked functionality must be disclosed and never presented as working NKENNEAi integration. So: the API exposes `mock_mode` (in `/api/auth/me/` and `/api/p/<token>/`), and when it is true every frontend screen shows a red, non-dismissable "MOCK MODE: responses are simulated" banner. Production runs with mock mode off.

## 7. NKENNEAi client contract

```python
class NkenneClient:
    def translate(self, text: str, to_lang: str, from_lang: str = "English") -> str: ...
    def tts(self, text: str, language_slug: str, voice: str | None = None) -> tuple[bytes, str]: ...
    def speech_translate(self, audio: bytes, filename: str, pair: str) -> str: ...
```

- Base URL from `NKENNE_BASE_URL`. Header `Authorization: <key>` (no "Bearer").
- Timeouts: 30 s translate, 60 s TTS and ST.
- Retry: connection errors, timeouts and 5xx, up to 3 attempts with backoff 1 s, 2 s, 4 s. Never retry 4xx.
- Log every call to `ApiCallLog`.
- Raise a single `NkenneError(message, status_code)` that API views catch and return as `{"error": exc.user_message}` with status 502.

Full endpoint details are in NKENNEAI_API.md.

## 8. Deployment decisions and why

- **No Celery this week.** Render's free tier has no background worker and Redis is extra. Translation happens once per template; TTS once per unique sentence; ST once per reply. With caching, synchronous calls are acceptable. Keep the service layer pure so moving to Celery later is a decorator plus a `.delay()`. Say this in the README; it is a reasonable, defensible trade-off.
- **gunicorn `--timeout 120`** because a cold TTS or ST call can take tens of seconds.
- **Audio in Postgres** because Render's disk is wiped on every deploy.
- **One origin through a proxy.** Vercel serves the SPA and rewrites `/api`, `/admin` and `/static` to the Render service, with CDN caching disabled for those paths. No CORS; Django trusts the Vercel origin for CSRF (`CSRF_TRUSTED_ORIGINS`) and builds patient links from `FRONTEND_BASE_URL`. Vercel waits up to 120 s for a proxied response, which fits the gunicorn timeout.
- **Render free web services sleep after inactivity.** Open the app a few minutes before the demo, or upgrade for the day.

## 9. Security checklist

- [ ] `NKENNE_API_KEY` only in env vars; never in the frontend bundle, any `VITE_*` variable, or git.
- [ ] `DEBUG=False`, `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` set in production.
- [ ] Patient token from `secrets.token_urlsafe(24)`; no sequential IDs in patient URLs.
- [ ] Audio endpoints check the item or reply belongs to the token.
- [ ] Reply upload: max 5 MB, allowed MIME prefixes `audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`, `audio/wav`; ffmpeg rejects anything that is not decodable audio.
- [ ] Rate limit replies per token (e.g. 10 per hour) with a simple DB count.
- [ ] Staff API endpoints require login and return 401 JSON (not a redirect).
- [ ] CSRF on every unsafe method; the SPA sends `X-CSRFToken` from the `csrftoken` cookie.
- [ ] `/api/` never returns an HTML error page.
- [ ] No real patient data in the demo database.

## 10. API contract

All endpoints are under `/api/`. JSON in and out except audio, QR SVG, CSV and the multipart reply upload. Errors are `{"error": "<message>", "fields": {<field>: [<msg>]}}` (`fields` optional).

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/api/auth/csrf/` | set `csrftoken` cookie, `{mock_mode}` | none |
| POST | `/api/auth/login/` | `{username, password}` → `{user, mock_mode}` | none |
| POST | `/api/auth/logout/` | 204 (idempotent) | none |
| GET | `/api/auth/me/` | `{user, mock_mode}` or 401 | staff |
| GET | `/api/dashboard/` | recent instructions, unresolved reply count | staff |
| GET | `/api/templates/` | active instruction templates, placeholders, value rules | staff |
| GET/POST | `/api/instructions/` | list / create (201, 400 `fields`, 502 on `NkenneError`) | staff |
| GET | `/api/instructions/<id>/` | items, review status, patient_url, expires_at | staff |
| GET | `/api/instructions/<id>/qr.svg` | QR of the patient URL | staff |
| GET | `/api/instructions/<id>/items/<item_id>/audio/` | item audio | staff |
| GET | `/api/replies/?resolved=false` | inbox | staff |
| POST | `/api/replies/<id>/resolve/` | mark resolved | staff |
| GET | `/api/replies/<id>/audio/` | original recording | staff |
| GET | `/api/translations/` | English vs Swahili, status | staff |
| PATCH | `/api/translations/<id>/` | `{text?, approve?}` | staff |
| GET | `/api/usage/`, `/api/usage.csv` | ApiCallLog summary and export | staff |
| GET | `/api/p/<token>/` | patient instruction, labels, digits, `mock_mode` | token |
| GET | `/api/p/<token>/audio/<item_id>/` | item audio (404 unless on that token) | token |
| POST | `/api/p/<token>/reply/` | multipart `audio_file` + `consent=true` → 201; 400, 413, 429 | token |
| GET | `/healthz` | health check | none |

Frontend routes (React Router): `/login`, `/` (dashboard), `/instructions/new`, `/instructions/:id`, `/inbox`, `/translations`, `/usage`, and the public `/p/:token`. In production, Vercel returns `index.html` for any path it does not proxy to the API.

## 11. Project layout

```
itoni/
├── backend/
│   ├── config/                 # settings (env-driven), urls, wsgi
│   ├── instructions/
│   │   ├── models.py
│   │   ├── admin.py
│   │   ├── api/                # JSON views: auth.py, staff.py, patient.py, usage.py
│   │   │   └── serializers.py  # plain functions returning dicts
│   │   ├── services/
│   │   │   ├── nkenne.py       # HTTP client, retries, mock mode, logging
│   │   │   ├── translation.py  # placeholder protect/validate/fallback, caching
│   │   │   ├── audio.py        # TTS cache, ffmpeg conversion
│   │   │   ├── rendering.py    # values into text, create_instruction()
│   │   │   ├── qr.py           # patient URL to SVG
│   │   │   └── replies.py      # voice reply pipeline
│   │   ├── management/commands/  # seed_templates, translate_templates [--live], seed_demo
│   │   ├── seed_data.py
│   │   └── tests/
│   ├── scripts/                # setup_local_db.sh, nkenne_test.py
│   ├── manage.py
│   ├── build.sh                # Render build: pip install, collectstatic, migrate, seed_templates
│   ├── requirements.txt
│   └── .env.example            # .env is git-ignored
├── frontend/
│   ├── src/
│   │   ├── lib/api.ts          # fetch wrapper: credentials, CSRF, typed ApiError
│   │   ├── lib/types.ts        # mirrors API responses
│   │   ├── components/         # Layout, MockBanner, AudioPlayer, Recorder, DigitsBox
│   │   ├── pages/staff/        # Login, Dashboard, NewInstruction, InstructionDetail, Inbox, Translations, Usage
│   │   ├── pages/patient/      # PatientInstruction
│   │   └── App.tsx, main.tsx, index.css
│   ├── vite.config.ts          # dev proxy /api, /admin, /static -> :8000
│   ├── vercel.json             # production rewrites to the Render API
│   └── package.json
├── docs/
└── README.md
```

## 12. Tests worth writing (keep it to these)

Backend (`cd backend && python manage.py test`, always mock):
1. Placeholder protect → validate → restore round trip, including the failure path to fallback.
2. Translation cache: second call for the same template and language makes no API call (assert `ApiCallLog` count).
3. Audio cache key is stable and different per language.
4. Every staff endpoint returns 401 JSON without a session.
5. Create instruction: 201 happy path, 400 with `fields`, 502 on `NkenneError` with nothing saved.
6. Patient and staff audio endpoints return 404 for an item from another instruction or token.
7. Reply endpoint rejects missing consent, oversize and non-audio uploads, and rate-limits.
8. Mock client returns sentinel-preserving output.

Frontend: `npm run build` must pass with zero TypeScript errors (strict mode). No frontend test suite this week; the flows are checked by hand in the browser and on a phone.
