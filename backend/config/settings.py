"""Django settings for Ìtọ́ni. All environment-specific values come from env vars (.env locally)."""

import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
DEBUG = env_bool("DJANGO_DEBUG", False)
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is false.")
    SECRET_KEY = "dev-only-insecure-key"

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
# Render sets this to the service's public hostname; trust it even if DJANGO_ALLOWED_HOSTS is mistyped.
if os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "http://localhost:8000")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "instructions",
]

MIDDLEWARE = [
    "config.health.HealthCheckMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        # Persistent connections only under gunicorn: runserver opens a thread per request and
        # each would hold its own connection, exhausting local Postgres when the UI polls.
        conn_max_age=int(os.environ.get("DJANGO_CONN_MAX_AGE", "0" if DEBUG else "600")),
        conn_health_checks=True,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Lagos"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LOGIN_URL = "/admin/login/"  # admin only; the API returns 401 JSON instead of redirecting
# /api/ CSRF failures return JSON so the SPA can show them; other paths keep Django's page.
CSRF_FAILURE_VIEW = "instructions.api.http.csrf_failure"

# Keep uploads bounded; reply view also enforces ITONI_REPLY_MAX_BYTES.
DATA_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # The browser only sees the Vercel domain (Vercel sends its own HSTS); this covers the
    # Render host. No includeSubDomains: onrender.com subdomains belong to other people.
    SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", "3600"))
    # W005/W021 ask for includeSubDomains and preload, which would claim other people's
    # onrender.com subdomains. Deliberately off.
    SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W021"]

# --- NKENNEAi ---
NKENNE = {
    "BASE_URL": os.environ.get("NKENNE_BASE_URL", "https://developers-api.nkenne.ai"),
    "API_KEY": os.environ.get("NKENNE_API_KEY", ""),
    "MOCK": env_bool("NKENNE_MOCK", True),
    "TIMEOUT_TRANSLATE": int(os.environ.get("NKENNE_TIMEOUT_TRANSLATE", "30")),
    "TIMEOUT_AUDIO": int(os.environ.get("NKENNE_TIMEOUT_AUDIO", "60")),
    "VOICE_SWAHILI": os.environ.get("NKENNE_VOICE_SWAHILI") or "asha",  # chosen 23 Oct 2026; part of the audio cache key
    "TTS_SPEAKING_RATE": float(os.environ.get("NKENNE_TTS_SPEAKING_RATE", "0.9")),
    "MAX_ATTEMPTS": 3,
    # How patient replies reach English. "stt" (default since 24 Oct 2026): Speech-to-Text, then
    # Text-to-Text. "st": Speech Translation first, falling back to "stt" on a provider failure.
    # Speech Translation currently answers with audio instead of its documented text.
    "REPLY_ROUTE": (os.environ.get("NKENNE_REPLY_ROUTE") or "stt").strip().lower(),
}

# --- App ---
ITONI = {
    "INSTRUCTION_TTL_DAYS": int(os.environ.get("ITONI_INSTRUCTION_TTL_DAYS", "30")),
    "REPLY_MAX_BYTES": int(os.environ.get("ITONI_REPLY_MAX_BYTES", str(5 * 1024 * 1024))),
    "REPLY_MAX_SECONDS": int(os.environ.get("ITONI_REPLY_MAX_SECONDS", "60")),
    "REPLY_RATE_PER_HOUR": int(os.environ.get("ITONI_REPLY_RATE_PER_HOUR", "10")),
    # Public origin of the frontend, used for patient links and QR codes. Set it behind a
    # tunnel: with DEBUG on, Django sees plain http there, and phones block the mic on http.
    "FRONTEND_BASE_URL": os.environ.get("FRONTEND_BASE_URL", "").strip().rstrip("/"),
    # Shown on the patient screen so "call the clinic" is a number they can tap, not a dead end.
    # Empty phone hides the call button (never ship a made-up number: it could be a real person's).
    "CLINIC_NAME": os.environ.get("ITONI_CLINIC_NAME", "").strip(),
    "CLINIC_PHONE": os.environ.get("ITONI_CLINIC_PHONE", "").strip(),
    # /api/docs/ for everyone (true, the hackathon submission) or logged-in staff only (false).
    "API_DOCS_PUBLIC": env_bool("ITONI_API_DOCS_PUBLIC", False),
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {"instructions": {"handlers": ["console"], "level": "INFO"}},
}
