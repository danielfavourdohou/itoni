# Translations: reviewing and adding Swahili

Every sentence a patient sees starts as English, is translated to Swahili once by NKENNEAi, and should be checked by a fluent Swahili reader before patients rely on it. This guide covers both jobs:

- **Part 1, reviewing** (any staff member, in the app, no tokens): check, correct and approve the Swahili.
- **Part 2, adding a new sentence** (a developer, in the code, costs a few tokens): add an English template and get its Swahili.

The screen reviews existing sentences only; it cannot create new ones. That is deliberate: a new instruction changes what patients are told, so it goes through the code and the template list ([TEMPLATES.md](TEMPLATES.md)).

---

## Part 1: Reviewing in the Translations screen

### Open it

Log in, then choose **Translations** in the menu (on phones, **Review** in the bottom bar). The screen is headed **"Every sentence checked by a fluent Swahili reader."** with a progress bar: **"5 of 27 reviewed"**. The dashboard's **Translations to review** count goes down as you approve.

### Find what needs review

- The list on the left has two groups: **Instructions** (the 6 sentences staff send) and **Patient screen labels** (the 21 words and phrases on the patient screen, such as "Listen" or "Send").
- Tabs filter the list: **To review** (the default), **Reviewed**, or **All**.
- Each item shows its status:

| Status | Meaning | What to do |
|---|---|---|
| **Needs review** | Real Swahili from NKENNEAi, not yet checked | Read it, correct it if needed, approve |
| **Reviewed** | Approved by a named staff member | Nothing, unless it needs changing |
| **Mock text** | Placeholder text from mock mode (starts with `[MOCK-SW]`) | Write the real Swahili, or run the live translation (Part 2, step 3) |
| **Not translated** | No Swahili yet | Run the translation (Part 2, step 3) |

On a phone, the list and the editor are separate screens: tap an item to open it, and use the back arrow to return.

### Review one item

1. **Read the English** at the top, then the **Swahili** in the box below it.
2. **If the Swahili is right,** press **Approve**. A message confirms it (**"Take after food approved"**, with **Undo**), and the next item still needing review opens by itself, so you can work down the list.
3. **If it needs changing,** edit the text in the box. The buttons change to:
   - **Save and approve**: save your wording and approve it in one step.
   - **Save without approving**: keep a draft for someone else to check.
   - **Discard changes**: go back to the saved text (it asks first).
4. **Sentences with values** (the dose and the follow-up date) show their placeholders under the box, under **Keep exactly once:**, for example `{dose}` `{drug}` `{times_per_day}` `{days}`. Each turns green when it appears exactly once in your text. Move them to wherever Swahili word order needs them, but never delete, rename or repeat one: the screen refuses to save until they are right. That rule is what stops a dose being changed by a translation.
5. **To withdraw an approval** (for example, someone approved by mistake), open the item and press **Undo approval**.

If you edit a sentence that was already approved, it goes back to **Needs review** unless you use **Save and approve**: changed wording always needs a fresh approval.

### What each change affects

| Change | Effect |
|---|---|
| Approving | The "Unreviewed translation" badge disappears from that sentence on every instruction page; "Reviewed by" shows your username and the time |
| Editing a sentence's wording | **New** instructions use the new wording. Instructions already handed to patients keep the text they were created with, so a patient's page never changes under them |
| Editing a sentence that has audio | The next instruction that uses it makes new audio (one Text-to-Speech call). While NKENNEAi blocks calls from the production server (known issue 2 in [NKENNEAI_API.md](NKENNEAI_API.md)), that sentence goes out text-only, with an "Audio unavailable" note for staff |
| Editing a patient-screen label | Shows on every patient screen straight away (labels are read live) |

No change in this screen calls NKENNEAi or spends tokens, except the audio regeneration above.

### What makes good Swahili here

See the reviewer checklist in [TEMPLATES.md](TEMPLATES.md). In short: everyday Swahili a nurse would say; instructions as commands ("Maliza…", "Rudi…"), not infinitives ("Kumaliza…"); numbers after the noun ("mara {times_per_day} kwa siku, kwa siku {days}"); nothing softened, added or left in English.

### Messages you might see

| Message | Cause | Fix |
|---|---|---|
| **This is mock text. Write the real Swahili (or run the live translation) before approving.** | The text is still the mock placeholder | Replace it with real Swahili, then approve |
| **Keep each of these exactly once: {days}.** | A placeholder is missing or repeated | Put that placeholder back, once |
| **Unknown placeholder: {siku}.** | A placeholder was renamed or translated | Use the exact English name in braces |
| **Enter the Swahili text.** | The box is empty | Write the text |
| **Discard your Swahili edits?** | You are leaving an item with unsaved changes | **Keep editing**, or **Discard edits** |

---

## Part 2: Adding a new sentence (developer)

Example: a new instruction "Store this medicine in a cool, dry place."

1. **Write the English** in `backend/instructions/seed_data.py`, in `INSTRUCTION_TEMPLATES` (list order is the order staff and patients see):
   ```python
   {
       "key": "storage",                      # unique, lowercase, letters and underscores
       "title": "Storage",                    # what staff see in the form
       "english_text": "Store this medicine in a cool, dry place.",
   },
   ```
   For a sentence with values, add `"placeholders": [...]` and a `"fallback_english_text"` with the same meaning and **no** placeholders (used if the placeholders do not survive translation). Placeholders must be one of the value names the form already knows (`dose`, `drug`, `times_per_day`, `days`, `date`, defined in `backend/instructions/services/values.py`); a new kind of value needs a rule there too. Avoid idioms: they get translated word for word.
2. **Load it** (free, from `backend/`):
   ```bash
   python manage.py seed_templates
   ```
   It now appears in the New instruction form, in English, and on the Translations screen as **Not translated**.
3. **Translate it** (costs tokens: one translation, plus one audio clip for a sentence without values; everything already translated is skipped):
   ```bash
   python manage.py translate_templates --live
   ```
4. **Review it** in the Translations screen (Part 1).
5. **Document it:** add a row to [TEMPLATES.md](TEMPLATES.md).

**On production,** run steps 2 and 3 against the production database from your laptop, the same way as the data copy in [SETUP.md](SETUP.md) (`export DATABASE_URL='<External Database URL>?sslmode=require'`, check the host, run the commands, `unset DATABASE_URL`). Calls from a laptop are not blocked by NKENNEAi's Cloudflare rule; calls from the server are. Redeploying also runs `seed_templates`, so step 2 happens automatically once the code is pushed.

**Changing existing English** works the same way: edit `seed_data.py`, run `seed_templates` and `translate_templates --live`. Because the English changed, that sentence is translated again and **replaces the reviewed Swahili**, back to **Needs review**. Unchanged sentences, and every edit a reviewer made to them, are kept.

**A new patient-screen label** (`LABEL_TEMPLATES`) follows the same steps, but the frontend must also use it (patient screen components read `labels.label_<name>`); a label nobody reads has no effect.

**Locally, in mock mode,** step 3 without `--live` creates `[MOCK-SW]` placeholders for free, which is enough to try the flow.
