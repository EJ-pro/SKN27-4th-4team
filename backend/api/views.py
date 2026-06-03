import json
from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import Exercise, ChatSession, ChatMessage

DIFF_NUM = {'초급': 1, '중급': 2, '고급': 3}


# ─── Exercise ────────────────────────────────────────────────────────────────

class ExerciseListView(View):
    def get(self, request):
        qs = Exercise.objects.values(
            'exercise_id', 'name_kor', 'name_eng', 'category',
            'target_primary', 'target_secondary', 'equipment',
            'difficulty', 'guide', 'caution',
        )
        results = [
            {
                'id': ex['exercise_id'],
                'name_kor': ex['name_kor'],
                'name_eng': ex['name_eng'] or '',
                'category': ex['category'],
                'target_primary': ex['target_primary'],
                'target_secondary': ex['target_secondary'],
                'equipment': ex['equipment'] or '',
                'difficulty': DIFF_NUM.get(ex['difficulty'], 1),
                'guide': ex['guide'],
                'caution': ex['caution'],
            }
            for ex in qs
        ]
        return JsonResponse(results, safe=False)


# ─── Chat Sessions ────────────────────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class SessionListView(View):
    def get(self, request):
        uuid = request.GET.get('device_uuid')
        if not uuid:
            return JsonResponse({'error': 'device_uuid required'}, status=400)
        sessions = ChatSession.objects.filter(device_uuid=uuid).order_by('-created_at').values(
            'session_id', 'title', 'created_at'
        )
        return JsonResponse(list(sessions), safe=False)

    def post(self, request):
        data = json.loads(request.body)
        uuid = data.get('device_uuid')
        title = data.get('title', '새 상담')
        if not uuid:
            return JsonResponse({'error': 'device_uuid required'}, status=400)
        session = ChatSession.objects.create(device_uuid=uuid, title=title)
        return JsonResponse({'session_id': session.session_id, 'title': session.title}, status=201)


@method_decorator(csrf_exempt, name='dispatch')
class SessionDetailView(View):
    def _get_session(self, session_id, uuid):
        try:
            return ChatSession.objects.get(session_id=session_id, device_uuid=uuid)
        except ChatSession.DoesNotExist:
            return None

    def patch(self, request, session_id):
        data = json.loads(request.body)
        uuid = data.get('device_uuid')
        session = self._get_session(session_id, uuid)
        if not session:
            return JsonResponse({'error': 'not found'}, status=404)
        if 'title' in data:
            session.title = data['title']
            session.save(update_fields=['title'])
        return JsonResponse({'session_id': session.session_id, 'title': session.title})

    def delete(self, request, session_id):
        data = json.loads(request.body)
        uuid = data.get('device_uuid')
        session = self._get_session(session_id, uuid)
        if not session:
            return JsonResponse({'error': 'not found'}, status=404)
        session.delete()
        return JsonResponse({'ok': True})


# ─── Chat Messages ─────────────────────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class MessageListView(View):
    def get(self, request, session_id):
        uuid = request.GET.get('device_uuid')
        if not ChatSession.objects.filter(session_id=session_id, device_uuid=uuid).exists():
            return JsonResponse({'error': 'not found'}, status=404)
        messages = ChatMessage.objects.filter(session_id=session_id).order_by('created_at').values(
            'message_id', 'sender', 'content', 'created_at'
        )
        return JsonResponse(list(messages), safe=False)

    def post(self, request, session_id):
        data = json.loads(request.body)
        uuid = data.get('device_uuid')
        if not ChatSession.objects.filter(session_id=session_id, device_uuid=uuid).exists():
            return JsonResponse({'error': 'not found'}, status=404)
        msg = ChatMessage.objects.create(
            session_id=session_id,
            sender=data.get('sender', 'user'),
            content=data.get('content', ''),
        )
        return JsonResponse({
            'message_id': msg.message_id,
            'sender': msg.sender,
            'content': msg.content,
            'created_at': msg.created_at.isoformat(),
        }, status=201)
