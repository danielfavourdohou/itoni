from datetime import date
from unittest import mock

import requests
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

from instructions.models import ApiCallLog, AudioClip, Instruction, Language, Template, TemplateTranslation
from instructions.services import audio, nkenne, rendering, translation

SW = Language.SWAHILI
LIVE = {"MOCK": False, "API_KEY": "test-key"}


def nkenne_settings(**overrides):
    from django.conf import settings
    return override_settings(NKENNE={**settings.NKENNE, **overrides})


def fake_response(status=200, json_body=None, content=b"", content_type="application/json"):
    resp = requests.Response()
    resp.status_code = status
    resp.headers["Content-Type"] = content_type
    resp._content = content if content else (str(json_body).replace("'", '"').encode() if json_body else b"")
    return resp


class PlaceholderTests(TestCase):
    def test_protect_and_restore_round_trip(self):
        protected, mapping = translation.protect("Take {dose} of {drug}, {dose}", translation.SENTINEL_STYLES[0])
        self.assertEqual(protected, "Take [[1]] of [[2]], [[1]]")
        # restore requires each sentinel exactly once, so a repeated placeholder is rejected
        self.assertIsNone(translation.restore("Kunywa [[1]] ya [[2]], [[1]]", mapping))

    def test_restore_ok(self):
        _, mapping = translation.protect("Take {dose} of {drug}", translation.SENTINEL_STYLES[0])
        self.assertEqual(translation.restore("Kunywa [[1]] ya [[2]]", mapping), "Kunywa {dose} ya {drug}")

    def test_restore_rejects_missing_sentinel(self):
        _, mapping = translation.protect("Take {dose} of {drug}", translation.SENTINEL_STYLES[0])
        self.assertIsNone(translation.restore("Kunywa 1 ya dawa", mapping))

    def test_falls_back_when_placeholders_lost(self):
        t = Template.objects.create(key="dose", title="Dose", english_text="Take {dose}.",
                                    fallback_english_text="Take as shown below.", placeholders=["dose"])
        with mock.patch.object(nkenne, "translate", side_effect=["Kunywa dawa.", "Kunywa dawa.", "Kunywa kama ilivyo."]):
            result = translation.translate_with_placeholders(t, SW)
        self.assertTrue(result.uses_fallback)
        self.assertEqual(result.text, "Kunywa kama ilivyo.")


class CacheTests(TestCase):
    def setUp(self):
        self.t = Template.objects.create(key="food", title="Food", english_text="Take after food.")

    def test_translation_cached(self):
        translation.get_or_create_translation(self.t, SW)
        translation.get_or_create_translation(self.t, SW)
        self.assertEqual(ApiCallLog.objects.filter(kind="translate", cached=False).count(), 1)
        self.assertEqual(ApiCallLog.objects.filter(kind="translate", cached=True).count(), 1)

    def test_changed_english_retranslates(self):
        translation.get_or_create_translation(self.t, SW)
        self.t.english_text = "Take after eating."
        self.t.save()
        tr = translation.get_or_create_translation(self.t, SW)
        self.assertIn("Take after eating.", tr.text)
        self.assertEqual(TemplateTranslation.objects.count(), 1)

    def test_mock_translation_replaced_when_live(self):
        translation.get_or_create_translation(self.t, SW)  # mock
        with nkenne_settings(**LIVE), mock.patch("instructions.services.nkenne.requests.request",
                                                 return_value=fake_response(json_body={"translatedText": "Kunywa baada ya chakula."})):
            tr = translation.get_or_create_translation(self.t, SW)
        self.assertFalse(tr.is_mock)
        self.assertEqual(tr.text, "Kunywa baada ya chakula.")

    def test_audio_cached(self):
        audio.get_or_create_clip("Habari", SW)
        audio.get_or_create_clip("Habari", SW)
        self.assertEqual(AudioClip.objects.count(), 1)
        self.assertEqual(ApiCallLog.objects.filter(kind="tts", cached=True).count(), 1)


class ClientTests(TestCase):
    @nkenne_settings(**LIVE)
    def test_4xx_not_retried(self):
        with mock.patch("instructions.services.nkenne.requests.request",
                        return_value=fake_response(400, {"error": "Invalid language combination"})) as req:
            with self.assertRaises(nkenne.NkenneError) as ctx:
                nkenne.translate("hi", SW)
        self.assertEqual(req.call_count, 1)
        self.assertEqual(ctx.exception.status_code, 400)

    @nkenne_settings(**LIVE)
    def test_5xx_retried_then_succeeds(self):
        responses = [fake_response(503, {"error": "busy"}), fake_response(json_body={"translatedText": "Habari"})]
        with mock.patch("instructions.services.nkenne.requests.request", side_effect=responses) as req, \
             mock.patch("instructions.services.nkenne.time.sleep"):
            self.assertEqual(nkenne.translate("hi", SW), "Habari")
        self.assertEqual(req.call_count, 2)
        self.assertEqual(ApiCallLog.objects.filter(cached=False, mocked=False).count(), 2)

    @nkenne_settings(MOCK=False, API_KEY="")
    def test_missing_key(self):
        with self.assertRaises(nkenne.NkenneError):
            nkenne.translate("hi", SW)

    @nkenne_settings(**LIVE)
    def test_speech_translate_parses_snake_case(self):
        with mock.patch("instructions.services.nkenne.requests.request",
                        return_value=fake_response(json_body={"translated_text": "I feel worse"})):
            self.assertEqual(nkenne.speech_translate(b"x" * 200, "r.ogg", "audio/ogg", SW), "I feel worse")


class RenderingTests(TestCase):
    def setUp(self):
        call_command("seed_templates", verbosity=0)
        self.user = get_user_model().objects.create_user("nurse", password="x")

    def test_create_instruction_mock(self):
        dose = Template.objects.get(key="medication_dose")
        follow = Template.objects.get(key="follow_up")
        instr = rendering.create_instruction(
            user=self.user, patient_label="Mama A.", language=SW,
            items=[(dose, {"dose": "500mg", "drug": "Amoxicillin", "times_per_day": 2, "days": 5}),
                   (follow, {"date": date(2026, 10, 31)})],
        )
        items = list(instr.items.all())
        self.assertIn("500mg", items[0].rendered_text)
        self.assertIn("31/10/2026", items[1].rendered_text)
        self.assertTrue(all(i.audio_id for i in items))
        self.assertEqual(len(instr.token), 32)

    def test_missing_value_rejected(self):
        dose = Template.objects.get(key="medication_dose")
        with self.assertRaises(ValueError):
            rendering.create_instruction(user=self.user, patient_label="X", language=SW, items=[(dose, {"dose": "1"})])

    @nkenne_settings(**LIVE)
    def test_failed_create_keeps_paid_translation_and_log(self):
        food = Template.objects.get(key="after_food")
        responses = [fake_response(json_body={"translatedText": "Kunywa baada ya chakula."}),
                     fake_response(400, {"error": "Unknown voice"})]
        with mock.patch("instructions.services.nkenne.requests.request", side_effect=responses):
            with self.assertRaises(nkenne.NkenneError):
                rendering.create_instruction(user=self.user, patient_label="X", language=SW, items=[(food, {})])
        self.assertFalse(Instruction.objects.exists())
        self.assertTrue(TemplateTranslation.objects.filter(template=food, is_mock=False).exists())
        self.assertTrue(ApiCallLog.objects.filter(kind="tts", status_code=400).exists())

    def test_translate_templates_command_rerun_is_free(self):
        call_command("translate_templates", verbosity=0)
        live_or_mock_before = ApiCallLog.objects.filter(cached=False).count()
        call_command("translate_templates", verbosity=0)
        self.assertEqual(ApiCallLog.objects.filter(cached=False).count(), live_or_mock_before)


class AudioConversionTests(TestCase):
    def test_converts_wav_to_ogg(self):
        ogg = audio.convert_to_ogg(nkenne._mock_wav())
        self.assertTrue(ogg.startswith(b"OggS"))

    def test_rejects_garbage(self):
        with self.assertRaises(audio.AudioConversionError):
            audio.convert_to_ogg(b"not audio at all" * 10)
