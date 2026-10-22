from datetime import date, timedelta
from unittest import mock

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

from instructions.models import Instruction, Language, Reply, Template, TemplateTranslation
from instructions.services import nkenne, rendering
from instructions.tests.test_api_auth import FAST_HASHER, post_json

SW = Language.SWAHILI


def itoni_settings(**overrides):
    return override_settings(ITONI={**settings.ITONI, **overrides})


def future(days=7) -> date:
    return date.today() + timedelta(days=days)


DOSE_VALUES = {"dose": "500mg", "drug": "Amoxicillin", "times_per_day": 2, "days": 5}


@FAST_HASHER
class StaffApiTestCase(TestCase):
    def setUp(self):
        call_command("seed_templates", verbosity=0)
        self.staff = get_user_model().objects.create_user("nurse", password="pw", is_staff=True)
        self.client.force_login(self.staff)

    def make_instruction(self, keys=("medication_dose", "after_food"), label="Mama A."):
        items = [(Template.objects.get(key=k), DOSE_VALUES if k == "medication_dose" else {}) for k in keys]
        return rendering.create_instruction(user=self.staff, patient_label=label, language=SW, items=items)

    def create(self, **payload):
        body = {"patient_label": "Mama A.", "items": [{"template_key": "after_food", "values": {}}], **payload}
        return post_json(self.client, "/api/instructions/", body)


class AccessTests(StaffApiTestCase):
    def test_staff_endpoints_need_login_and_staff(self):
        instr = self.make_instruction()
        item = instr.items.first()
        urls = [
            ("get", "/api/dashboard/"), ("get", "/api/templates/"), ("get", "/api/instructions/"),
            ("post", "/api/instructions/"), ("get", f"/api/instructions/{instr.id}/"),
            ("get", f"/api/instructions/{instr.id}/qr.svg"),
            ("get", f"/api/instructions/{instr.id}/items/{item.id}/audio/"),
        ]
        self.client.logout()
        for method, url in urls:
            resp = getattr(self.client, method)(url)
            self.assertEqual(resp.status_code, 401, url)
            self.assertIn("error", resp.json())

        self.client.force_login(get_user_model().objects.create_user("visitor", password="pw"))
        for method, url in urls:
            self.assertEqual(getattr(self.client, method)(url).status_code, 403, url)


class TemplatesTests(StaffApiTestCase):
    def test_lists_active_instruction_templates_in_order(self):
        Template.objects.filter(key="no_alcohol").update(is_active=False)
        body = self.client.get("/api/templates/").json()
        keys = [t["key"] for t in body["templates"]]
        self.assertEqual(keys, ["medication_dose", "after_food", "finish_course", "follow_up", "warning_signs"])
        self.assertEqual(body["value_rules"]["times_per_day"]["max"], 6)


class CreateInstructionTests(StaffApiTestCase):
    def test_happy_path_orders_by_position_and_stores_follow_up(self):
        resp = self.create(
            follow_up_date=future().isoformat(),
            items=[
                {"template_key": "warning_signs", "values": {}},
                {"template_key": "follow_up", "values": {"date": "1999-01-01"}},  # ignored
                {"template_key": "medication_dose", "values": {**DOSE_VALUES, "times_per_day": "2"}},
            ],
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        body = resp.json()
        self.assertEqual([i["template_key"] for i in body["items"]], ["medication_dose", "follow_up", "warning_signs"])
        instr = Instruction.objects.get()
        self.assertEqual(instr.follow_up_date, future())
        self.assertEqual(instr.language, SW)
        self.assertIn(future().strftime("%d/%m/%Y"), body["items"][1]["english_text"])
        self.assertIn("500mg", body["items"][0]["swahili_text"])
        self.assertTrue(all(i["audio_url"] for i in body["items"]))

    def test_missing_value_is_field_error(self):
        resp = self.create(items=[{"template_key": "medication_dose", "values": {**DOSE_VALUES, "dose": ""}}])
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["fields"], {"items.medication_dose.dose": ["Required."]})
        self.assertFalse(Instruction.objects.exists())

    def test_follow_up_without_date(self):
        resp = self.create(items=[{"template_key": "follow_up", "values": {}}])
        self.assertEqual(resp.status_code, 400)
        self.assertIn("follow_up_date", resp.json()["fields"])

    def test_out_of_range_values(self):
        bad = {"dose": "x" * 21, "drug": "Amoxicillin", "times_per_day": 7, "days": 0}
        resp = self.create(items=[{"template_key": "medication_dose", "values": bad}])
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(set(resp.json()["fields"]), {
            "items.medication_dose.dose", "items.medication_dose.times_per_day", "items.medication_dose.days",
        })

    def test_non_integer_and_bool_rejected(self):
        for value in ("two", True, 2.5):
            resp = self.create(items=[{"template_key": "medication_dose",
                                       "values": {**DOSE_VALUES, "times_per_day": value}}])
            self.assertIn("items.medication_dose.times_per_day", resp.json()["fields"], value)

    def test_bad_and_past_follow_up_date(self):
        for value in ("31/10/2026", "2020-01-01", 20261031):
            resp = self.create(follow_up_date=value)
            self.assertEqual(resp.status_code, 400, value)
            self.assertIn("follow_up_date", resp.json()["fields"])

    def test_unknown_label_and_duplicate_templates(self):
        resp = self.create(items=[
            {"template_key": "nope", "values": {}},
            {"template_key": "label_dose", "values": {}},
            {"template_key": "after_food", "values": {}},
            {"template_key": "after_food", "values": {}},
        ])
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(len(resp.json()["fields"]["items"]), 3)

    def test_empty_items_and_label(self):
        resp = self.create(patient_label="  ", items=[])
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(set(resp.json()["fields"]), {"patient_label", "items"})

    def test_nkenne_error_is_502_and_saves_nothing(self):
        with mock.patch.object(nkenne, "translate", side_effect=nkenne.NkenneError("boom", status_code=503)):
            resp = self.create()
        self.assertEqual(resp.status_code, 502)
        self.assertEqual(resp.json()["error"], nkenne.NkenneError("boom", 503).user_message)
        self.assertFalse(Instruction.objects.exists())


class DetailTests(StaffApiTestCase):
    def test_review_status_and_fallback(self):
        instr = self.make_instruction()
        body = self.client.get(f"/api/instructions/{instr.id}/").json()
        self.assertEqual({i["review_status"] for i in body["items"]}, {"machine"})
        self.assertTrue(body["has_unreviewed"])

        TemplateTranslation.objects.filter(template__key="medication_dose").update(uses_fallback=True)
        TemplateTranslation.objects.update(status=TemplateTranslation.Status.APPROVED)
        body = self.client.get(f"/api/instructions/{instr.id}/").json()
        self.assertEqual({i["review_status"] for i in body["items"]}, {"approved"})
        self.assertFalse(body["has_unreviewed"])
        self.assertEqual([i["uses_fallback"] for i in body["items"]], [True, False])

    def test_missing_instruction_is_404_json(self):
        resp = self.client.get("/api/instructions/999/")
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json(), {"error": "Not found."})

    def test_patient_url_falls_back_to_request_host(self):
        instr = self.make_instruction()
        with itoni_settings(FRONTEND_BASE_URL=""):
            body = self.client.get(f"/api/instructions/{instr.id}/").json()
        self.assertEqual(body["patient_url"], f"http://testserver/p/{instr.token}")

    def test_patient_url_uses_frontend_base_url(self):
        instr = self.make_instruction()
        with itoni_settings(FRONTEND_BASE_URL="https://abc.trycloudflare.com"):
            body = self.client.get(f"/api/instructions/{instr.id}/").json()
            with mock.patch("instructions.api.staff.qr.svg", return_value="<svg/>") as svg:
                self.client.get(f"/api/instructions/{instr.id}/qr.svg")
        self.assertEqual(body["patient_url"], f"https://abc.trycloudflare.com/p/{instr.token}")
        svg.assert_called_once_with(f"https://abc.trycloudflare.com/p/{instr.token}")

    def test_qr_is_svg(self):
        instr = self.make_instruction()
        resp = self.client.get(f"/api/instructions/{instr.id}/qr.svg")
        self.assertEqual(resp["Content-Type"], "image/svg+xml")
        self.assertTrue(resp.content.startswith(b"<svg"))


class AudioTests(StaffApiTestCase):
    def test_item_audio_full_and_range(self):
        instr = self.make_instruction()
        item = instr.items.select_related("audio").first()
        url = f"/api/instructions/{instr.id}/items/{item.id}/audio/"

        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], item.audio.content_type)
        self.assertEqual(resp.content, bytes(item.audio.data))
        self.assertEqual(resp["Accept-Ranges"], "bytes")

        resp = self.client.get(url, HTTP_RANGE="bytes=0-9")
        self.assertEqual(resp.status_code, 206)
        self.assertEqual(len(resp.content), 10)
        self.assertEqual(resp["Content-Range"], f"bytes 0-9/{len(item.audio.data)}")

        self.assertEqual(self.client.get(url, HTTP_RANGE="bytes=999999-").status_code, 416)

    def test_item_from_another_instruction_is_404(self):
        mine = self.make_instruction()
        other_item = self.make_instruction(label="Baba T.").items.first()
        resp = self.client.get(f"/api/instructions/{mine.id}/items/{other_item.id}/audio/")
        self.assertEqual(resp.status_code, 404)


class ListAndDashboardTests(StaffApiTestCase):
    def test_list_has_no_n_plus_one(self):
        for n in range(5):
            self.make_instruction(label=f"P{n}")
        # session + user + one annotated instruction query, whatever the row count
        with self.assertNumQueries(3):
            body = self.client.get("/api/instructions/").json()
        self.assertEqual(len(body["instructions"]), 5)

    def test_list_counts_and_review_flag(self):
        both = self.make_instruction(keys=("medication_dose", "after_food"), label="Both")
        food_only = self.make_instruction(keys=("after_food",), label="Food")
        TemplateTranslation.objects.filter(template__key="after_food").update(
            status=TemplateTranslation.Status.APPROVED)
        rows = {r["id"]: r for r in self.client.get("/api/instructions/").json()["instructions"]}
        self.assertEqual(rows[both.id]["item_count"], 2)
        self.assertTrue(rows[both.id]["has_unreviewed"])
        self.assertEqual(rows[food_only.id]["item_count"], 1)
        self.assertFalse(rows[food_only.id]["has_unreviewed"])

    def test_dashboard(self):
        instr = self.make_instruction()
        Reply.objects.create(instruction=instr, original_audio=b"x", original_content_type="audio/webm")
        Reply.objects.create(instruction=instr, original_audio=b"x", original_content_type="audio/webm",
                             is_resolved=True)
        body = self.client.get("/api/dashboard/").json()
        self.assertEqual(body["unresolved_replies"], 1)
        self.assertEqual(body["recent_instructions"][0]["id"], instr.id)
        self.assertIn("mock_mode", body)
