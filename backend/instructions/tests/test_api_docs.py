import json
import re

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import URLPattern

from instructions.api import urls as api_urls
from instructions.api.openapi import build_spec
from instructions.tests.test_api_auth import FAST_HASHER

DOC_PATHS = ("/api/docs/", "/api/docs", "/api/openapi.json")


def itoni(**overrides):
    from django.conf import settings
    return override_settings(ITONI={**settings.ITONI, **overrides})


@FAST_HASHER
class DocsAccessTests(TestCase):
    @itoni(API_DOCS_PUBLIC=False)
    def test_hidden_from_visitors_when_not_public(self):
        for path in DOC_PATHS:
            resp = self.client.get(path)
            self.assertEqual(resp.status_code, 404, path)
            self.assertEqual(resp.json()["error"], "Not found.")

    @itoni(API_DOCS_PUBLIC=False)
    def test_staff_can_read_when_not_public(self):
        get_user_model().objects.create_user("nurse", password="pw-123456", is_staff=True)
        self.client.login(username="nurse", password="pw-123456")
        for path in DOC_PATHS:
            self.assertEqual(self.client.get(path).status_code, 200, path)

    @itoni(API_DOCS_PUBLIC=True)
    def test_public_page_is_read_only_and_integrity_checked(self):
        resp = self.client.get("/api/docs/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp["Content-Type"].startswith("text/html"))
        html = resp.content.decode()
        self.assertIn("hideTestRequestButton: true", html)
        self.assertIn('integrity="sha384-', html)
        self.assertIn("@scalar/api-reference@1.73.1", html)

    @itoni(API_DOCS_PUBLIC=True)
    def test_public_spec(self):
        spec = self.client.get("/api/openapi.json").json()
        self.assertEqual(spec["openapi"], "3.1.0")
        self.assertEqual(spec["info"]["title"], "Ìtọ́ni API")


def _documented_path(route: str) -> str:
    return "/api/" + re.sub(r"<(?:\w+:)?(\w+)>", r"{\1}", route)


class SpecDriftTests(TestCase):
    """The spec is hand-written, so these keep it honest as the API changes."""

    def test_every_api_route_is_documented(self):
        spec_paths = set(build_spec()["paths"])
        skip = {"docs/", "docs", "openapi.json"}
        routes = [p.pattern._route for p in api_urls.urlpatterns
                  if isinstance(p, URLPattern) and hasattr(p.pattern, "_route") and p.pattern._route not in skip]
        missing = [r for r in routes if _documented_path(r) not in spec_paths]
        self.assertEqual(missing, [], "Add these routes to instructions/api/openapi.py")

    def test_every_schema_reference_resolves(self):
        spec = build_spec()
        refs = set(re.findall(r'"#/components/schemas/(\w+)"', json.dumps(spec)))
        self.assertTrue(refs)
        self.assertEqual(refs - set(spec["components"]["schemas"]), set())
