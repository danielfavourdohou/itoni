# NKENNEAi API: Integration Notes

Source: the four API documentation PDFs sent to finalists on 21 October 2026 (Text-to-Text, Text-to-Speech, Speech-to-Text, Speech Translation), which match https://nkenne.ai/nkenneai-api.

> **Hackathon rule:** Swahili is the only supported language for this event. The docs list Yoruba and Nigerian Pidgin too; do not use them. Every call in Ìtọ́ni is English ↔ Swahili.

- **Base URL:** `https://developers-api.nkenne.ai`
- **Auth header:** `Authorization: YOUR_API_KEY` (raw key, no "Bearer")
- **Get a key:** dashboard → Developer Tools → API Keys
- **Hackathon tokens:** 1,000 initial from the organizers, more in batches of 1,000 on approved request. Cost per call is not documented; it is measured in section 7.

---

## 1. Text-to-Text translation

`POST /api/translate/with-api-key` · `Content-Type: application/json`

```json
{ "text": "Take this medicine after food.", "fromLanguage": "English", "toLanguage": "Swahili" }
```
Response 200: `{ "translatedText": "..." }`

Language strings are exact: `"English"`, `"Swahili"`. One side must be English.

| Code | Body | Meaning |
|---|---|---|
| 401 | `{"error": "Unauthorized"}` | Missing or bad key |
| 400 | `{"error": "Invalid language combination"}` | Pair not allowed |
| 400 | `{"error": "text, fromLanguage and toLanguage are required"}` | Missing field |

## 2. Text-to-Speech

`POST /api/tts/v1/swahili/with-api-key` · `Content-Type: application/json`

```json
{ "text": "...", "voice_name": "<id from voices endpoint>", "speaking_rate": 1.0 }
```
`voice_name` and `speaking_rate` (0.5 to 2.0) are optional. Consider `0.9` for older patients.

Response 200: binary audio (`audio/mpeg` or `audio/wav`). Save `response.content`.

Voices: `GET /api/tts/v1/swahili/voices` → `{ "language", "default_voice", "voices": [{id, name, gender}] }`. Call once, store the ID in `NKENNE_VOICE_SWAHILI`.

Errors: 401 bad key, 400 empty text, 404 unknown language slug or voice.

## 3. Speech-to-Text (not used directly)

`POST /api/stt/v1/swahili/with-api-key` · multipart field `audio_file` (max 25 MB).
Formats: WAV (16-bit PCM recommended), MP3, M4A/AAC, FLAC, OGG. **WebM is not listed.**
Response: `{ "text", "duration", "language" }`.

Ìtọ́ni uses Speech Translation instead: one call instead of STT + translate, which saves tokens and avoids compounding errors (the docs recommend this).

## 4. Speech Translation (patient replies)

`POST /api/st/v1/swahili-to-english/with-api-key` · multipart field `audio_file` (max 25 MB).

Response 200:
```json
{ "translated_text": "...", "source_language": "swahili", "target_language": "english" }
```
Note `translated_text` (snake_case) here vs `translatedText` (camelCase) for text translation.

Errors: 401 bad key, 400 `Unsupported translation pair slug`, 413 file over 25 MB.

## 5. Language mapping in Ìtọ́ni

| `Language` value | Translate `toLanguage` | TTS slug | Reply ST pair |
|---|---|---|---|
| `swahili` | `"Swahili"` | `swahili` | `swahili-to-english` |

Keep this table in one dict in `backend/instructions/services/nkenne.py` so adding a language later is one line.

## 6. Audio conversion for replies

```bash
ffmpeg -y -i input.webm -vn -ac 1 -ar 16000 -c:a libopus -b:a 24k output.ogg
```
- Mono 16 kHz matches the STT guidance.
- If OGG/Opus is rejected in practice, use WAV: `-c:a pcm_s16le output.wav`.
- Binary path: `imageio_ffmpeg.get_ffmpeg_exe()`; run with `subprocess.run([...], timeout=30, check=True)` on temp files, never through a shell string.

## 7. Measured results (fill in after `cd backend && python scripts/nkenne_test.py`)

| Question | Result |
|---|---|
| Tokens per translate call | |
| Tokens per TTS call (short sentence) | |
| Tokens per ST call (~10 s audio) | |
| Do `{curly}` placeholders survive? | |
| Do `[[1]]` sentinels survive? | |
| Are "500mg", "2", "5" preserved? | |
| How does Swahili TTS read "500mg"? | |
| Swahili voice IDs available | |
| Typical latency translate / TTS / ST | |
