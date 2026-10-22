"""Patient endpoints: no login, the unguessable token is the credential.

Unknown and expired tokens look the same (404), and every object is checked against the token.
"""

from django.http import Http404, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie

from instructions.api import serializers
from instructions.api.http import api_view, audio_response, json_error
from instructions.models import Instruction, InstructionItem, Language
from instructions.services import labels as label_service, replies


def _live_instruction(token: str) -> Instruction:
    instruction = Instruction.objects.filter(token=token).first()
    if instruction is None or instruction.is_expired:
        raise Http404
    return instruction


@ensure_csrf_cookie  # the reply POST needs the CSRF cookie; patients never call /api/auth/csrf/
@api_view("GET", staff=False)
def instruction(request, token: str):
    try:
        instr = _live_instruction(token)
    except Http404:
        # Labels let the screen say "this link has expired" in Swahili, not English.
        return JsonResponse(
            {
                "error": "This link has expired or does not exist.",
                "labels": label_service.get_labels(Language.SWAHILI),
                "mock_mode": serializers.mock_mode(),  # the banner shows on this screen too
            },
            status=404,
        )
    return JsonResponse(serializers.patient_instruction_to_dict(instr, label_service.get_labels(instr.language)))


@api_view("GET", staff=False)
def item_audio(request, token: str, item_id: int):
    instr = _live_instruction(token)
    item = InstructionItem.objects.select_related("audio").filter(pk=item_id, instruction=instr).first()
    if item is None or item.audio is None:
        raise Http404
    return audio_response(request, item.audio.data, item.audio.content_type)


@api_view("POST", staff=False)
def reply(request, token: str):
    instr = _live_instruction(token)
    consent = request.POST.get("consent", "").lower() in {"true", "1", "on", "yes"}
    try:
        created = replies.submit_reply(instr, request.FILES.get("audio_file"), consent)
    except replies.ReplyRejected as exc:
        # `code` lets the patient screen pick a translated message instead of showing English.
        return json_error(exc.message, exc.status, extra={"code": exc.code})
    # A failed translation still returns 201: the clinic has the recording and staff can listen.
    return JsonResponse({"status": created.status}, status=201)
