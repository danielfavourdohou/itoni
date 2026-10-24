# Setup

Run Ìtọ́ni on your machine in about five minutes, with no API key and no cost: it starts in **mock mode**, where NKENNEAi is simulated and every screen says so with a red banner. Sections 5 to 7 cover real API calls, phone testing and deployment.

The repo is a monorepo:

- `backend/`: Django JSON API (Python 3.12 in production, 3.12 or newer locally)
- `frontend/`: React, TypeScript and Vite single-page app (Node 20.19 or newer)

In development they run as two processes. You use the app through the Vite dev server on port 5173, which forwards `/api`, `/admin` and `/static` to Django, so cookies and CSRF behave exactly as in production.

## 1. Prerequisites

```bash
python3 --version   # 3.12 or newer
node --version      # 20.19 or newer
git --version
```

Nothing else: ffmpeg comes bundled with the `imageio-ffmpeg` package, and the default database is SQLite.

## 2. Install and start

```bash
git clone https://github.com/dohoudaniel/itoni.git && cd itoni
```

**Terminal 1, backend:**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
./scripts/setup_local_db.sh
python manage.py runserver
```

`setup_local_db.sh` does everything once: creates `backend/.env` from `.env.example` with a fresh secret key, creates the SQLite database, loads the templates, makes mock Swahili translations and two demo patients, and creates the staff user **nurse / itoni-demo-123**. It never calls NKENNEAi. Options: `./scripts/setup_local_db.sh postgres` for a local PostgreSQL (needs `sudo apt install postgresql`), `--reset` to start over.

**Terminal 2, frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 3. Use it

| What | Where |
|---|---|
| Landing page and patient sample | http://localhost:5173 (press "See a patient's screen") |
| Staff app | http://localhost:5173/login, user `nurse`, password `itoni-demo-123` |
| API reference | http://localhost:5173/api/docs (staff only locally; see `ITONI_API_DOCS_PUBLIC`) |
| Django admin | http://localhost:5173/admin/ (needs a superuser: `python manage.py createsuperuser`) |

Always use port 5173, not 8000: the session cookie and CSRF only line up through the Vite proxy.

A quick tour: on the dashboard press **New instruction**, pick a few instructions, fill the values and create it. Open the patient link from the instruction page, play the audio (a short test tone in mock mode), tick consent and send a voice note, then read it in **Inbox**. Everything shows the red MOCK banner.

## 4. Tests

```bash
cd backend && python manage.py test   # 134 tests, always mock, never touch the network
cd frontend && npm run build          # strict TypeScript; must finish with no errors
```

## 5. Use the real NKENNEAi API (costs tokens)

1. Get a key: sign in at https://developers.nkenne.ai, then **Developer Tools**, **API Key Management**, **Create New Key**.
2. In `backend/.env`, set `NKENNE_API_KEY=<your key>`. Leave `NKENNE_MOCK=true` for now. The file is git-ignored; check with `git check-ignore -v backend/.env`.
3. Translate everything once (about 31 calls: 27 translations and 4 audio clips; reruns cost nothing):
   ```bash
   cd backend && python manage.py translate_templates --live
   ```
4. Rebuild the demo patients with real audio (about 3 calls): `NKENNE_MOCK=false python manage.py seed_demo`.
5. Review the Swahili in the **Translations** screen ([TRANSLATIONS.md](TRANSLATIONS.md)).
6. To make the running app live, set `NKENNE_MOCK=false` in `.env` and restart Django. From then on, creating instructions and sending replies spend tokens; the **Usage** screen shows every call.

Optional: `python scripts/nkenne_test.py` is the smoke test used to measure costs (8 calls). Results are in [NKENNEAI_API.md](NKENNEAI_API.md), section 7.

## 6. Test on a phone

Browsers only allow the microphone over HTTPS, and a phone reaching your laptop over Wi-Fi is plain HTTP. Tunnel the Vite server:

```bash
cloudflared tunnel --url http://localhost:5173    # or: ngrok http 5173
```

Vite already allows `*.trycloudflare.com` and `*.ngrok-free.app`. Tell Django too, in `backend/.env`, then restart it:

```
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,.trycloudflare.com,.ngrok-free.app
CSRF_TRUSTED_ORIGINS=http://localhost:5173,https://*.trycloudflare.com,https://*.ngrok-free.app
FRONTEND_BASE_URL=https://<your-tunnel-host>
```

`FRONTEND_BASE_URL` makes QR codes point at the tunnel. Open the tunnel URL on the phone.

## 7. Deploy (Vercel frontend, Render backend)

The browser only ever talks to the Vercel domain. Vercel serves the React app and forwards `/api`, `/admin` and `/static` to Django on Render, so the app stays on one origin: the session cookie is first-party (iPhone Safari blocks third-party cookies) and no CORS is needed.

```
Browser -> https://<app>.vercel.app
             |- /, /login, /p/<token>, /assets ...   -> React app (Vercel)
             '- /api/*, /admin, /static/*            -> https://<service>.onrender.com
```

### Render: database and API

1. **New, PostgreSQL** (free). Keep its Internal and External URLs.
2. **New, Web Service** from the repo, **same region** as the database:
   - Root directory `backend`, runtime Python
   - Build command `./build.sh` (installs, collects static files, migrates, loads templates; never calls NKENNEAi)
   - Start command `gunicorn config.wsgi:application --timeout 120 --workers 2`
   - Health check path `/healthz`
3. **Environment:** copy every variable from [backend/.env.production.example](../backend/.env.production.example) and fill in the real values. The important ones: `DJANGO_DEBUG=false`, `DATABASE_URL` (Internal URL), `NKENNE_API_KEY`, `NKENNE_MOCK=false`, `CSRF_TRUSTED_ORIGINS` and `FRONTEND_BASE_URL` (both the Vercel URL), `ITONI_API_DOCS_PUBLIC=true` to publish `/api/docs`.
4. **Data, without paying twice:** translate and seed on your laptop (section 5), then copy the rows to Render. The free plan has no shell, so run this from `backend/` on your laptop:
   ```bash
   python manage.py dumpdata instructions.template instructions.templatetranslation \
     instructions.audioclip instructions.apicalllog --natural-foreign -o scripts/out/itoni_live.json
   export DATABASE_URL='<External Database URL>?sslmode=require'
   python manage.py shell -c "from django.db import connection; print(connection.settings_dict['HOST'])"  # must end in render.com
   python manage.py loaddata scripts/out/itoni_live.json
   NKENNE_MOCK=false python manage.py seed_demo --password '<strong password>'   # same day: audio comes from the cache
   unset DATABASE_URL
   ```

### Vercel: frontend

1. **Add New Project** from the repo: root directory `frontend`, framework Vite, build `npm run build`, output `dist`, Node 22. No environment variables (nothing secret lives in the frontend).
2. Put your Render URL in [frontend/vercel.json](../frontend/vercel.json). Its rewrites use `(.*)` patterns because Django URLs end in a slash, which Vercel's `:path*` does not match.

### Keeping it awake

Render's free plan sleeps after about 15 idle minutes and takes 30 to 60 s to wake. [.github/workflows/keep-warm.yml](../.github/workflows/keep-warm.yml) pings `/healthz` every 10 minutes (edit the URL for your service), and the frontend retries its first request for up to two minutes while the server wakes.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| A page or `/api/...` answers 401 after logging in | Using port 8000 directly | Use http://localhost:5173 |
| `403` CSRF on a POST | Origin not trusted | Add the origin to `CSRF_TRUSTED_ORIGINS` |
| Vite "Blocked request. This host is not allowed" | Unknown tunnel host | Add it to `server.allowedHosts` in `frontend/vite.config.ts` |
| Voice note works on the laptop, not the phone | Plain HTTP | Use the tunnel or the deployed site |
| NKENNEAi `401` | Key missing or regenerated | Copy the current key from Developer Tools into `.env` (or Render) |
| NKENNEAi `403` with `server=cloudflare`, "Just a moment..." in the call log | Cloudflare challenges your server's address | A provider-side block (known issue 2 in [NKENNEAI_API.md](NKENNEAI_API.md)); calls from a home connection work |
| Replies marked "Translation failed", call log shows `500` | NKENNEAi speech service failing (known issue 1) | Recordings are kept; retry later |
| `/login` or `/api/...` gives a 404 on Vercel | `vercel.json` not applied | Root directory must be `frontend`; redeploy the latest commit |
| Render deploy stuck, health check 400 | Old code before the health-check fix | Deploy the latest commit |
| Tokens draining while developing | Mock mode off | Set `NKENNE_MOCK=true`; check the Usage screen |

Every NKENNEAi call, with its status, latency and a safe error summary, is listed in Django admin under **Api call logs**: the first place to look for any API problem.
