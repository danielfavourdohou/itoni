"""API reference: the OpenAPI spec and a read-only Scalar page that renders it.

Public when ITONI_API_DOCS_PUBLIC is true (production, for the submission); otherwise logged-in
staff only, and 404 for everyone else so the endpoint does not advertise itself.
"""

from django.conf import settings
from django.http import HttpResponse, JsonResponse

from instructions.api.http import api_view, json_error
from instructions.api.openapi import build_spec

# Pinned and integrity-checked: a changed file on the CDN is refused by the browser.
SCALAR_URL = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.73.1/dist/browser/standalone.js"
SCALAR_SRI = "sha384-kYDGzV91Jnn3TbHINV3nt54riK2uMJDfN5Al8dAkz4FssELTBWbD8rgw32sTKfOi"

PAGE = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ìtọ́ni API</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    body {{ margin: 0; }}
    .light-mode, .dark-mode {{ --scalar-color-accent: #2b3a9f; }}
    .dark-mode {{ --scalar-color-accent: #a5b0ff; }}
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="{SCALAR_URL}" integrity="{SCALAR_SRI}" crossorigin="anonymous"></script>
  <script>
    // Read-only: no "send request" button, so nobody can spend NKENNEAi tokens from the docs.
    Scalar.createApiReference("#app", {{
      url: "/api/openapi.json",
      hideTestRequestButton: true,
      hideClientButton: true,
      // Scalar's own extras (AI chat, MCP generator, dev toolbar) are not part of Ìtọ́ni.
      agent: {{ disabled: true }},
      mcp: {{ disabled: true }},
      showDeveloperTools: "never",
      withDefaultFonts: true,
      metaData: {{ title: "Ìtọ́ni API" }},
    }});
  </script>
</body>
</html>
"""


def _allowed(request) -> bool:
    return settings.ITONI["API_DOCS_PUBLIC"] or (request.user.is_authenticated and request.user.is_staff)


@api_view("GET", staff=False)
def page(request):
    if not _allowed(request):
        return json_error("Not found.", 404)
    return HttpResponse(PAGE, content_type="text/html; charset=utf-8")


@api_view("GET", staff=False)
def spec(request):
    if not _allowed(request):
        return json_error("Not found.", 404)
    return JsonResponse(build_spec(), json_dumps_params={"ensure_ascii": False})
