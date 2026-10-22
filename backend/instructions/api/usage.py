"""Usage evidence for the token-efficiency score: summary JSON and a full CSV export."""

from django.http import JsonResponse, StreamingHttpResponse
from django.utils import timezone

from instructions.api.http import api_view
from instructions.services import usage


@api_view("GET")
def summary(request):
    return JsonResponse(usage.summary())


@api_view("GET")
def export_csv(request):
    resp = StreamingHttpResponse(usage.csv_rows(), content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="itoni-api-calls-{timezone.localdate():%Y%m%d}.csv"'
    resp["Cache-Control"] = "private, no-store"
    return resp
