"""JSON plumbing shared by every /api/ view.

The SPA must never receive an HTML error page or a login redirect, so method,
auth, 404, NKENNEAi and unexpected failures all become {"error": ...} here.
"""

from __future__ import annotations

import functools
import json
import logging

from django.http import Http404, HttpRequest, JsonResponse
from django.views.csrf import csrf_failure as django_csrf_failure

from instructions.services import nkenne

logger = logging.getLogger(__name__)


class BadRequest(Exception):
    """Raised inside a view to return 400 with an optional per-field error map."""

    def __init__(self, message: str, fields: dict[str, list[str]] | None = None):
        super().__init__(message)
        self.message = message
        self.fields = fields


def json_error(message: str, status: int, fields: dict[str, list[str]] | None = None) -> JsonResponse:
    body: dict = {"error": message}
    if fields:
        body["fields"] = fields
    return JsonResponse(body, status=status)


def parse_json(request: HttpRequest) -> dict:
    try:
        data = json.loads(request.body or b"{}")
    except (ValueError, UnicodeDecodeError):
        raise BadRequest("Request body must be valid JSON.")
    if not isinstance(data, dict):
        raise BadRequest("Request body must be a JSON object.")
    return data


def api_view(*methods: str, staff: bool = True):
    """Allow only `methods`; with staff=True, 401 when logged out and 403 for non-staff users."""
    def decorator(view):
        @functools.wraps(view)
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                resp = json_error("Method not allowed.", 405)
                resp["Allow"] = ", ".join(methods)
                return resp
            if staff:
                if not request.user.is_authenticated:
                    return json_error("Please log in.", 401)
                if not request.user.is_staff:
                    return json_error("This account does not have staff access.", 403)
            try:
                return view(request, *args, **kwargs)
            except BadRequest as exc:
                return json_error(exc.message, 400, exc.fields)
            except Http404:
                return json_error("Not found.", 404)
            except nkenne.NkenneError as exc:
                return json_error(exc.user_message, 502)
            except Exception:
                logger.exception("Unhandled error in %s %s", request.method, request.path)
                return json_error("Something went wrong on the server.", 500)
        return wrapper
    return decorator


def not_found(request: HttpRequest, *args, **kwargs) -> JsonResponse:
    return json_error("Not found.", 404)


def csrf_failure(request: HttpRequest, reason: str = "") -> JsonResponse:
    # Admin keeps Django's HTML page; the SPA gets JSON it can show.
    if request.path.startswith("/api/"):
        return json_error("Security check failed. Refresh the page and try again.", 403)
    return django_csrf_failure(request, reason=reason)
