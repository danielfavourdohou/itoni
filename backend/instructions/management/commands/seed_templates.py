from django.core.management.base import BaseCommand

from instructions.models import Template
from instructions.seed_data import INSTRUCTION_TEMPLATES, LABEL_TEMPLATES


class Command(BaseCommand):
    help = "Create or update instruction and label templates. Never calls NKENNEAi."

    def handle(self, *args, **options):
        created = updated = 0
        for position, data in enumerate(INSTRUCTION_TEMPLATES):
            _, was_created = Template.objects.update_or_create(
                key=data["key"],
                defaults={
                    "kind": Template.Kind.INSTRUCTION,
                    "title": data["title"],
                    "english_text": data["english_text"],
                    "fallback_english_text": data.get("fallback_english_text", ""),
                    "placeholders": data.get("placeholders", []),
                    "position": position,
                },
            )
            created += was_created
            updated += not was_created

        for position, (key, text) in enumerate(LABEL_TEMPLATES):
            _, was_created = Template.objects.update_or_create(
                key=key,
                defaults={"kind": Template.Kind.LABEL, "title": text, "english_text": text, "position": position},
            )
            created += was_created
            updated += not was_created

        self.stdout.write(self.style.SUCCESS(f"Templates: {created} created, {updated} updated."))
