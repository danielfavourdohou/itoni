from django.core.management.base import BaseCommand, CommandError

from instructions.models import ApiCallLog, Language, Template
from instructions.services import audio, nkenne, translation


class Command(BaseCommand):
    help = (
        "Translate all active templates (and pre-generate audio for fixed instructions). "
        "Skips anything already translated from the same English, so reruns cost nothing."
    )

    def add_arguments(self, parser):
        parser.add_argument("--language", default=Language.SWAHILI, choices=Language.values)
        parser.add_argument("--live", action="store_true", help="Call NKENNEAi even if NKENNE_MOCK=true.")
        parser.add_argument("--refresh", action="store_true", help="Re-translate even if cached (costs tokens).")
        parser.add_argument("--no-audio", action="store_true", help="Skip pre-generating audio.")

    def handle(self, *args, language, live, refresh, no_audio, **options):
        mode = "LIVE" if live or not nkenne.is_mock() else "MOCK"
        self.stdout.write(f"Mode: {mode}  Language: {language}")
        last = ApiCallLog.objects.order_by("-pk").values_list("pk", flat=True).first() or 0

        for template in Template.objects.filter(is_active=True):
            try:
                tr = translation.get_or_create_translation(template, language, force_live=live, refresh=refresh)
            except nkenne.NkenneError as exc:
                raise CommandError(f"{template.key}: {exc} (status {exc.status_code})") from exc
            flag = " [fallback]" if tr.uses_fallback else ""
            self.stdout.write(f"  {template.key}{flag}: {tr.text}")

            # Fixed sentences (no placeholders) always render the same, so their audio can be made now.
            if not no_audio and template.kind == Template.Kind.INSTRUCTION and not template.placeholders:
                audio.get_or_create_clip(tr.text, language, force_live=live)

        live_calls = ApiCallLog.objects.filter(pk__gt=last, cached=False, mocked=False).count()
        self.stdout.write(self.style.SUCCESS(f"Done. Live API calls made: {live_calls}"))
