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
        self.assertEqual(protected, "Take XQ1Z of XQ2Z, XQ1Z")
        # restore requires each sentinel exactly once, so a repeated placeholder is rejected
        self.assertIsNone(translation.restore("Kunywa XQ1Z ya XQ2Z, XQ1Z", mapping))

    def test_restore_ok(self):
        _, mapping = translation.protect("Take {dose} of {drug}", translation.SENTINEL_STYLES[0])
        self.assertEqual(translation.restore("Kunywa XQ1Z ya XQ2Z", mapping), "Kunywa {dose} ya {drug}")

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

    def test_placeholders_as_written_cost_one_call(self):
        # The live API keeps {name} intact (measured 23 Oct 2026), so no sentinel round trip is needed.
        t = Template.objects.create(key="dose", title="Dose", english_text="Take {dose} of {drug}.",
                                    fallback_english_text="Take as shown below.", placeholders=["dose", "drug"])
        with mock.patch.object(nkenne, "translate", return_value="Chukua {dose} ya {drug}.") as tr:
            result = translation.translate_with_placeholders(t, SW)
        self.assertEqual(tr.call_count, 1)
        self.assertFalse(result.uses_fallback)
        self.assertEqual(result.text, "Chukua {dose} ya {drug}.")

    def test_placeholders_intact_rejects_renamed_doubled_or_invented(self):
        src = "Take {dose} of {drug}."
        self.assertTrue(translation.placeholders_intact(src, "Chukua {dose} ya {drug}."))
        self.assertFalse(translation.placeholders_intact(src, "Chukua {dozi} ya {drug}."))
        self.assertFalse(translation.placeholders_intact(src, "Chukua {dose} {dose} ya {drug}."))
        self.assertFalse(translation.placeholders_intact(src, "Chukua {dose} ya {drug} {days}."))


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
                                                 return_value=fake_response(json_body={"translated_text": "Kunywa baada ya chakula."})):
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
        responses = [fake_response(503, {"error": "busy"}), fake_response(json_body={"translated_text": "Habari"})]
        with mock.patch("instructions.services.nkenne.requests.request", side_effect=responses) as req, \
             mock.patch("instructions.services.nkenne.time.sleep"):
            self.assertEqual(nkenne.translate("hi", SW), "Habari")
        self.assertEqual(req.call_count, 2)
        self.assertEqual(ApiCallLog.objects.filter(cached=False, mocked=False).count(), 2)

    @nkenne_settings(**LIVE)
    def test_plain_500_not_retried(self):
        # 23 Oct 2026: Speech Translation 500s were model failures; three tries meant three charges.
        with mock.patch("instructions.services.nkenne.requests.request",
                        return_value=fake_response(500, {"message": "Speech translation failed"})) as req:
            with self.assertRaises(nkenne.NkenneError):
                nkenne.speech_translate(b"x" * 200, "r.wav", "audio/wav", SW)
        self.assertEqual(req.call_count, 1)

    @nkenne_settings(MOCK=False, API_KEY="")
    def test_missing_key(self):
        with self.assertRaises(nkenne.NkenneError):
            nkenne.translate("hi", SW)

    @nkenne_settings(**LIVE)
    def test_speech_translate_parses_snake_case(self):
        with mock.patch("instructions.services.nkenne.requests.request",
                        return_value=fake_response(json_body={"translated_text": "I feel worse"})):
            self.assertEqual(nkenne.speech_translate(b"x" * 200, "r.ogg", "audio/ogg", SW), "I feel worse")

    @nkenne_settings(**LIVE)
    def test_translate_parses_live_and_documented_shapes(self):
        # Live API (23 Oct 2026) answers snake_case with tokensRemaining; the PDF docs show camelCase.
        live = {"translated_text": "Chukua dawa hii baada ya kula chakula.", "tokensRemaining": 1040}
        for body in (live, {"translatedText": "Habari"}):
            with mock.patch("instructions.services.nkenne.requests.request", return_value=fake_response(json_body=body)):
                self.assertTrue(nkenne.translate("hi", SW))

    @nkenne_settings(**LIVE)
    def test_error_log_never_stores_the_raw_body(self):
        # Shape of the real 23 Oct 2026 Speech Translation 500: internal headers echoed under "details".
        body = {"message": "Speech translation failed", "error": "Request failed with status code 500",
                "details": {"requestHeaders": {"Authorization": "Bearer leaked-upstream-secret"}}}
        with mock.patch("instructions.services.nkenne.requests.request", return_value=fake_response(500, body)), \
             mock.patch("instructions.services.nkenne.time.sleep"):
            with self.assertRaises(nkenne.NkenneError) as ctx:
                nkenne.speech_translate(b"x" * 200, "r.ogg", "audio/ogg", SW)
        logged = list(ApiCallLog.objects.values_list("error", flat=True))
        self.assertTrue(logged)
        for text in [*logged, str(ctx.exception)]:
            self.assertNotIn("leaked-upstream-secret", text)
            self.assertIn("Speech translation failed", text)

    @nkenne_settings(**LIVE)
    def test_translate_without_text_field_is_an_error(self):
        with mock.patch("instructions.services.nkenne.requests.request",
                        return_value=fake_response(json_body={"message": "ok", "tokensRemaining": 3})):
            with self.assertRaises(nkenne.NkenneError):
                nkenne.translate("hi", SW)


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
    def test_tts_failure_keeps_paid_translation_and_log_and_sends_text(self):
        food = Template.objects.get(key="after_food")
        responses = [fake_response(json_body={"translated_text": "Kunywa baada ya chakula."}),
                     fake_response(400, {"error": "Unknown voice"})]
        with mock.patch("instructions.services.nkenne.requests.request", side_effect=responses):
            instr = rendering.create_instruction(user=self.user, patient_label="X", language=SW, items=[(food, {})])
        self.assertIsNone(instr.items.get().audio)  # text-only item, audio retried on next use
        self.assertTrue(TemplateTranslation.objects.filter(template=food, is_mock=False).exists())
        self.assertTrue(ApiCallLog.objects.filter(kind="tts", status_code=400).exists())

    def test_translate_templates_command_rerun_is_free(self):
        call_command("translate_templates", verbosity=0)
        live_or_mock_before = ApiCallLog.objects.filter(cached=False).count()
        call_command("translate_templates", verbosity=0)
        self.assertEqual(ApiCallLog.objects.filter(cached=False).count(), live_or_mock_before)


class AudioConversionTests(TestCase):
    def test_converts_to_16k_mono_pcm_wav(self):
        import io as _io
        import wave as _wave
        out = audio.convert_for_translation(nkenne._mock_wav())
        self.assertTrue(out.startswith(b"RIFF"))
        with _wave.open(_io.BytesIO(out)) as w:
            self.assertEqual((w.getframerate(), w.getnchannels(), w.getsampwidth()), (16000, 1, 2))

    def test_rejects_garbage(self):
        with self.assertRaises(audio.AudioConversionError):
            audio.convert_for_translation(b"not audio at all" * 10)

    @nkenne_settings(**LIVE)
    def test_live_wav_tts_is_stored_as_mp3(self):
        # Live TTS returned audio/wav on 23 Oct 2026; patients get a 5x smaller MP3.
        wav = nkenne._mock_wav(seconds=3.0)
        with mock.patch("instructions.services.nkenne.requests.request",
                        return_value=fake_response(content=wav, content_type="audio/wav")):
            clip = audio.get_or_create_clip("Chukua dawa hii baada ya kula chakula.", SW)
        self.assertEqual(clip.content_type, "audio/mpeg")
        self.assertLess(len(clip.data), len(wav) // 3)
        self.assertFalse(clip.is_mock)

    def test_compress_keeps_original_when_ffmpeg_fails(self):
        self.assertEqual(audio.compress_speech(b"not audio" * 20, "audio/wav"), (b"not audio" * 20, "audio/wav"))

    @nkenne_settings(**LIVE)
    def test_non_json_error_is_summarised_safely(self):
        # Seen 23 Oct 2026 from Render: a fast 403 that was not JSON. Keep enough to diagnose it.
        page = b"<html><head><title>403 Forbidden</title></head><body>Blocked. ray=abcdefghijklmnopqrstuvwxyz0123</body></html>"
        resp = fake_response(403, content=page, content_type="text/html")
        resp.headers["Server"] = "cloudflare"
        with mock.patch("instructions.services.nkenne.requests.request", return_value=resp):
            with self.assertRaises(nkenne.NkenneError):
                nkenne.speech_translate(b"x" * 200, "r.ogg", "audio/ogg", SW)
        logged = ApiCallLog.objects.get().error
        self.assertIn("HTTP 403", logged)
        self.assertIn("text/html", logged)
        self.assertIn("server=cloudflare", logged)
        self.assertIn("403 Forbidden", logged)
        self.assertNotIn("abcdefghijklmnopqrstuvwxyz0123", logged)
        self.assertNotIn("<", logged)


class AudioFallbackTests(TestCase):
    """23 Oct 2026: Cloudflare challenged every NKENNEAi call from Render. Text must still go out."""

    def setUp(self):
        call_command("seed_templates", verbosity=0)
        self.user = get_user_model().objects.create_user("nurse", password="x")

    def test_tts_failure_creates_instruction_without_that_audio(self):
        t = Template.objects.get(key="after_food")
        with mock.patch.object(audio, "get_or_create_clip", side_effect=nkenne.NkenneError("blocked", status_code=403)):
            instr = rendering.create_instruction(user=self.user, patient_label="Mama A.", language=SW, items=[(t, {})])
        item = instr.items.get()
        self.assertIsNone(item.audio)
        self.assertTrue(item.rendered_text)

    def test_translation_failure_still_stops_creation(self):
        t = Template.objects.get(key="after_food")
        with mock.patch.object(translation, "get_or_create_translation",
                               side_effect=nkenne.NkenneError("blocked", status_code=403)):
            with self.assertRaises(nkenne.NkenneError):
                rendering.create_instruction(user=self.user, patient_label="Mama A.", language=SW, items=[(t, {})])
        self.assertFalse(Instruction.objects.exists())
