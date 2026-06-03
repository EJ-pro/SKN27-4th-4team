import json
import datetime
from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.db import transaction
from .models import Exercise, ChatSession, ChatMessage, WeeklyScheduler, DailyRoutine

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


def get_date_for_dow(year, week_number, dow_kor):
    dow_map = {'월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7}
    day_num = dow_map.get(dow_kor, 1)
    return datetime.date.fromisocalendar(year, week_number, day_num)


@method_decorator(csrf_exempt, name='dispatch')
class RoutineView(View):
    def get(self, request):
        device_uuid = request.GET.get('device_uuid')
        if not device_uuid:
            return JsonResponse({'error': 'device_uuid is required'}, status=400)
        
        now = datetime.datetime.now()
        current_year, current_week, _ = now.isocalendar()
        
        year_str = request.GET.get('year')
        week_str = request.GET.get('week_number')
        
        target_year = int(year_str) if year_str else current_year
        target_week = int(week_str) if week_str else current_week
        
        scheduler = WeeklyScheduler.objects.filter(
            device_uuid=device_uuid,
            year=target_year,
            week_number=target_week
        ).order_by('-created_at').first()
        
        if scheduler:
            routines_qs = DailyRoutine.objects.filter(scheduler=scheduler).order_by('scheduled_date', 'routine_order')
            
            workout_routine = {}
            daily_notes = {}
            
            work_days_data = scheduler.work_days or {}
            work_days = []
            day_parts = {}
            
            if isinstance(work_days_data, list):
                work_days = work_days_data
            elif isinstance(work_days_data, dict):
                work_days = work_days_data.get('days', [])
                day_parts = work_days_data.get('day_parts', {})
                
            for day in work_days:
                workout_routine[day] = []
                
            for r in routines_qs:
                day = r.day_of_week
                if day not in workout_routine:
                    workout_routine[day] = []
                
                ex_data = {
                    'id': r.exercise.exercise_id if r.exercise else None,
                    'name': r.exercise.name_kor if r.exercise else '',
                    'sets': r.target_sets,
                    'reps': r.target_reps,
                    'recommended_sets': r.recommended_sets,
                    'recommended_reps': r.recommended_reps,
                    'eq': r.exercise.equipment if r.exercise else 'body',
                    'detail': r.exercise.guide if r.exercise else '',
                    'category': r.exercise.category if r.exercise else '',
                    'is_completed': r.is_completed
                }
                workout_routine[day].append(ex_data)
                if r.daily_issue:
                    daily_notes[day] = r.daily_issue
            
            return JsonResponse({
                'found': True,
                'scheduler_id': scheduler.scheduler_id,
                'split_style': scheduler.split_style,
                'goal': scheduler.goal,
                'session_min': scheduler.session_min,
                'pain_parts': scheduler.pain_parts or [],
                'work_days': work_days,
                'day_parts': day_parts,
                'workout_routine': workout_routine,
                'daily_notes': daily_notes
            })
            
        else:
            latest_scheduler = WeeklyScheduler.objects.filter(
                device_uuid=device_uuid
            ).order_by('-created_at').first()
            
            preferences = None
            if latest_scheduler:
                work_days_data = latest_scheduler.work_days or {}
                work_days = []
                day_parts = {}
                if isinstance(work_days_data, list):
                    work_days = work_days_data
                elif isinstance(work_days_data, dict):
                    work_days = work_days_data.get('days', [])
                    day_parts = work_days_data.get('day_parts', {})
                    
                preferences = {
                    'split_style': latest_scheduler.split_style,
                    'goal': latest_scheduler.goal,
                    'session_min': latest_scheduler.session_min,
                    'pain_parts': latest_scheduler.pain_parts or [],
                    'work_days': work_days,
                    'day_parts': day_parts
                }
                
            return JsonResponse({
                'found': False,
                'preferences': preferences
            })

    def post(self, request):
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
            
        device_uuid = data.get('device_uuid')
        if not device_uuid:
            return JsonResponse({'error': 'device_uuid is required'}, status=400)
            
        year = data.get('year')
        week_number = data.get('week_number')
        
        if not year or not week_number:
            now = datetime.datetime.now()
            current_year, current_week, _ = now.isocalendar()
            year = year or current_year
            week_number = week_number or current_week
            
        split_style = data.get('split_style')
        goal = data.get('goal')
        session_min = data.get('session_min')
        pain_parts = data.get('pain_parts', [])
        work_days = data.get('work_days', [])
        day_parts = data.get('day_parts', {})
        workout_routine = data.get('workout_routine', {})
        daily_notes = data.get('daily_notes', {})
        weekly_review = data.get('weekly_review', '')
        
        work_days_db = {
            'days': work_days,
            'day_parts': day_parts
        }
        
        with transaction.atomic():
            schedulers = WeeklyScheduler.objects.filter(
                device_uuid=device_uuid,
                year=year,
                week_number=week_number
            ).order_by('-created_at')
            
            created = False
            if schedulers.exists():
                scheduler = schedulers[0]
                if len(schedulers) > 1:
                    WeeklyScheduler.objects.filter(
                        device_uuid=device_uuid,
                        year=year,
                        week_number=week_number
                    ).exclude(scheduler_id=scheduler.scheduler_id).delete()
                
                scheduler.split_style = split_style
                scheduler.goal = goal
                scheduler.session_min = session_min
                scheduler.pain_parts = pain_parts
                scheduler.work_days = work_days_db
                scheduler.weekly_review = weekly_review
                scheduler.save()
            else:
                scheduler = WeeklyScheduler.objects.create(
                    device_uuid=device_uuid,
                    year=year,
                    week_number=week_number,
                    split_style=split_style,
                    goal=goal,
                    session_min=session_min,
                    pain_parts=pain_parts,
                    work_days=work_days_db,
                    weekly_review=weekly_review
                )
                created = True
            
            DailyRoutine.objects.filter(scheduler=scheduler).delete()
            
            for day, exercises_list in workout_routine.items():
                scheduled_date = get_date_for_dow(year, week_number, day)
                daily_issue = daily_notes.get(day, "")
                
                for idx, ex in enumerate(exercises_list):
                    is_completed = ex.get('is_completed', False) or ex.get('completed', False)
                    
                    try:
                        ex_obj = Exercise.objects.get(exercise_id=ex['id'])
                    except Exercise.DoesNotExist:
                        continue
                        
                    DailyRoutine.objects.create(
                        scheduler=scheduler,
                        exercise=ex_obj,
                        scheduled_date=scheduled_date,
                        routine_order=float(idx + 1),
                        recommended_sets=int(ex.get('recommended_sets') or ex.get('sets') or 4),
                        recommended_reps=int(ex.get('recommended_reps') or ex.get('reps') or 10),
                        target_sets=int(ex.get('sets') or 4),
                        target_reps=int(ex.get('reps') or 10),
                        is_completed=is_completed,
                        daily_issue=daily_issue,
                        is_custom_added=False
                    )
                
        return JsonResponse({
            'ok': True,
            'scheduler_id': scheduler.scheduler_id,
            'created': created
        }, status=201 if created else 200)
