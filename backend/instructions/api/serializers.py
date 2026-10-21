"""Response shapes for the API, as plain functions returning dicts.

Keep these in step with frontend/src/lib/types.ts.
"""

from __future__ import annotations

from django.conf import settings


def mock_mode() -> bool:
    return bool(settings.NKENNE["MOCK"])


def user_to_dict(user) -> dict:
    return {"id": user.id, "username": user.username}


def session_to_dict(user) -> dict:
    return {"user": user_to_dict(user), "mock_mode": mock_mode()}
