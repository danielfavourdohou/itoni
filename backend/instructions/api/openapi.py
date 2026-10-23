"""OpenAPI 3.1 description of the JSON API, served at /api/openapi.json and rendered at /api/docs/.

Written by hand (no DRF to generate it). Shapes mirror api/serializers.py; tests check that every
route in api/urls.py appears here, so a new endpoint cannot ship undocumented.
"""

from __future__ import annotations

from instructions.models import Reply, TemplateTranslation
from instructions.services.values import VALUE_RULES


def _ref(name: str) -> dict:
    return {"$ref": f"#/components/schemas/{name}"}


def _json(schema: dict, description: str = "OK") -> dict:
    return {"description": description, "content": {"application/json": {"schema": schema}}}


def _error(description: str) -> dict:
    return _json(_ref("Error"), description)


STRING = {"type": "string"}
NULLABLE_STRING = {"type": ["string", "null"]}
DATE = {"type": ["string", "null"], "format": "date"}
DATETIME = {"type": "string", "format": "date-time"}
STAFF = [{"session": []}]
UNSAFE = [{"session": [], "csrf": []}]
AUDIO = {
    "description": "Audio bytes with the stored content type (audio/mpeg for live TTS). Supports a single Range for Safari.",
    "content": {"audio/*": {"schema": {"type": "string", "format": "binary"}}},
}
NOT_LOGGED_IN = _error("Not logged in")
NOT_FOUND = _error("Not found")


def _id(name: str, description: str) -> dict:
    return {"name": name, "in": "path", "required": True, "schema": {"type": "integer"}, "description": description}


TOKEN = {"name": "token", "in": "path", "required": True, "schema": STRING,
         "description": "Unguessable patient token from the QR code. Unknown and expired tokens both give 404."}

SCHEMAS = {
    "Error": {
        "type": "object",
        "required": ["error"],
        "properties": {
            "error": {"type": "string", "description": "Human-readable message, safe to show."},
            "fields": {"type": "object", "additionalProperties": {"type": "array", "items": STRING},
                       "description": "Per-field messages. Item values use keys like items.medication_dose.dose."},
            "code": {"type": "string", "description": "Machine code on patient reply errors, mapped to a translated label."},
        },
    },
    "User": {"type": "object", "properties": {"id": {"type": "integer"}, "username": STRING}},
    "Session": {"type": "object", "properties": {"user": _ref("User"), "mock_mode": {"type": "boolean"}}},
    "ValueRule": {
        "type": "object",
        "properties": {
            "type": {"enum": ["text", "integer", "date"]},
            "label": STRING,
            "max_length": {"type": "integer"},
            "min": {"type": "integer"},
            "max": {"type": "integer"},
        },
    },
    "Template": {
        "type": "object",
        "properties": {
            "key": STRING,
            "title": STRING,
            "english_text": {"type": "string", "description": "May contain {placeholders}."},
            "placeholders": {"type": "array", "items": STRING},
        },
    },
    "InstructionSummary": {
        "type": "object",
        "properties": {
            "id": {"type": "integer"},
            "patient_label": STRING,
            "follow_up_date": DATE,
            "created_at": DATETIME,
            "expires_at": DATETIME,
            "is_expired": {"type": "boolean"},
            "item_count": {"type": "integer"},
            "has_unreviewed": {"type": "boolean", "description": "Some Swahili has not been approved by a reviewer."},
        },
    },
    "InstructionItem": {
        "type": "object",
        "properties": {
            "id": {"type": "integer"},
            "template_key": STRING,
            "title": STRING,
            "english_text": STRING,
            "swahili_text": STRING,
            "values": {"type": "object", "additionalProperties": True},
            "audio_url": NULLABLE_STRING,
            "review_status": {"enum": [*TemplateTranslation.Status.values, "missing"]},
            "uses_fallback": {"type": "boolean",
                              "description": "Placeholders did not survive translation; the values appear only as digits."},
        },
    },
    "InstructionDetail": {
        "type": "object",
        "properties": {
            "id": {"type": "integer"},
            "patient_label": STRING,
            "language": {"const": "swahili"},
            "follow_up_date": DATE,
            "created_at": DATETIME,
            "expires_at": DATETIME,
            "is_expired": {"type": "boolean"},
            "patient_url": {"type": "string", "description": "Frontend link the QR code opens."},
            "qr_url": STRING,
            "has_unreviewed": {"type": "boolean"},
            "items": {"type": "array", "items": _ref("InstructionItem")},
        },
    },
    "CreateInstruction": {
        "type": "object",
        "required": ["patient_label", "items"],
        "properties": {
            "patient_label": {"type": "string", "maxLength": 60, "description": "Initials or a nickname, never a full name."},
            "follow_up_date": {"type": "string", "format": "date", "description": "Fills {date} and the digits box."},
            "items": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "required": ["template_key"],
                    "properties": {
                        "template_key": STRING,
                        "values": {"type": "object", "additionalProperties": True,
                                   "description": "One entry per placeholder except date. Limits come from value_rules."},
                    },
                },
            },
        },
        "example": {
            "patient_label": "Mama A.",
            "follow_up_date": "2026-10-30",
            "items": [
                {"template_key": "medication_dose",
                 "values": {"dose": "500mg", "drug": "Amoxicillin", "times_per_day": 2, "days": 5}},
                {"template_key": "after_food", "values": {}},
                {"template_key": "follow_up", "values": {}},
            ],
        },
    },
    "PatientInstruction": {
        "type": "object",
        "description": "Only what the patient needs: Swahili text, audio, digits and translated labels. No English.",
        "properties": {
            "patient_label": STRING,
            "language": {"const": "swahili"},
            "follow_up_date": DATE,
            "mock_mode": {"type": "boolean"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer"},
                        "template_key": STRING,
                        "text": STRING,
                        "audio_url": NULLABLE_STRING,
                        "is_warning": {"type": "boolean"},
                    },
                },
            },
            "digits": {
                "type": "object",
                "description": "Raw values exactly as staff typed them, shown as digits whatever the sentence says.",
                "properties": {k: {"type": ["string", "integer", "null"]}
                               for k in ("medicine", "dose", "times_per_day", "days", "return_date")},
            },
            "labels": {"type": "object", "additionalProperties": STRING,
                       "description": "Every patient-screen string in Swahili, keyed label_*."},
            "clinic": {"type": "object", "properties": {"name": STRING, "phone": STRING}},
        },
    },
    "Reply": {
        "type": "object",
        "properties": {
            "id": {"type": "integer"},
            "instruction_id": {"type": "integer"},
            "patient_label": STRING,
            "created_at": DATETIME,
            "status": {"enum": Reply.Status.values},
            "translated_text": {"type": "string", "description": "English, from NKENNEAi Speech Translation."},
            "error": STRING,
            "is_mock": {"type": "boolean"},
            "is_demo": {"type": "boolean", "description": "Sent from the public sample patient."},
            "is_resolved": {"type": "boolean"},
            "audio_url": STRING,
        },
    },
    "TranslationRow": {
        "type": "object",
        "properties": {
            "template_key": STRING,
            "kind": {"enum": ["instruction", "label"]},
            "title": STRING,
            "english_text": STRING,
            "placeholders": {"type": "array", "items": STRING},
            "translation": {
                "type": ["object", "null"],
                "properties": {
                    "id": {"type": "integer"},
                    "text": STRING,
                    "status": {"enum": TemplateTranslation.Status.values},
                    "uses_fallback": {"type": "boolean"},
                    "is_mock": {"type": "boolean"},
                    "reviewed_by": NULLABLE_STRING,
                    "reviewed_at": {"type": ["string", "null"], "format": "date-time"},
                },
            },
        },
    },
    "UsageSummary": {
        "type": "object",
        "properties": {
            "by_kind": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "kind": {"enum": ["translate", "tts", "st", "voices"]},
                        "label": STRING,
                        "live": {"type": "integer", "description": "Calls that reached NKENNEAi and used tokens."},
                        "cached": {"type": "integer", "description": "Answered from the cache: no API call."},
                        "mocked": {"type": "integer"},
                        "errors": {"type": "integer"},
                        "cache_hit_rate": {"type": ["number", "null"]},
                        "avg_latency_ms": {"type": ["integer", "null"]},
                        "live_chars": {"type": "integer"},
                        "live_bytes": {"type": "integer"},
                    },
                },
            },
            "totals": {"type": "object", "properties": {k: {"type": "integer"} for k in ("live", "cached", "mocked", "errors")}},
        },
    },
}

DESCRIPTION = """\
Ìtọ́ni turns standard English patient instructions into Swahili text and audio with
[NKENNEAi](https://nkenne.ai), hands them to the patient by QR code, and reads the
patient's Swahili voice replies in English.

**Authentication.** Staff endpoints use a Django session cookie. Call `GET /api/auth/csrf/`
first (it sets the `csrftoken` cookie), log in with `POST /api/auth/login/`, and send the
cookie value as the `X-CSRFToken` header on every POST and PATCH. Without a session, staff
endpoints answer `401` JSON, never a redirect.

**Patients** never log in: the unguessable token in the QR link is the credential. Unknown and
expired tokens look the same (`404`).

**Errors** are always JSON: `{"error": "...", "fields": {...}}` with a proper status code.

**Tokens.** Every NKENNEAi call goes through one client, is logged, and is cache-first: a
sentence is translated and spoken once, then served from the database. Creating an instruction
only calls the API for sentences it has never seen (usually the dose and return-date lines).

**Mock mode.** When `mock_mode` is `true`, NKENNEAi is simulated and every screen shows a red
banner. This docs page is read-only: requests that would spend tokens cannot be sent from here.
"""

TAGS = [
    {"name": "Auth", "description": "Session login for staff."},
    {"name": "Instructions", "description": "Create Swahili instructions, hand them over by QR, revoke them."},
    {"name": "Replies", "description": "Patients' voice replies, translated to English."},
    {"name": "Review", "description": "Swahili review by a fluent reader."},
    {"name": "Usage", "description": "NKENNEAi call log: evidence of token efficiency."},
    {"name": "Patient", "description": "The patient screen. No login; the token is the key."},
]

PATHS = {
    "/api/auth/csrf/": {"get": {
        "tags": ["Auth"], "summary": "Set the CSRF cookie", "operationId": "csrf",
        "description": "Public. Also reports mock mode so the login screen can show the banner.",
        "responses": {"200": _json({"type": "object", "properties": {"mock_mode": {"type": "boolean"}}})},
    }},
    "/api/auth/login/": {"post": {
        "tags": ["Auth"], "summary": "Log in", "operationId": "login", "security": [{"csrf": []}],
        "requestBody": {"required": True, "content": {"application/json": {"schema": {
            "type": "object", "required": ["username", "password"],
            "properties": {"username": STRING, "password": {"type": "string", "format": "password"}}}}}},
        "responses": {"200": _json(_ref("Session")),
                      "400": _error("Missing fields, or wrong username or password (same message for non-staff accounts)"),
                      "403": _error("CSRF token missing or invalid")},
    }},
    "/api/auth/logout/": {"post": {
        "tags": ["Auth"], "summary": "Log out", "operationId": "logout", "security": UNSAFE,
        "responses": {"204": {"description": "Logged out"}},
    }},
    "/api/auth/me/": {"get": {
        "tags": ["Auth"], "summary": "Current staff user", "operationId": "me", "security": STAFF,
        "responses": {"200": _json(_ref("Session")), "401": NOT_LOGGED_IN},
    }},
    "/api/dashboard/": {"get": {
        "tags": ["Instructions"], "summary": "Dashboard counts and recent instructions", "operationId": "dashboard",
        "security": STAFF,
        "responses": {"200": _json({"type": "object", "properties": {
            "recent_instructions": {"type": "array", "items": _ref("InstructionSummary")},
            "unresolved_replies": {"type": "integer"},
            "created_today": {"type": "integer"},
            "unreviewed_translations": {"type": "integer"},
            "mock_mode": {"type": "boolean"}}}), "401": NOT_LOGGED_IN},
    }},
    "/api/templates/": {"get": {
        "tags": ["Instructions"], "summary": "Standard instructions and value rules", "operationId": "templates",
        "security": STAFF,
        "responses": {"200": _json({"type": "object", "properties": {
            "templates": {"type": "array", "items": _ref("Template")},
            "value_rules": {"type": "object", "additionalProperties": _ref("ValueRule"), "example": VALUE_RULES}}}),
            "401": NOT_LOGGED_IN},
    }},
    "/api/instructions/": {
        "get": {
            "tags": ["Instructions"], "summary": "List instructions (newest 100)", "operationId": "listInstructions",
            "security": STAFF,
            "responses": {"200": _json({"type": "object", "properties": {
                "instructions": {"type": "array", "items": _ref("InstructionSummary")}}}), "401": NOT_LOGGED_IN},
        },
        "post": {
            "tags": ["Instructions"], "summary": "Create an instruction", "operationId": "createInstruction",
            "security": UNSAFE,
            "description": "Renders each template with the values, translates and speaks only what is not cached, "
                           "and returns the full instruction with its patient link. Can take seconds on new sentences. "
                           "If speech synthesis fails, the item is created without audio (audio_url null).",
            "requestBody": {"required": True, "content": {"application/json": {"schema": _ref("CreateInstruction")}}},
            "responses": {"201": _json(_ref("InstructionDetail"), "Created"),
                          "400": _error("Invalid values (see fields)"), "401": NOT_LOGGED_IN,
                          "502": _error("Translation failed; nothing was created")},
        },
    },
    "/api/instructions/{pk}/": {"get": {
        "tags": ["Instructions"], "summary": "Instruction detail", "operationId": "getInstruction",
        "security": STAFF, "parameters": [_id("pk", "Instruction id")],
        "responses": {"200": _json(_ref("InstructionDetail")), "401": NOT_LOGGED_IN, "404": NOT_FOUND},
    }},
    "/api/instructions/{pk}/qr.svg": {"get": {
        "tags": ["Instructions"], "summary": "QR code of the patient link", "operationId": "instructionQr",
        "security": STAFF, "parameters": [_id("pk", "Instruction id")],
        "responses": {"200": {"description": "SVG image", "content": {"image/svg+xml": {"schema": STRING}}},
                      "401": NOT_LOGGED_IN, "404": NOT_FOUND},
    }},
    "/api/instructions/{pk}/revoke/": {"post": {
        "tags": ["Instructions"], "summary": "Revoke the patient link", "operationId": "revokeInstruction",
        "security": UNSAFE, "parameters": [_id("pk", "Instruction id")],
        "description": "The link shows as expired from now on. Idempotent and deliberately not undoable.",
        "responses": {"200": _json(_ref("InstructionDetail")), "401": NOT_LOGGED_IN, "404": NOT_FOUND},
    }},
    "/api/instructions/{pk}/items/{item_id}/audio/": {"get": {
        "tags": ["Instructions"], "summary": "Swahili audio of one item (staff preview)", "operationId": "itemAudio",
        "security": STAFF, "parameters": [_id("pk", "Instruction id"), _id("item_id", "Item id")],
        "responses": {"200": AUDIO, "401": NOT_LOGGED_IN, "404": NOT_FOUND},
    }},
    "/api/replies/": {"get": {
        "tags": ["Replies"], "summary": "Inbox: unresolved first, newest first", "operationId": "listReplies",
        "security": STAFF,
        "parameters": [{"name": "resolved", "in": "query", "schema": {"enum": ["true", "false"]}}],
        "responses": {"200": _json({"type": "object", "properties": {
            "replies": {"type": "array", "items": _ref("Reply")}}}), "401": NOT_LOGGED_IN},
    }},
    "/api/replies/{pk}/resolve/": {"post": {
        "tags": ["Replies"], "summary": "Resolve or reopen a reply", "operationId": "resolveReply",
        "security": UNSAFE, "parameters": [_id("pk", "Reply id")],
        "description": "Staff follow up in person; Ìtọ́ni never answers patients itself.",
        "requestBody": {"content": {"application/json": {"schema": {
            "type": "object", "properties": {"resolved": {"type": "boolean", "default": True}}}}}},
        "responses": {"200": _json(_ref("Reply")), "400": _error("resolved is not a boolean"),
                      "401": NOT_LOGGED_IN, "404": NOT_FOUND},
    }},
    "/api/replies/{pk}/audio/": {"get": {
        "tags": ["Replies"], "summary": "Original voice recording", "operationId": "replyAudio",
        "security": STAFF, "parameters": [_id("pk", "Reply id")],
        "responses": {"200": AUDIO, "401": NOT_LOGGED_IN, "404": NOT_FOUND},
    }},
    "/api/translations/": {"get": {
        "tags": ["Review"], "summary": "Every template with its Swahili and review status",
        "operationId": "listTranslations", "security": STAFF,
        "responses": {"200": _json({"type": "object", "properties": {
            "translations": {"type": "array", "items": _ref("TranslationRow")}}}), "401": NOT_LOGGED_IN},
    }},
    "/api/translations/{pk}/": {"patch": {
        "tags": ["Review"], "summary": "Edit and or approve a translation", "operationId": "updateTranslation",
        "security": UNSAFE, "parameters": [_id("pk", "Translation id")],
        "description": "Edits must keep every {placeholder} exactly once. Approving records the reviewer and time. "
                       "Mock text cannot be approved. No NKENNEAi call.",
        "requestBody": {"required": True, "content": {"application/json": {"schema": {
            "type": "object", "properties": {"text": STRING, "approve": {"type": "boolean"}}}}}},
        "responses": {"200": _json(_ref("TranslationRow")), "400": _error("Invalid text or placeholders"),
                      "401": NOT_LOGGED_IN, "404": NOT_FOUND},
    }},
    "/api/usage/": {"get": {
        "tags": ["Usage"], "summary": "NKENNEAi usage summary by kind", "operationId": "usageSummary",
        "security": STAFF, "responses": {"200": _json(_ref("UsageSummary")), "401": NOT_LOGGED_IN},
    }},
    "/api/usage.csv": {"get": {
        "tags": ["Usage"], "summary": "Full call log as CSV", "operationId": "usageCsv", "security": STAFF,
        "responses": {"200": {"description": "CSV file", "content": {"text/csv": {"schema": STRING}}},
                      "401": NOT_LOGGED_IN},
    }},
    "/api/demo/": {"get": {
        "tags": ["Patient"], "summary": "Link to the public sample patient", "operationId": "demo",
        "description": "Used by the landing page's \"See a patient's screen\" button.",
        "responses": {"200": _json({"type": "object", "properties": {"patient_path": STRING}}),
                      "404": _error("No live sample published")},
    }},
    "/api/p/{token}/": {"get": {
        "tags": ["Patient"], "summary": "Patient screen data", "operationId": "patientInstruction",
        "parameters": [TOKEN],
        "description": "Also sets the CSRF cookie needed for the reply upload.",
        "responses": {"200": _json(_ref("PatientInstruction")),
                      "404": _json({"type": "object", "properties": {
                          "error": STRING, "labels": {"type": "object", "additionalProperties": STRING},
                          "mock_mode": {"type": "boolean"}}},
                          "Expired or unknown link. Labels let the screen say so in Swahili.")},
    }},
    "/api/p/{token}/audio/{item_id}/": {"get": {
        "tags": ["Patient"], "summary": "Swahili audio for one item", "operationId": "patientAudio",
        "parameters": [TOKEN, _id("item_id", "Item id; 404 unless it belongs to this token")],
        "responses": {"200": AUDIO, "404": NOT_FOUND},
    }},
    "/api/p/{token}/reply/": {"post": {
        "tags": ["Patient"], "summary": "Send a Swahili voice reply", "operationId": "patientReply",
        "security": [{"csrf": []}], "parameters": [TOKEN],
        "description": "Multipart upload. Consent is required. The recording is stored, converted and translated "
                       "to English with one NKENNEAi Speech Translation call. A failed translation still returns 201 "
                       "with status failed: staff can listen to the original.",
        "requestBody": {"required": True, "content": {"multipart/form-data": {"schema": {
            "type": "object", "required": ["audio_file", "consent"],
            "properties": {"audio_file": {"type": "string", "format": "binary", "description": "Max 5 MB, max 60 s"},
                           "consent": {"const": "true"}}}}}},
        "responses": {
            "201": _json({"type": "object", "properties": {"status": {"enum": Reply.Status.values}}}, "Stored"),
            "400": _error("No consent (consent_required), no file (no_audio) or not audio (not_audio)"),
            "404": NOT_FOUND,
            "413": _error("Recording too large (too_large)"),
            "429": _error("Too many replies for this link (rate_limited)"),
        },
    }},
}


def build_spec() -> dict:
    return {
        "openapi": "3.1.0",
        "info": {"title": "Ìtọ́ni API", "version": "1.0.0", "description": DESCRIPTION},
        "servers": [{"url": "/", "description": "This deployment"}],
        "tags": TAGS,
        "paths": PATHS,
        "components": {
            "schemas": SCHEMAS,
            "securitySchemes": {
                "session": {"type": "apiKey", "in": "cookie", "name": "sessionid",
                            "description": "Set by POST /api/auth/login/."},
                "csrf": {"type": "apiKey", "in": "header", "name": "X-CSRFToken",
                         "description": "Value of the csrftoken cookie from GET /api/auth/csrf/."},
            },
        },
    }
