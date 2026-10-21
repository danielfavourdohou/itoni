from django.urls import path, re_path

from instructions.api import auth
from instructions.api.http import not_found

urlpatterns = [
    path("auth/csrf/", auth.csrf, name="api-csrf"),
    path("auth/login/", auth.login, name="api-login"),
    path("auth/logout/", auth.logout, name="api-logout"),
    path("auth/me/", auth.me, name="api-me"),
    # Last: unknown /api/ paths get JSON, never Django's HTML 404.
    re_path(r"^.*$", not_found),
]
