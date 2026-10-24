# Templates

Every sentence a patient can receive, and every word on the patient screen, comes from this list. The wording lives in `backend/instructions/seed_data.py` and is loaded with `python manage.py seed_templates` (from `backend/`, free).

**Status.** The English is standard pharmacy-style wording, **not yet approved by a clinician**. The Swahili is NKENNEAi machine translation; each item is marked "Unreviewed" in the staff app until a fluent reader approves it in the **Translations** screen. Real-world use needs both approvals. How to review in the app, and how to add a new sentence: [TRANSLATIONS.md](TRANSLATIONS.md).

Placeholders use `{name}`. Whatever the sentence says, the values are also shown as digits on the patient screen (see [ARCHITECTURE.md](ARCHITECTURE.md), section 5).

## Instruction templates (6)

| # | Key | Title for staff | English | Fallback English (no placeholders) | Placeholders |
|---|---|---|---|---|---|
| 1 | `medication_dose` | Dose and duration | Take {dose} of {drug}, {times_per_day} times a day, for {days} days. | Take this medicine as shown in the box below. | dose, drug, times_per_day, days |
| 2 | `after_food` | Take after food | Take this medicine after eating food. | (same) | none |
| 3 | `finish_course` | Finish the course | Finish all of this medicine, even if you start to feel better. | (same) | none |
| 4 | `no_alcohol` | No alcohol | Do not drink alcohol while you are taking this medicine. | (same) | none |
| 5 | `follow_up` | Follow-up visit | Come back to the clinic on {date}. | Come back to the clinic on the date shown below. | date |
| 6 | `warning_signs` | Danger signs | Go to the hospital immediately if you find it hard to breathe, have a very high fever, or vomit everything you eat or drink. | (same) | none |

The fallback is used only if the placeholders do not survive translation, so a dose can never be silently changed. Danger signs is shown in a red warning box on the patient screen.

Template 6 was reworded on 23 Oct 2026: the idiom "cannot keep food or water down" came back word for word as "cannot put food or water on the ground".

## Patient screen labels (21)

Translated once and served to the patient screen as `labels` by `GET /api/p/<token>/`, so no patient-facing text is hardcoded in English.

| Key | English | Where it appears |
|---|---|---|
| `label_heading` | Your instructions from the clinic | Top of the screen |
| `label_play` | Listen | Play buttons |
| `label_pause` | Pause | Play buttons, while playing |
| `label_medicine` | Medicine | Digits box |
| `label_dose` | Dose | Digits box |
| `label_times_per_day` | Times a day | Digits box |
| `label_days` | Number of days | Digits box |
| `label_return_date` | Come back on | Digits box |
| `label_reply_button` | Ask the clinic a question | Reply section |
| `label_reply_consent` | I agree that my voice recording will be sent to NKENNEAi to be translated for the clinic. | Consent box (recording stays disabled until ticked) |
| `label_reply_hint` | Tap and speak. Tap again to stop. | While recording |
| `label_reply_send` | Send | After recording |
| `label_reply_again` | Record again | After recording |
| `label_reply_upload` | Or choose a voice note from your phone | Upload option |
| `label_reply_received` | The clinic has received your message. | After sending |
| `label_reply_error` | The message could not be sent. Please try again. | Send failed |
| `label_reply_too_many` | You have sent many messages. Please wait, or call the clinic. | Rate limit |
| `label_reply_mic_blocked` | The microphone is blocked. You can choose a voice note instead. | Microphone refused |
| `label_safety_footer` | If you feel worse or you are not sure, call the clinic or go to the hospital. | Footer |
| `label_call_clinic` | Call the clinic | Tap-to-call button (shown when a clinic phone is set) |
| `label_link_expired` | This link has expired. Please contact the clinic. | Expired, revoked or unknown link |

## Value rules

Enforced by the API and shown as hints in the staff form.

| Placeholder | Example | Rule |
|---|---|---|
| `dose` | `500mg`, `1 tablet`, `5ml` | Free text, at most 20 characters |
| `drug` | `Amoxicillin` | Free text, at most 60 characters; never translated |
| `times_per_day` | `2` | Whole number, 1 to 6 |
| `days` | `5` | Whole number, 1 to 90 |
| `date` | `30/10/2026` | Not in the past; shown as `DD/MM/YYYY`, the format used in Kenya and Tanzania |

## Demo patients (fake data)

Created by `python manage.py seed_demo`. Mama A. is the public sample behind the landing page's "See a patient's screen" (valid for a year).

| Label | Templates | Values |
|---|---|---|
| Mama A. | 1, 2, 3, 5, 6 | Amoxicillin, 500mg, 2 times a day, 5 days, return date 7 days after seeding |
| Baba T. | 1, 4, 6 | Paracetamol, 1 tablet, 3 times a day, 3 days |

## Checklist for the Swahili reviewer

- Everyday Swahili a nurse would say to a patient, not formal or literary.
- Meaning matches the English exactly: nothing softened, added or left out.
- Instructions are commands ("Maliza…", "Rudi…"), not infinitives ("Kumaliza…", "Kurudi…").
- In the dose sentence, numbers follow the noun, as in Swahili: "mara {times_per_day} kwa siku, kwa siku {days}". Every `{placeholder}` must stay exactly once (the screen checks this).
- Numbers, drug names and dates unchanged.
- The danger-signs sentence is clear and urgent.
- No English words left in (for example "Dose ya").
