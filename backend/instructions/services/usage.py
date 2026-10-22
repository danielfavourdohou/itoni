"""ApiCallLog summary and CSV export: the evidence for the token-efficiency score."""

from __future__ import annotations

import csv
import io
from collections.abc import Iterator

from django.db.models import Avg, Count, Q, Sum

from instructions.models import ApiCallLog

LIVE = Q(cached=False, mocked=False)
ERROR = ~Q(error="") | Q(status_code__gte=400)

CSV_COLUMNS = ["created_at", "kind", "language", "cached", "mocked", "status_code", "latency_ms",
               "request_chars", "request_bytes", "error"]


def summary() -> dict:
    """Per kind: live calls, cache hits, mocked calls, errors, average live latency. One query."""
    rows = (
        ApiCallLog.objects.values("kind")
        # n_* names: an annotation called "cached" would shadow the field inside later filters.
        .annotate(
            n_live=Count("id", filter=LIVE),
            n_cached=Count("id", filter=Q(cached=True)),
            n_mocked=Count("id", filter=Q(mocked=True)),
            n_errors=Count("id", filter=ERROR),
            avg_latency_ms=Avg("latency_ms", filter=LIVE),
            live_chars=Sum("request_chars", filter=LIVE),
            live_bytes=Sum("request_bytes", filter=LIVE),
        )
        .order_by("kind")
    )
    by_kind = []
    for r in rows:
        served = r["n_cached"] + r["n_live"] + r["n_mocked"]
        by_kind.append({
            "kind": r["kind"],
            "label": ApiCallLog.Kind(r["kind"]).label if r["kind"] in ApiCallLog.Kind.values else r["kind"],
            "live": r["n_live"],
            "cached": r["n_cached"],
            "mocked": r["n_mocked"],
            "errors": r["n_errors"],
            # Share of requests answered from cache instead of the API (live or mocked).
            "cache_hit_rate": round(r["n_cached"] / served, 3) if served else None,
            "avg_latency_ms": round(r["avg_latency_ms"]) if r["avg_latency_ms"] is not None else None,
            "live_chars": r["live_chars"] or 0,
            "live_bytes": r["live_bytes"] or 0,
        })
    totals = {key: sum(k[key] for k in by_kind) for key in ("live", "cached", "mocked", "errors")}
    return {"by_kind": by_kind, "totals": totals}


def _safe(value) -> str:
    """Neutralise spreadsheet formulas: an error message from an API could start with =, +, - or @."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@") else text


def csv_rows() -> Iterator[str]:
    """Header plus every call, oldest first, one encoded line at a time (streams; no big string)."""
    buf = io.StringIO()
    writer = csv.writer(buf)

    def line(values) -> str:
        buf.seek(0)
        buf.truncate()
        writer.writerow(values)
        return buf.getvalue()

    yield line(CSV_COLUMNS)
    for row in ApiCallLog.objects.order_by("created_at").values_list(*CSV_COLUMNS).iterator():
        created_at, *rest = row
        yield line([created_at.isoformat(), *(_safe(v) for v in rest)])
