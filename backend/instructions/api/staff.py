"""Staff endpoints. Thin: parse, validate, call a service, serialise."""

from django.db.models import Count, Exists, OuterRef, QuerySet
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404

from instructions.api import serializers
from instructions.api.http import BadRequest, api_view, audio_response, parse_json
from instructions.models import Instruction, InstructionItem, Language, Reply, Template, TemplateTranslation
from instructions.services import qr, rendering, values

LIST_LIMIT = 100
DASHBOARD_LIMIT = 10
REPLY_LIMIT = 200


def instruction_list_qs() -> QuerySet[Instruction]:
    """Instructions annotated with item_count and has_unreviewed, in one query (no N+1)."""
    approved = TemplateTranslation.objects.filter(
        template=OuterRef("template"),
        language=OuterRef("instruction__language"),
        status=TemplateTranslation.Status.APPROVED,
    )
    unreviewed_items = InstructionItem.objects.filter(instruction=OuterRef("pk")).exclude(Exists(approved))
    return Instruction.objects.annotate(
        item_count=Count("items"),
        has_unreviewed=Exists(unreviewed_items),
    ).order_by("-created_at")


@api_view("GET")
def dashboard(request):
    recent = instruction_list_qs()[:DASHBOARD_LIMIT]
    return JsonResponse({
        "recent_instructions": [serializers.instruction_summary(i) for i in recent],
        "unresolved_replies": Reply.objects.filter(is_resolved=False).count(),
        "mock_mode": serializers.mock_mode(),
    })


@api_view("GET")
def templates(request):
    qs = Template.objects.filter(kind=Template.Kind.INSTRUCTION, is_active=True).order_by("position")
    return JsonResponse({
        "templates": [serializers.template_to_dict(t) for t in qs],
        "value_rules": values.VALUE_RULES,
    })


@api_view("GET", "POST")
def instructions(request):
    if request.method == "GET":
        qs = instruction_list_qs()[:LIST_LIMIT]
        return JsonResponse({"instructions": [serializers.instruction_summary(i) for i in qs]})

    cleaned, errors = values.clean_instruction_payload(parse_json(request))
    if errors:
        raise BadRequest("Please fix the highlighted fields.", errors)
    try:
        instruction = rendering.create_instruction(
            user=request.user, patient_label=cleaned.patient_label, language=Language.SWAHILI,
            items=cleaned.items, follow_up_date=cleaned.follow_up_date,
        )
    except ValueError as exc:  # values.py should have caught this; keep it a 400, never a 500
        raise BadRequest(str(exc))
    return JsonResponse(serializers.instruction_to_dict(request, instruction), status=201)


@api_view("GET")
def instruction_detail(request, pk: int):
    instruction = get_object_or_404(Instruction, pk=pk)
    return JsonResponse(serializers.instruction_to_dict(request, instruction))


@api_view("GET")
def instruction_qr(request, pk: int):
    instruction = get_object_or_404(Instruction, pk=pk)
    resp = HttpResponse(qr.svg(serializers.patient_url(request, instruction)), content_type="image/svg+xml")
    resp["Cache-Control"] = "private, no-store"
    return resp


@api_view("GET")
def item_audio(request, pk: int, item_id: int):
    item = get_object_or_404(InstructionItem.objects.select_related("audio"), pk=item_id, instruction_id=pk)
    if item.audio is None:
        raise Http404
    return audio_response(request, item.audio.data, item.audio.content_type)



@api_view("GET")
def reply_list(request):
    """Inbox: unresolved first, newest first. ?resolved=true|false filters."""
    qs = Reply.objects.select_related("instruction").defer("original_audio", "converted_audio")
    resolved = request.GET.get("resolved")
    if resolved in ("true", "false"):
        qs = qs.filter(is_resolved=resolved == "true")
    qs = qs.order_by("is_resolved", "-created_at")[:REPLY_LIMIT]
    return JsonResponse({"replies": [serializers.reply_to_dict(r) for r in qs]})


@api_view("POST")
def reply_resolve(request, pk: int):
    """Body {"resolved": false} reopens; empty body resolves."""
    data = parse_json(request)
    resolved = data.get("resolved", True)
    if not isinstance(resolved, bool):
        raise BadRequest("resolved must be true or false.", {"resolved": ["Must be true or false."]})
    reply = get_object_or_404(Reply.objects.select_related("instruction").defer("original_audio", "converted_audio"), pk=pk)
    reply.is_resolved = resolved
    reply.save(update_fields=["is_resolved"])
    return JsonResponse(serializers.reply_to_dict(reply))


@api_view("GET")
def reply_audio(request, pk: int):
    reply = get_object_or_404(Reply.objects.only("original_audio", "original_content_type"), pk=pk)
    return audio_response(request, reply.original_audio, reply.original_content_type)
