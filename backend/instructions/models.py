import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class Language(models.TextChoices):
    # Swahili is the only language allowed in the Build With NKENNEAi hackathon.
    SWAHILI = "swahili", "Swahili"


def new_token() -> str:
    return secrets.token_urlsafe(24)


def default_expiry():
    return timezone.now() + timedelta(days=settings.ITONI["INSTRUCTION_TTL_DAYS"])


class Template(models.Model):
    class Kind(models.TextChoices):
        INSTRUCTION = "instruction", "Instruction"
        LABEL = "label", "Interface label"

    key = models.SlugField(unique=True)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.INSTRUCTION)
    title = models.CharField(max_length=100)
    english_text = models.TextField(help_text="May contain {placeholders}.")
    fallback_english_text = models.TextField(
        blank=True, help_text="Same meaning without placeholders. Used if placeholders do not survive translation."
    )
    placeholders = models.JSONField(default=list, blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["kind", "position"]

    def __str__(self) -> str:
        return self.title


class TemplateTranslation(models.Model):
    class Status(models.TextChoices):
        MACHINE = "machine", "Machine translated"
        APPROVED = "approved", "Reviewed and approved"

    template = models.ForeignKey(Template, on_delete=models.CASCADE, related_name="translations")
    language = models.CharField(max_length=32, choices=Language.choices)
    text = models.TextField()
    uses_fallback = models.BooleanField(default=False)
    source_hash = models.CharField(max_length=64)
    is_mock = models.BooleanField(default=False)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.MACHINE)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["template", "language"], name="uniq_template_language")]

    def __str__(self) -> str:
        return f"{self.template.key} [{self.language}]"


class AudioClip(models.Model):
    cache_key = models.CharField(max_length=64, unique=True)
    language = models.CharField(max_length=32, choices=Language.choices)
    voice = models.CharField(max_length=64, blank=True)
    text = models.TextField()
    content_type = models.CharField(max_length=32, default="audio/mpeg")
    data = models.BinaryField()
    is_mock = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.language}: {self.text[:40]}"


class Instruction(models.Model):
    token = models.CharField(max_length=40, unique=True, default=new_token, editable=False)
    patient_label = models.CharField(max_length=60, help_text="Initials or a nickname. No full names needed.")
    language = models.CharField(max_length=32, choices=Language.choices, default=Language.SWAHILI)
    follow_up_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_expiry)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.patient_label} ({self.created_at:%d/%m/%Y})"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at


class InstructionItem(models.Model):
    instruction = models.ForeignKey(Instruction, on_delete=models.CASCADE, related_name="items")
    template = models.ForeignKey(Template, on_delete=models.PROTECT)
    values = models.JSONField(default=dict, blank=True)
    english_text = models.TextField()
    rendered_text = models.TextField()
    audio = models.ForeignKey(AudioClip, null=True, blank=True, on_delete=models.SET_NULL)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position"]


class Reply(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        DONE = "done", "Translated"
        FAILED = "failed", "Failed"

    instruction = models.ForeignKey(Instruction, on_delete=models.CASCADE, related_name="replies")
    original_audio = models.BinaryField()
    original_content_type = models.CharField(max_length=64)
    converted_audio = models.BinaryField(null=True, blank=True)
    translated_text = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    error = models.TextField(blank=True)
    is_mock = models.BooleanField(default=False)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["is_resolved", "created_at"])]


class ApiCallLog(models.Model):
    class Kind(models.TextChoices):
        TRANSLATE = "translate", "Text-to-Text"
        TTS = "tts", "Text-to-Speech"
        ST = "st", "Speech Translation"
        VOICES = "voices", "Voices lookup"

    kind = models.CharField(max_length=16, choices=Kind.choices)
    language = models.CharField(max_length=32, blank=True)
    cached = models.BooleanField(default=False, help_text="Served from cache; no API call made.")
    mocked = models.BooleanField(default=False)
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    request_chars = models.PositiveIntegerField(null=True, blank=True)
    request_bytes = models.PositiveIntegerField(null=True, blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["created_at"])]

    @property
    def is_live(self) -> bool:
        return not self.cached and not self.mocked
