from django.http import HttpResponse


class HealthCheckMiddleware:
    """Answer /healthz before host validation and the https redirect.

    Render's health checker calls from inside its network with a Host header that is not the
    public hostname and over plain http, so going through ALLOWED_HOSTS and SECURE_SSL_REDIRECT
    would answer 400 or 301 and Render would never route traffic. Must be first in MIDDLEWARE.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == "/healthz" and request.method in ("GET", "HEAD"):
            return HttpResponse("ok", content_type="text/plain")
        return self.get_response(request)
