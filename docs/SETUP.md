# Ìtọ́ni: Local Setup

Target: Linux (Ubuntu). The repo is a monorepo:

- `backend/`: Django JSON API (Python 3.12 in production; 3.12+ locally)
- `frontend/`: React + TypeScript + Vite single-page app (Node 20+)

In development they run as two processes. You use the app through the Vite dev server, which proxies `/api` to Django so cookies and CSRF behave as in production.

## 1. Prerequisites

```bash
python3 --version          # 3.12+
node --version             # 20+
git --version
```
ffmpeg is **not** required system-wide: `imageio-ffmpeg` ships its own binary. If you want it anyway for manual testing: `sudo apt install ffmpeg`.

## 2. Clone and install

```bash
git clone git@github.com:dohoudaniel/itoni.git
cd itoni

# Backend (the virtualenv lives at the repo root and is named venv)
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

## 3. Backend environment

```bash
cp backend/.env.example backend/.env
```
Edit `backend/.env`:
- `DJANGO_SECRET_KEY`: generate one with
  `python -c "import secrets; print(secrets.token_urlsafe(50))"`
- `NKENNE_API_KEY`: from the NKENNEAi dashboard (Developer Tools → API Keys)
- Leave `NKENNE_MOCK=true` while building.

Check the key is not about to be committed:
```bash
git status --ignored | grep .env     # backend/.env must appear under "Ignored files"
```

The frontend has no secrets. `frontend/.env.example` holds non-secret settings only; anything in the frontend bundle is public.

## 4. Database and seed data

Quickest path (SQLite, mock mode, demo user `nurse` / `itoni-demo-123`):
```bash
cd backend
./scripts/setup_local_db.sh            # add "postgres" for local Postgres, "--reset" to wipe
```

Manual equivalent:
```bash
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_templates                # loads docs/TEMPLATES.md content
python manage.py translate_templates           # mock by default
```
When you are ready to spend real tokens (once):
```bash
python manage.py translate_templates --live
```
`--live` overrides mock mode for that command only. It skips templates whose translation already exists with a matching `source_hash`, so rerunning it costs nothing.

## 5. Run

Terminal 1 (API):
```bash
source venv/bin/activate
cd backend
python manage.py runserver             # http://localhost:8000
```

Terminal 2 (UI):
```bash
cd frontend
npm run dev                            # http://localhost:5173
```

- App (staff and patient screens): http://localhost:5173
- Django admin: http://localhost:5173/admin/ (proxied) or http://localhost:8000/admin/
- API health: http://localhost:8000/healthz

Always use the app through port 5173 in development. The Vite proxy forwards `/api`, `/admin` and `/static` to Django, so the browser sees one origin.

## 6. Testing on your phone (microphone needs HTTPS)

`localhost` counts as secure on the same machine, but your phone reaching your laptop over Wi-Fi does not. Tunnel to the **Vite** dev server (it proxies the API):

```bash
# Option A: Cloudflare (free, no account needed for quick tunnels)
cloudflared tunnel --url http://localhost:5173

# Option B: ngrok
ngrok http 5173
```
Then:
- Allow the tunnel host in Vite (`server.allowedHosts` in `frontend/vite.config.ts`, e.g. `.trycloudflare.com`).
- Add it to `backend/.env` so Django accepts the proxied requests:
  ```
  DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,.trycloudflare.com,.ngrok-free.app
  CSRF_TRUSTED_ORIGINS=http://localhost:5173,https://*.trycloudflare.com,https://*.ngrok-free.app
  ```
Restart both servers and open the tunnel URL on your phone.

## 7. API smoke test (spends real tokens)

```bash
cd backend
python scripts/nkenne_test.py
```
Makes 8 calls (5 translate, 1 voices, 1 TTS, 1 speech translation). Then open Usage Analytics in the dashboard and record the token cost in `docs/NKENNEAI_API.md` §7 and `docs/TOKEN_USAGE.md`.

## 8. Tests and checks

```bash
cd backend && python manage.py test    # forces mock mode, never spends tokens
cd frontend && npm run build           # must pass with zero TypeScript errors
```

## 9. Deploy (Vercel frontend + Render backend)

The browser only talks to the Vercel domain. Vercel serves the built SPA and proxies `/api`, `/admin` and `/static` to the Django service on Render, so the app stays same-origin: the session cookie is first-party (important for iPhone Safari) and no CORS is needed.

```
Browser -> https://<app>.vercel.app
             |- /, /p/:token, /assets ...  -> SPA (Vercel)
             '- /api/*, /admin/*, /static/* -> https://<api>.onrender.com
```

**Render (backend)**
1. Create a **PostgreSQL** instance (free). Copy its Internal Database URL.
2. Create a **Web Service** from the repo with root directory `backend`.
   - Build command: `./build.sh`
   - Start command: `gunicorn config.wsgi:application --timeout 120 --workers 2`
3. Environment variables:
   ```
   DJANGO_SECRET_KEY=<new random value>
   DJANGO_DEBUG=false
   DJANGO_ALLOWED_HOSTS=<api>.onrender.com
   CSRF_TRUSTED_ORIGINS=https://<app>.vercel.app
   FRONTEND_BASE_URL=https://<app>.vercel.app
   DATABASE_URL=<internal database url>
   NKENNE_API_KEY=<key>
   NKENNE_MOCK=false
   PYTHON_VERSION=3.12.7
   ```
   `CSRF_TRUSTED_ORIGINS` is needed because Django sees the Render host while the browser's origin is Vercel. `FRONTEND_BASE_URL` makes patient links and QR codes point at Vercel.
4. From the Render shell, once: `python manage.py translate_templates --live`, then `python manage.py createsuperuser` (or `seed_demo --password <strong>`). Never run `--live` in the build, so a redeploy never spends tokens.

**Vercel (frontend)**
1. Import the repo with root directory `frontend`, framework Vite, output `dist`, Node 22 (Vite 8 needs 20.19 or newer).
2. `frontend/vercel.json` holds the rewrites to the Render URL and disables CDN caching for proxied paths (per-session JSON and patient audio must never be cached). No environment variables are needed.

**Limits to know**
- Vercel waits up to 120 s for a proxied response. Template audio is pre-generated by `translate_templates --live`, so creating an instruction needs at most a couple of fresh TTS calls.
- Render free services sleep when idle; the first request can take 30 to 60 s. Wake the app before any demo.

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 Unauthorized` from NKENNEAi | Key missing, wrong, or sent with "Bearer" | Send the raw key in `Authorization` (check `ApiCallLog` in admin) |
| `400 Invalid language combination` | Wrong language string | Use the exact value `"Swahili"` |
| `/api/...` returns 401 after logging in | Using port 8000 directly, or cookie not sent | Use http://localhost:5173; `api.ts` sends `credentials: "same-origin"` |
| `403 CSRF` on POST | `X-CSRFToken` header missing, or origin not trusted | Call `/api/auth/csrf/` first; add the origin to `CSRF_TRUSTED_ORIGINS` |
| Vite "Blocked request. This host is not allowed" | Tunnel host not allowed | Add it to `server.allowedHosts` in `vite.config.ts` |
| Reply upload works on laptop, fails on phone | Not HTTPS | Use the tunnel or the Render URL |
| ST returns 400 or empty text | WebM sent directly | Check ffmpeg conversion ran; look at `Reply.error` |
| Worker timeout on Render | Slow TTS/ST call | Confirm `--timeout 120` in the start command |
| Audio missing after redeploy | Stored on disk | Store in the DB as designed |
| Tokens draining | Mock mode off during dev | Set `NKENNE_MOCK=true`; check the Usage screen |
