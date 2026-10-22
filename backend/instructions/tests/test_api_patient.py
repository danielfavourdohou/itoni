from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from instructions.models import Language, Template, TemplateTranslation
from instructions.services import labels, rendering
from instructions.tests.test_api_auth import FAST_HASHER

SW = Language.SWAHILI
DOSE_VALUES = {"dose": "500mg", "drug": "Amoxicillin", "times_per_day": 2, "days": 5}


@FAST_HASHER
class PatientApiTests(TestCase):
    """Anonymous client throughout: the token is the only credential."""

    def setUp(self):
        call_command("seed_templates", verbosity=0)
        call_command("translate_templates", verbosity=0, no_audio=True)  # mock: label translations exist
        self.staff = get_user_model().objects.create_user("nurse", password="pw", is_staff=True)
        self.return_date = date.today() + timedelta(days=7)

    def make(self, keys=("medication_dose", "follow_up", "warning_signs"), label="Mama A."):
        values = {"medication_dose": DOSE_VALUES, "follow_up": {"date": self.return_date}}
        items = [(Template.objects.get(key=k), values.get(k, {})) for k in keys]
        return rendering.create_instruction(user=self.staff, patient_label=label, language=SW, items=items,
                                            follow_up_date=self.return_date if "follow_up" in keys else None)

    def test_valid_token_renders_without_login(self):
        instr = self.make()
        resp = self.client.get(f"/api/p/{instr.token}/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual([i["template_key"] for i in body["items"]], ["medication_dose", "follow_up", "warning_signs"])
        self.assertTrue(all(i["text"].startswith("[MOCK-SW]") for i in body["items"]))
        self.assertEqual([i["is_warning"] for i in body["items"]], [False, False, True])
        self.assertEqual(body["items"][0]["audio_url"], f"/api/p/{instr.token}/audio/{body['items'][0]['id']}/")
        self.assertIn("mock_mode", body)
        self.assertTrue(body["labels"]["label_dose"].startswith("[MOCK-SW]"))

    def test_digits_are_raw_values(self):
        body = self.client.get(f"/api/p/{self.make().token}/").json()
        self.assertEqual(body["digits"], {
            "medicine": "Amoxicillin", "dose": "500mg", "times_per_day": "2", "days": "5",
            "return_date": self.return_date.strftime("%d/%m/%Y"),
        })

    def test_digits_empty_without_values(self):
        body = self.client.get(f"/api/p/{self.make(keys=('after_food',)).token}/").json()
        self.assertEqual(set(body["digits"].values()), {None})

    def test_no_staff_data_leaks(self):
        body = self.client.get(f"/api/p/{self.make().token}/").json()
        self.assertEqual(set(body), {"patient_label", "language", "follow_up_date", "mock_mode", "items", "digits", "labels"})
        self.assertEqual(set(body["items"][0]), {"id", "template_key", "text", "audio_url", "is_warning"})

    def test_expired_is_404_with_translated_message(self):
        instr = self.make()
        instr.expires_at = timezone.now() - timedelta(minutes=1)
        instr.save()
        resp = self.client.get(f"/api/p/{instr.token}/")
        self.assertEqual(resp.status_code, 404)
        self.assertTrue(resp.json()["labels"]["label_link_expired"].startswith("[MOCK-SW]"))
        self.assertIn("mock_mode", resp.json())

    def test_unknown_token_is_404(self):
        resp = self.client.get("/api/p/not-a-real-token/")
        self.assertEqual(resp.status_code, 404)
        self.assertIn("label_link_expired", resp.json()["labels"])

    def test_audio_streams_with_ranges(self):
        instr = self.make()
        item = instr.items.select_related("audio").first()
        resp = self.client.get(f"/api/p/{instr.token}/audio/{item.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content, bytes(item.audio.data))
        self.assertEqual(resp["Accept-Ranges"], "bytes")

    def test_audio_from_another_token_is_404(self):
        mine = self.make()
        other_item = self.make(label="Baba T.").items.first()
        self.assertEqual(self.client.get(f"/api/p/{mine.token}/audio/{other_item.id}/").status_code, 404)

    def test_audio_of_expired_instruction_is_404(self):
        instr = self.make()
        item = instr.items.first()
        instr.expires_at = timezone.now() - timedelta(minutes=1)
        instr.save()
        self.assertEqual(self.client.get(f"/api/p/{instr.token}/audio/{item.id}/").status_code, 404)

    def test_query_count_is_flat(self):
        instr = self.make()
        with self.assertNumQueries(3):  # instruction, items + templates, labels
            self.client.get(f"/api/p/{instr.token}/")


class LabelServiceTests(TestCase):
    def setUp(self):
        call_command("seed_templates", verbosity=0)

    def test_one_query_and_english_fallback(self):
        dose = Template.objects.get(key="label_dose")
        TemplateTranslation.objects.create(template=dose, language=SW, text="Kipimo", source_hash="x")
        with self.assertNumQueries(1):
            result = labels.get_labels(SW)
        self.assertEqual(result["label_dose"], "Kipimo")
        self.assertEqual(result["label_days"], "Number of days")  # untranslated: English fallback
        self.assertNotIn("medication_dose", result)  # instruction templates are not labels
