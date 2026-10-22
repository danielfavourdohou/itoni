from django.urls import path, re_path

from instructions.api import auth, patient, staff, usage
from instructions.api.http import not_found

urlpatterns = [
    path("auth/csrf/", auth.csrf, name="api-csrf"),
    path("auth/login/", auth.login, name="api-login"),
    path("auth/logout/", auth.logout, name="api-logout"),
    path("auth/me/", auth.me, name="api-me"),
    path("dashboard/", staff.dashboard, name="api-dashboard"),
    path("templates/", staff.templates, name="api-templates"),
    path("instructions/", staff.instructions, name="api-instructions"),
    path("instructions/<int:pk>/", staff.instruction_detail, name="api-instruction"),
    path("instructions/<int:pk>/qr.svg", staff.instruction_qr, name="api-instruction-qr"),
    path("instructions/<int:pk>/revoke/", staff.instruction_revoke, name="api-instruction-revoke"),
    path("instructions/<int:pk>/items/<int:item_id>/audio/", staff.item_audio, name="api-item-audio"),
    path("p/<str:token>/", patient.instruction, name="api-patient"),
    path("p/<str:token>/audio/<int:item_id>/", patient.item_audio, name="api-patient-audio"),
    path("p/<str:token>/reply/", patient.reply, name="api-patient-reply"),
    path("replies/", staff.reply_list, name="api-replies"),
    path("replies/<int:pk>/resolve/", staff.reply_resolve, name="api-reply-resolve"),
    path("replies/<int:pk>/audio/", staff.reply_audio, name="api-reply-audio"),
    path("translations/", staff.translations, name="api-translations"),
    path("translations/<int:pk>/", staff.translation_update, name="api-translation"),
    path("usage/", usage.summary, name="api-usage"),
    path("usage.csv", usage.export_csv, name="api-usage-csv"),
    # Last: unknown /api/ paths get JSON, never Django's HTML 404.
    re_path(r"^.*$", not_found),
]
