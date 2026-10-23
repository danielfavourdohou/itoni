"""Create a demo staff user and the two fake demo patients from docs/TEMPLATES.md.

Safe to rerun: existing demo instructions are deleted and recreated.
Uses whatever mode is configured (mock by default), so it costs no tokens in mock mode.
"""

from datetime import date, timedelta

from django.utils import timezone

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from instructions.models import Instruction, Language, Template
from instructions.services import rendering

DEMO_LABELS = ("Mama A.", "Baba T.")
PUBLIC_DEMO_LABEL = "Mama A."  # linked from the landing page so judges can open a patient screen
PUBLIC_DEMO_DAYS = 365  # the public sample should not expire mid-judging


class Command(BaseCommand):
    help = "Create demo staff user (Nurse / itoni-demo-123) and two fake patient instructions."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="Nurse")
        parser.add_argument("--password", default="itoni-demo-123")

    def handle(self, *args, username, password, **options):
        User = get_user_model()
        user, created = User.objects.get_or_create(username=username, defaults={"is_staff": True})
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(f"Created staff user {username} / {password}")

        t = {x.key: x for x in Template.objects.filter(kind=Template.Kind.INSTRUCTION)}
        if not t:
            self.stderr.write("No templates. Run: python manage.py seed_templates")
            return

        Instruction.objects.filter(patient_label__in=DEMO_LABELS).delete()
        return_date = date.today() + timedelta(days=7)

        demos = [
            ("Mama A.", return_date, [
                (t["medication_dose"], {"dose": "500mg", "drug": "Amoxicillin", "times_per_day": 2, "days": 5}),
                (t["after_food"], {}),
                (t["finish_course"], {}),
                (t["follow_up"], {"date": return_date}),
                (t["warning_signs"], {}),
            ]),
            ("Baba T.", None, [
                (t["medication_dose"], {"dose": "1 tablet", "drug": "Paracetamol", "times_per_day": 3, "days": 3}),
                (t["no_alcohol"], {}),
                (t["warning_signs"], {}),
            ]),
        ]
        for label, follow_up, items in demos:
            instr = rendering.create_instruction(
                user=user, patient_label=label, language=Language.SWAHILI, items=items, follow_up_date=follow_up,
            )
            if label == PUBLIC_DEMO_LABEL:
                instr.is_demo = True
                instr.expires_at = timezone.now() + timedelta(days=PUBLIC_DEMO_DAYS)
                instr.save(update_fields=["is_demo", "expires_at"])
            self.stdout.write(f"  {label}: /p/{instr.token}/" + ("  (public demo)" if instr.is_demo else ""))

        self.stdout.write(self.style.SUCCESS("Demo data ready."))
