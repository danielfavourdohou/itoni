# Ìtọ́ni

Patient instructions in **Swahili**, as text and audio, with **Swahili voice replies** translated into English for clinic staff.

Built for the Build With NKENNEAi Hackathon (October 2026) using three NKENNEAi APIs: Text-to-Text translation, Text-to-Speech, and Speech Translation. Swahili is the only language supported for this hackathon.

## Problem

In many East African clinics and pharmacies, prescription labels and instructions are written in English, while many patients are more comfortable in Swahili. Older patients and people with poor eyesight or limited formal education also struggle with small printed text. Patients leave unsure how to take their medicine, when to come back, or which danger signs need urgent care.

## Who it is for

- **Patients and caregivers** who understand Swahili better than English, including those who find reading hard.
- **Nurses, pharmacists and front-desk staff** who need to give clear instructions quickly without acting as translators.

## How it works

1. Staff pick reviewed instruction templates (dose, take after food, follow-up date, danger signs) and fill in the values.
2. Ìtọ́ni shows the instruction in Swahili as text and audio, plus a QR code.
3. The patient scans it and reads or listens on their phone. No app install. Numbers are always shown as digits too.
4. The patient can tick consent, tap Reply, and speak in Swahili. Staff read the reply in English.

## Features

- Swahili instruction templates with a human review step
- Spoken Swahili audio for every instruction
- QR code and link handover at the counter
- Voice replies (in-browser recording or audio upload) translated to English
- Staff inbox with original audio and resolve status
- Placeholder and number validation so doses are never silently changed
- Token usage log and usage page

## NKENNEAi integration

| API | Endpoint | Role in Ìtọ́ni |
|---|---|---|
| Text-to-Text | `POST /api/translate/with-api-key` (English → Swahili) | Translates instruction templates and interface labels once, then cached |
| Text-to-Speech | `POST /api/tts/v1/swahili/with-api-key` | Turns each Swahili instruction into audio, cached by content hash |
| Speech Translation | `POST /api/st/v1/swahili-to-english/with-api-key` | Turns a patient's Swahili voice reply into English text in one call |

All calls go through `backend/instructions/services/nkenne.py`: one client with timeouts, retries on network errors and 5xx only, typed errors shown to staff, and a log row per call. Details: [docs/NKENNEAI_API.md](docs/NKENNEAI_API.md).

## Token usage and testing approach

- Development and automated tests run in **mock mode** (no API calls).
- Each template is translated once; each unique sentence gets audio once (content-hash cache).
- Speech Translation replaces STT + translate, halving calls per reply.
- Full numbers and breakdown: [docs/TOKEN_USAGE.md](docs/TOKEN_USAGE.md).

**Mock mode disclosure:** when `NKENNE_MOCK=true`, responses are simulated and every screen shows a red MOCK banner. The deployed demo and the demo video use live NKENNEAi calls only.

## Stack and third-party components

Monorepo. Backend: Django 5.2 JSON API, PostgreSQL (SQLite locally), `imageio-ffmpeg` (bundled ffmpeg), `qrcode`, `requests`, WhiteNoise, gunicorn. Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, `lucide-react`, browser MediaRecorder. Frontend hosted on Vercel, API and database on Render; Vercel proxies `/api` so the app stays same-origin. No datasets. No pre-existing code from other projects. Landing page photo by [Speak Media Uganda](https://www.pexels.com/photo/nurse-caring-for-child-in-hospital-setting-34185202/) on Pexels (Pexels License); all illustrations are original.

## Setup

```bash
git clone git@github.com:dohoudaniel/itoni.git && cd itoni

# Backend (terminal 1)
python3 -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt
cd backend
./scripts/setup_local_db.sh     # creates .env, SQLite DB, mock data, user nurse / itoni-demo-123
python manage.py runserver      # API on http://localhost:8000

# Frontend (terminal 2)
cd frontend && npm install && npm run dev    # app on http://localhost:5173
```

Mock mode needs no API key. To use NKENNEAi for real, set `NKENNE_API_KEY` and `NKENNE_MOCK=false` in `backend/.env`, then run `python manage.py translate_templates --live` once.

Full instructions, phone testing over HTTPS and deployment (Vercel + Render): [docs/SETUP.md](docs/SETUP.md).

## Demo

- Live app: _add Render URL_
- Demo video: _add link_

To test: log in, create an instruction, open the QR link on a phone, play the audio, then send a Swahili voice reply and check the Inbox.

## Known limitations

- Templates use standard pharmacy wording but have **not been approved by a clinician**. Real use requires that.
- Swahili only, by hackathon rule. The language is stored as data, so adding others is small work once supported.
- The developer is not a Swahili speaker; translations were reviewed by _name / role_.
- Needs a smartphone with data. SMS and WhatsApp delivery are future work.
- Browser reminders are unreliable on iPhone and on some Android battery savers.
- Calls run synchronously (no task queue) to fit the free hosting tier; the service layer is ready to move behind Celery.
- Not a medical device and gives no medical advice.

## Future improvements

SMS and WhatsApp delivery, clinician template approval workflow, more African languages, multi-clinic accounts, background job queue.

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [NKENNEAi API](docs/NKENNEAI_API.md) · [Templates](docs/TEMPLATES.md) · [Setup](docs/SETUP.md) · [Token usage](docs/TOKEN_USAGE.md)

## License

MIT
