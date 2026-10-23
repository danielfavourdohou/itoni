# Seed Templates

These are the instruction templates loaded by `python manage.py seed_templates` (run from `backend/`; wording lives in `backend/instructions/seed_data.py`). They are written as plain, standard pharmacy-style wording.

**Before any real-world use, a clinician must approve this wording, and a fluent reader must review each translation.** For the hackathon demo, state that clearly.

Placeholders use `{name}`. Values are always also shown in the structured block with digits (see ARCHITECTURE.md §5).

## Instruction templates

| # | key | Title (staff) | English text | Fallback English (no placeholders) | Placeholders |
|---|---|---|---|---|---|
| 1 | `medication_dose` | Dose and duration | Take {dose} of {drug}, {times_per_day} times a day, for {days} days. | Take this medicine as shown in the box below. | dose, drug, times_per_day, days |
| 2 | `after_food` | Take after food | Take this medicine after eating food. | (same) | none |
| 3 | `finish_course` | Finish the course | Finish all of this medicine, even if you start to feel better. | (same) | none |
| 4 | `no_alcohol` | No alcohol | Do not drink alcohol while you are taking this medicine. | (same) | none |
| 5 | `follow_up` | Follow-up visit | Come back to the clinic on {date}. | Come back to the clinic on the date shown below. | date |
| 6 | `warning_signs` | Danger signs | Go to the hospital immediately if you find it hard to breathe, have a very high fever, or vomit everything you eat or drink. | (same) | none |

## Structured block labels

Short labels used on the patient screen (schedule box, reply section, footer). Translated and reviewed once each. The frontend gets them from `GET /api/p/<token>/` as `labels`, so no patient-facing text is hardcoded.

| key | English |
|---|---|
| `label_medicine` | Medicine |
| `label_dose` | Dose |
| `label_times_per_day` | Times a day |
| `label_days` | Number of days |
| `label_return_date` | Come back on |
| `label_reply_button` | Ask the clinic a question |
| `label_reply_hint` | Tap and speak. Tap again to send. |
| `label_reply_received` | The clinic has received your message. |
| `label_reply_consent` | I agree that my voice recording will be sent to NKENNEAi to be translated for the clinic. |
| `label_safety_footer` | If you feel worse or you are not sure, call the clinic or go to the hospital. |
| `label_heading` | Your instructions from the clinic |
| `label_play` | Listen |
| `label_pause` | Pause |
| `label_link_expired` | This link has expired. Please contact the clinic. |
| `label_reply_upload` | Or choose a voice note from your phone |
| `label_reply_error` | The message could not be sent. Please try again. |
| `label_reply_too_many` | You have sent many messages. Please wait, or call the clinic. |
| `label_reply_mic_blocked` | The microphone is blocked. You can choose a voice note instead. |

## Value formats

| Placeholder | Example | Rule |
|---|---|---|
| `dose` | `500mg`, `1 tablet`, `5ml` | Free text, max 20 chars |
| `drug` | `Amoxicillin` | Free text, max 60 chars; never translated |
| `times_per_day` | `2` | Integer 1 to 6 |
| `days` | `5` | Integer 1 to 90 |
| `date` | `24/10/2026` | Rendered `DD/MM/YYYY`, the format used in Kenya and Tanzania |

## Demo patients (fake data only)

| Label | Language | Templates | Values |
|---|---|---|---|
| Mama A. | Swahili | 1, 2, 3, 5, 6 | Amoxicillin, 500mg, 2 times a day, 5 days, return 31/10/2026 |
| Baba T. | Swahili | 1, 4, 6 | Paracetamol, 1 tablet, 3 times a day, 3 days |

## Review checklist for the Swahili reader

- Standard, everyday Swahili a patient would hear from a nurse (not overly formal).
- Meaning matches the English exactly, nothing softened or added.
- Numbers, drug names and dates unchanged.
- Wording is how a nurse would say it, not stiff or literary.
- The danger-signs sentence is clear and urgent.
