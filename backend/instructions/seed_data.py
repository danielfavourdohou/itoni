"""Seed templates. Mirrors docs/TEMPLATES.md. Wording must be clinician-approved before real use."""

INSTRUCTION_TEMPLATES = [
    {
        "key": "medication_dose",
        "title": "Dose and duration",
        "english_text": "Take {dose} of {drug}, {times_per_day} times a day, for {days} days.",
        "fallback_english_text": "Take this medicine as shown in the box below.",
        "placeholders": ["dose", "drug", "times_per_day", "days"],
    },
    {
        "key": "after_food",
        "title": "Take after food",
        "english_text": "Take this medicine after eating food.",
    },
    {
        "key": "finish_course",
        "title": "Finish the course",
        "english_text": "Finish all of this medicine, even if you start to feel better.",
    },
    {
        "key": "no_alcohol",
        "title": "No alcohol",
        "english_text": "Do not drink alcohol while you are taking this medicine.",
    },
    {
        "key": "follow_up",
        "title": "Follow-up visit",
        "english_text": "Come back to the clinic on {date}.",
        "fallback_english_text": "Come back to the clinic on the date shown below.",
        "placeholders": ["date"],
    },
    {
        "key": "warning_signs",
        "title": "Danger signs",
        "english_text": (
            "Go to the hospital immediately if you find it hard to breathe, "
            "have a very high fever, or cannot keep food or water down."
        ),
    },
]

LABEL_TEMPLATES = [
    ("label_medicine", "Medicine"),
    ("label_dose", "Dose"),
    ("label_times_per_day", "Times a day"),
    ("label_days", "Number of days"),
    ("label_return_date", "Come back on"),
    ("label_reply_button", "Ask the clinic a question"),
    ("label_reply_hint", "Tap and speak. Tap again to send."),
    ("label_reply_received", "The clinic has received your message."),
    ("label_reply_consent", "I agree that my voice recording will be sent to NKENNEAi to be translated for the clinic."),
    ("label_safety_footer", "If you feel worse or you are not sure, call the clinic or go to the hospital."),
]
