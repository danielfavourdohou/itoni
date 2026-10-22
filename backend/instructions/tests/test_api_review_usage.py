import csv
import io
import json

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from instructions.models import ApiCallLog, AudioClip, Language, Template, TemplateTranslation
from instructions.services import rendering
from instructions.tests.test_api_auth import FAST_HASHER

SW = Language.SWAHILI


@FAST_HASHER
class StaffTestCase(TestCase):
    def setUp(self):
        call_command("seed_templates", verbosity=0)
        call_command("translate_templates", verbosity=0, no_audio=True)  # mock translations
        self.staff = get_user_model().objects.create_user("reviewer", password="pw", is_staff=True)
        self.client.force_login(self.staff)

    def tr(self, key) -> TemplateTranslation:
        return TemplateTranslation.objects.get(template__key=key, language=SW)

    def patch(self, tr, body):
        return self.client.patch(f"/api/translations/{tr.id}/", data=json.dumps(body), content_type="application/json")


class TranslationReviewTests(StaffTestCase):
    def test_list_has_every_active_template_in_one_query_set(self):
        with self.assertNumQueries(3):  # session, user, templates joined with translations
            rows = self.client.get("/api/translations/").json()["translations"]
        self.assertEqual(len(rows), Template.objects.filter(is_active=True).count())
        self.assertEqual(rows[0]["kind"], "instruction")
        dose = next(r for r in rows if r["template_key"] == "medication_dose")
        self.assertEqual(dose["translation"]["status"], "machine")
        self.assertTrue(dose["translation"]["is_mock"])

    def test_untranslated_template_has_null_translation(self):
        TemplateTranslation.objects.filter(template__key="after_food").delete()
        rows = self.client.get("/api/translations/").json()["translations"]
        self.assertIsNone(next(r for r in rows if r["template_key"] == "after_food")["translation"])

    def test_edit_marks_human_and_keeps_machine_status(self):
        resp = self.patch(self.tr("after_food"), {"text": "Kunywa dawa hii baada ya kula chakula."})
        self.assertEqual(resp.status_code, 200)
        tr = self.tr("after_food")
        self.assertEqual(tr.text, "Kunywa dawa hii baada ya kula chakula.")
        self.assertFalse(tr.is_mock)
        self.assertEqual(tr.status, "machine")

    def test_approve_sets_reviewer_and_time(self):
        tr = self.tr("after_food")
        resp = self.patch(tr, {"text": "Kunywa dawa hii baada ya kula.", "approve": True})
        self.assertEqual(resp.status_code, 200)
        tr.refresh_from_db()
        self.assertEqual(tr.status, "approved")
        self.assertEqual(tr.reviewed_by, self.staff)
        self.assertIsNotNone(tr.reviewed_at)
        self.assertEqual(resp.json()["translation"]["reviewed_by"], "reviewer")

    def test_cannot_approve_mock_text(self):
        resp = self.patch(self.tr("after_food"), {"approve": True})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(self.tr("after_food").status, "machine")

    def test_editing_approved_text_needs_fresh_review(self):
        tr = self.tr("after_food")
        self.patch(tr, {"text": "Kunywa baada ya kula.", "approve": True})
        self.patch(tr, {"text": "Kunywa dawa baada ya kula."})
        tr.refresh_from_db()
        self.assertEqual(tr.status, "machine")
        self.assertIsNone(tr.reviewed_by)

    def test_unapprove(self):
        tr = self.tr("after_food")
        self.patch(tr, {"text": "Kunywa baada ya kula.", "approve": True})
        self.patch(tr, {"approve": False})
        self.assertEqual(self.tr("after_food").status, "machine")

    def test_placeholders_must_survive_an_edit(self):
        tr = self.tr("medication_dose")
        missing = self.patch(tr, {"text": "Kunywa {dose} ya {drug} mara {times_per_day} kwa siku."})
        self.assertEqual(missing.status_code, 400)
        self.assertIn("{days}", missing.json()["fields"]["text"][0])
        unknown = self.patch(tr, {"text": "Kunywa {dose} ya {drug}, mara {times_per_day}, siku {days} {oops}."})
        self.assertIn("{oops}", unknown.json()["fields"]["text"][0])
        ok = self.patch(tr, {"text": "Kunywa {dose} ya {drug}, mara {times_per_day} kwa siku, kwa siku {days}."})
        self.assertEqual(ok.status_code, 200)

    def test_labels_reject_placeholders_and_blank_text(self):
        tr = self.tr("label_dose")
        self.assertEqual(self.patch(tr, {"text": "Kipimo {dose}"}).status_code, 400)
        self.assertEqual(self.patch(tr, {"text": "   "}).status_code, 400)
        self.assertEqual(self.patch(tr, {}).status_code, 400)
        self.assertEqual(self.patch(tr, {"approve": "yes"}).status_code, 400)

    def test_live_run_does_not_overwrite_a_human_edit(self):
        self.patch(self.tr("after_food"), {"text": "Kunywa baada ya kula."})
        call_command("translate_templates", verbosity=0, no_audio=True)
        self.assertEqual(self.tr("after_food").text, "Kunywa baada ya kula.")

    def test_edited_wording_gets_new_audio_on_next_use(self):
        food = Template.objects.get(key="after_food")
        rendering.create_instruction(user=self.staff, patient_label="A", language=SW, items=[(food, {})])
        self.patch(self.tr("after_food"), {"text": "Kunywa baada ya kula."})
        instr = rendering.create_instruction(user=self.staff, patient_label="B", language=SW, items=[(food, {})])
        self.assertEqual(AudioClip.objects.count(), 2)
        self.assertEqual(instr.items.get().audio.text, "Kunywa baada ya kula.")

    def test_missing_translation_is_404(self):
        self.assertEqual(self.client.patch("/api/translations/99999/", data="{}", content_type="application/json").status_code, 404)


class UsageTests(StaffTestCase):
    def setUp(self):
        super().setUp()
        ApiCallLog.objects.all().delete()
        ApiCallLog.objects.create(kind="translate", language=SW, status_code=200, latency_ms=100, request_chars=40)
        ApiCallLog.objects.create(kind="translate", language=SW, status_code=200, latency_ms=300, request_chars=60)
        ApiCallLog.objects.create(kind="translate", language=SW, cached=True)
        ApiCallLog.objects.create(kind="translate", language=SW, cached=True)
        ApiCallLog.objects.create(kind="tts", language=SW, mocked=True)
        ApiCallLog.objects.create(kind="st", language=SW, status_code=503, latency_ms=50, error="=HYPERLINK(evil)")

    def test_usage_needs_login(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/usage/").status_code, 401)
        self.assertEqual(self.client.get("/api/usage.csv").status_code, 401)

    def test_summary_counts(self):
        body = self.client.get("/api/usage/").json()
        kinds = {k["kind"]: k for k in body["by_kind"]}
        tr = kinds["translate"]
        self.assertEqual((tr["live"], tr["cached"], tr["mocked"], tr["errors"]), (2, 2, 0, 0))
        self.assertEqual(tr["cache_hit_rate"], 0.5)
        self.assertEqual(tr["avg_latency_ms"], 200)
        self.assertEqual(tr["live_chars"], 100)
        self.assertEqual(kinds["st"]["errors"], 1)
        self.assertEqual(kinds["tts"]["mocked"], 1)
        self.assertEqual(body["totals"], {"live": 3, "cached": 2, "mocked": 1, "errors": 1})

    def test_csv_export_rows_and_formula_guard(self):
        resp = self.client.get("/api/usage.csv")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp["Content-Type"].startswith("text/csv"))
        self.assertIn("attachment;", resp["Content-Disposition"])
        rows = list(csv.reader(io.StringIO(b"".join(resp.streaming_content).decode())))
        self.assertEqual(rows[0][:3], ["created_at", "kind", "language"])
        self.assertEqual(len(rows), 7)
        self.assertEqual(rows[-1][-1], "'=HYPERLINK(evil)")
