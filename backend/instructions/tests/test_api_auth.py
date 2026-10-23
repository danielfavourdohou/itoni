import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings

from instructions.tests.test_services import nkenne_settings


def post_json(client, url, data):
    return client.post(url, data=json.dumps(data), content_type="application/json")


# Real password hashing makes every create_user cost ~0.5 s; irrelevant to these tests.
FAST_HASHER = override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])


@FAST_HASHER
class AuthApiTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.staff = User.objects.create_user("nurse", password="pw-123456", is_staff=True)
        self.plain = User.objects.create_user("visitor", password="pw-123456")

    def test_csrf_sets_cookie(self):
        with nkenne_settings(MOCK=True):
            resp = self.client.get("/api/auth/csrf/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("csrftoken", resp.cookies)
        self.assertIs(resp.json()["mock_mode"], True)

    def test_login_success_then_me(self):
        resp = post_json(self.client, "/api/auth/login/", {"username": "nurse", "password": "pw-123456"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["user"]["username"], "nurse")
        self.assertIn("mock_mode", resp.json())
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)

    def test_login_wrong_password(self):
        resp = post_json(self.client, "/api/auth/login/", {"username": "nurse", "password": "nope"})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["error"], "Wrong username or password.")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_login_non_staff_rejected_with_same_message(self):
        resp = post_json(self.client, "/api/auth/login/", {"username": "visitor", "password": "pw-123456"})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["error"], "Wrong username or password.")

    def test_login_missing_fields(self):
        resp = post_json(self.client, "/api/auth/login/", {"username": " "})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(set(resp.json()["fields"]), {"username", "password"})

    def test_login_bad_json(self):
        resp = self.client.post("/api/auth/login/", data="{not json", content_type="application/json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("error", resp.json())

    def test_logout(self):
        self.client.force_login(self.staff)
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_me_anonymous_is_401_json(self):
        resp = self.client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp["Content-Type"], "application/json")

    def test_me_non_staff_is_403(self):
        self.client.force_login(self.plain)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 403)

    def test_me_reports_mock_mode(self):
        self.client.force_login(self.staff)
        with nkenne_settings(MOCK=True):
            self.assertIs(self.client.get("/api/auth/me/").json()["mock_mode"], True)
        with nkenne_settings(MOCK=False):
            self.assertIs(self.client.get("/api/auth/me/").json()["mock_mode"], False)

    def test_csrf_enforced_on_login(self):
        client = Client(enforce_csrf_checks=True)
        creds = {"username": "nurse", "password": "pw-123456"}
        resp = post_json(client, "/api/auth/login/", creds)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("error", resp.json())

        token = client.get("/api/auth/csrf/").cookies["csrftoken"].value
        resp = client.post("/api/auth/login/", data=json.dumps(creds), content_type="application/json",
                           HTTP_X_CSRFTOKEN=token)
        self.assertEqual(resp.status_code, 200)

    def test_csrf_failure_outside_api_keeps_html(self):
        resp = Client(enforce_csrf_checks=True).post("/admin/login/", {"username": "x", "password": "y"})
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(resp["Content-Type"].startswith("text/html"))

    def test_wrong_method_is_405_json(self):
        resp = self.client.get("/api/auth/login/")
        self.assertEqual(resp.status_code, 405)
        self.assertEqual(resp["Allow"], "POST")
        self.assertIn("error", resp.json())

    def test_unknown_api_path_is_404_json(self):
        resp = self.client.get("/api/nope/")
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json(), {"error": "Not found."})


class ApiViewFailureTests(TestCase):
    def test_database_failure_during_auth_is_json_500(self):
        from django.db import OperationalError
        from django.test import RequestFactory
        from django.utils.functional import SimpleLazyObject

        from instructions.api import auth

        def broken_user():
            raise OperationalError("remaining connection slots are reserved")

        request = RequestFactory().get("/api/auth/me/")
        request.user = SimpleLazyObject(broken_user)
        resp = auth.me(request)
        self.assertEqual(resp.status_code, 500)
        self.assertEqual(json.loads(resp.content), {"error": "Something went wrong on the server."})


RENDER_HOST = "itoni-api.onrender.com"
VERCEL_ORIGIN = "https://itoni.vercel.app"


@FAST_HASHER
@override_settings(ALLOWED_HOSTS=[RENDER_HOST], CSRF_TRUSTED_ORIGINS=[VERCEL_ORIGIN])
class VercelProxyTests(TestCase):
    """Production: the browser is on Vercel, which proxies /api/ to the Render host."""

    def setUp(self):
        get_user_model().objects.create_user("nurse", password="pw-123456", is_staff=True)

    def login_from(self, origin):
        client = Client(enforce_csrf_checks=True, HTTP_HOST=RENDER_HOST)
        token = client.get("/api/auth/csrf/", secure=True).cookies["csrftoken"].value
        return client.post("/api/auth/login/", data=json.dumps({"username": "nurse", "password": "pw-123456"}),
                           content_type="application/json", secure=True,
                           HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN=origin, HTTP_REFERER=f"{origin}/login")

    def test_login_from_trusted_vercel_origin(self):
        self.assertEqual(self.login_from(VERCEL_ORIGIN).status_code, 200)

    def test_login_from_other_origin_rejected(self):
        resp = self.login_from("https://evil.example")
        self.assertEqual(resp.status_code, 403)
        self.assertIn("error", resp.json())

    def test_api_json_is_never_cached_by_a_shared_cdn(self):
        resp = self.client.get("/api/auth/csrf/", secure=True, HTTP_HOST=RENDER_HOST)
        self.assertEqual(resp["Cache-Control"], "private, no-store")
        self.assertEqual(self.client.get("/api/auth/me/", secure=True, HTTP_HOST=RENDER_HOST)["Cache-Control"],
                         "private, no-store")
