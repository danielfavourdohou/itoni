import json
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from instructions.models import ApiCallLog, Language, Reply, Template
from instructions.services import nkenne, rendering
from instructions.tests.test_api_auth import FAST_HASHER
from instructions.tests.test_api_staff import itoni_settings

SW = Language.SWAHILI


def wav(name="reply.wav", content_type="audio/wav"):
    return SimpleUploadedFile(name, nkenne._mock_wav(), content_type=content_type)


@FAST_HASHER
class ReplyTestCase(TestCase):
    def setUp(self):
        call_command("seed_templates", verbosity=0)
        self.staff = get_user_model().objects.create_user("nurse", password="pw", is_staff=True)
        self.instr = self.make()

    def make(self, label="Mama A."):
        food = Template.objects.get(key="after_food")
        return rendering.create_instruction(user=self.staff, patient_label=label, language=SW, items=[(food, {})])

    def post_reply(self, instr=None, consent="true", audio_file=None):
        data = {"consent": consent}
        if audio_file is not False:
            data["audio_file"] = audio_file or wav()
        return self.client.post(f"/api/p/{(instr or self.instr).token}/reply/", data)


class PatientReplyTests(ReplyTestCase):
    def test_success_in_mock_mode(self):
        resp = self.post_reply()
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json(), {"status": "done"})
        reply = Reply.objects.get()
        self.assertEqual(reply.translated_text, nkenne.MOCK_REPLY_TEXT)
        self.assertTrue(reply.is_mock)
        self.assertEqual(reply.original_content_type, "audio/wav")
        self.assertTrue(bytes(reply.converted_audio).startswith(b"RIFF"))  # WAV, as NKENNEAi recommends
        self.assertTrue(ApiCallLog.objects.filter(kind="st", mocked=True).exists())

    def test_codec_suffix_in_content_type_is_accepted(self):
        resp = self.post_reply(audio_file=wav("r.webm", "audio/webm;codecs=opus"))
        # ffmpeg sniffs the real format, so a WAV body labelled webm still converts.
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Reply.objects.get().original_content_type, "audio/webm")

    def test_no_consent_is_400_and_stores_nothing(self):
        for consent in ("", "false", "no"):
            resp = self.post_reply(consent=consent)
            self.assertEqual(resp.status_code, 400, consent)
            self.assertEqual(resp.json()["code"], "consent_required")
        self.assertFalse(Reply.objects.exists())

    def test_missing_file_is_400(self):
        resp = self.post_reply(audio_file=False)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "no_audio")

    def test_oversize_is_413(self):
        with itoni_settings(REPLY_MAX_BYTES=100):
            resp = self.post_reply()
        self.assertEqual(resp.status_code, 413)
        self.assertEqual(resp.json()["code"], "too_large")
        self.assertFalse(Reply.objects.exists())

    def test_non_audio_mime_is_400(self):
        resp = self.post_reply(audio_file=SimpleUploadedFile("x.txt", b"hello", content_type="text/plain"))
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "not_audio")

    def test_undecodable_audio_is_400_and_never_translated(self):
        junk = SimpleUploadedFile("x.webm", b"not audio at all" * 20, content_type="audio/webm")
        resp = self.post_reply(audio_file=junk)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "not_audio")
        self.assertFalse(Reply.objects.exists())
        self.assertFalse(ApiCallLog.objects.filter(kind="st").exists())

    def test_rate_limit_is_429(self):
        with itoni_settings(REPLY_RATE_PER_HOUR=2):
            self.assertEqual(self.post_reply().status_code, 201)
            self.assertEqual(self.post_reply().status_code, 201)
            resp = self.post_reply()
        self.assertEqual(resp.status_code, 429)
        self.assertEqual(resp.json()["code"], "rate_limited")
        self.assertEqual(Reply.objects.count(), 2)

    def test_rate_limit_window_is_one_hour_per_instruction(self):
        with itoni_settings(REPLY_RATE_PER_HOUR=1):
            self.assertEqual(self.post_reply().status_code, 201)
            Reply.objects.update(created_at=timezone.now() - timedelta(hours=2))
            self.assertEqual(self.post_reply().status_code, 201)
            self.assertEqual(self.post_reply(instr=self.make("Baba T.")).status_code, 201)

    def test_translation_failure_keeps_original_and_returns_201(self):
        with mock.patch.object(nkenne, "speech_translate", side_effect=nkenne.NkenneError("boom", status_code=503)):
            resp = self.post_reply()
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json(), {"status": "failed"})
        reply = Reply.objects.get()
        self.assertEqual(reply.status, Reply.Status.FAILED)
        self.assertTrue(reply.error)
        self.assertTrue(bytes(reply.original_audio))

    def test_expired_token_is_404(self):
        self.instr.expires_at = timezone.now() - timedelta(minutes=1)
        self.instr.save()
        self.assertEqual(self.post_reply().status_code, 404)

    def test_get_is_405(self):
        self.assertEqual(self.client.get(f"/api/p/{self.instr.token}/reply/").status_code, 405)

    def test_patient_page_sets_csrf_cookie(self):
        resp = self.client.get(f"/api/p/{self.instr.token}/")
        self.assertIn("csrftoken", resp.cookies)


class InboxTests(ReplyTestCase):
    def setUp(self):
        super().setUp()
        self.post_reply()
        self.post_reply()
        self.old, self.new = Reply.objects.order_by("created_at")

    def test_staff_endpoints_need_login(self):
        for method, url in [("get", "/api/replies/"), ("post", f"/api/replies/{self.old.id}/resolve/"),
                            ("get", f"/api/replies/{self.old.id}/audio/")]:
            self.assertEqual(getattr(self.client, method)(url).status_code, 401, url)

    def test_list_unresolved_first_then_newest(self):
        self.client.force_login(self.staff)
        self.new.is_resolved = True
        self.new.save()
        rows = self.client.get("/api/replies/").json()["replies"]
        self.assertEqual([r["id"] for r in rows], [self.old.id, self.new.id])
        self.assertEqual(rows[0]["patient_label"], "Mama A.")
        self.assertEqual(rows[0]["translated_text"], nkenne.MOCK_REPLY_TEXT)
        self.assertEqual(rows[0]["audio_url"], f"/api/replies/{self.old.id}/audio/")

    def test_list_filter_and_flat_queries(self):
        self.client.force_login(self.staff)
        self.old.is_resolved = True
        self.old.save()
        with self.assertNumQueries(3):  # session, user, replies joined with instruction
            rows = self.client.get("/api/replies/?resolved=false").json()["replies"]
        self.assertEqual([r["id"] for r in rows], [self.new.id])

    def test_resolve_and_reopen(self):
        self.client.force_login(self.staff)
        url = f"/api/replies/{self.old.id}/resolve/"
        # The SPA sends no body to resolve; the test client would send empty multipart, so use JSON.
        self.assertTrue(self.client.post(url, data="", content_type="application/json").json()["is_resolved"])
        resp = self.client.post(url, data=json.dumps({"resolved": False}), content_type="application/json")
        self.assertFalse(resp.json()["is_resolved"])
        bad = self.client.post(url, data=json.dumps({"resolved": "yes"}), content_type="application/json")
        self.assertEqual(bad.status_code, 400)

    def test_reply_audio_returns_original(self):
        self.client.force_login(self.staff)
        resp = self.client.get(f"/api/replies/{self.old.id}/audio/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "audio/wav")
        self.assertEqual(resp.content, nkenne._mock_wav())
        self.assertEqual(self.client.get("/api/replies/9999/audio/").status_code, 404)

    def test_dashboard_counts_unresolved(self):
        self.client.force_login(self.staff)
        self.old.is_resolved = True
        self.old.save()
        self.assertEqual(self.client.get("/api/dashboard/").json()["unresolved_replies"], 1)
