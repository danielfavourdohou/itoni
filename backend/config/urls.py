from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    path("admin/", admin.site.urls),
    # /healthz is answered by config.health.HealthCheckMiddleware, before host checks.
    path("api/", include("instructions.api.urls")),
]
