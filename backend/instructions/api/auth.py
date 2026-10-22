"""Session auth for the SPA. CSRF stays on: the frontend fetches the cookie first."""

from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie

from instructions.api import serializers
from instructions.api.http import BadRequest, api_view, json_error, parse_json


@ensure_csrf_cookie
@api_view("GET", staff=False)
def csrf(request):
    # mock_mode is public so the login screen can show the MOCK banner before anyone signs in.
    return JsonResponse({"mock_mode": serializers.mock_mode()})


@api_view("POST", staff=False)
def login(request):
    data = parse_json(request)
    username, password = data.get("username"), data.get("password")
    fields = {}
    if not isinstance(username, str) or not username.strip():
        fields["username"] = ["Enter your username."]
    if not isinstance(password, str) or not password:
        fields["password"] = ["Enter your password."]
    if fields:
        raise BadRequest("Please fill in all fields.", fields)

    user = authenticate(request, username=username.strip(), password=password)
    # Same message for a non-staff account, so the endpoint does not reveal which accounts exist.
    if user is None or not user.is_staff:
        return json_error("Wrong username or password.", 400)
    auth_login(request, user)
    return JsonResponse(serializers.session_to_dict(user))


@api_view("POST", staff=False)
def logout(request):
    auth_logout(request)
    return HttpResponse(status=204)


@api_view("GET")
def me(request):
    return JsonResponse(serializers.session_to_dict(request.user))
