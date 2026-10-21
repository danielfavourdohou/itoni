from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path


def healthz(request):
    return HttpResponse("ok", content_type="text/plain")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", healthz),
    path("api/", include("instructions.api.urls")),
]
