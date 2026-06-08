import json
import datetime

from django.http import JsonResponse, StreamingHttpResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.db import transaction

from .models import Exercise, ChatSession, ChatMessage, WeeklyScheduler, DailyRoutine
from .services.actor_service import ActorError, resolve_actor, scheduler_filter_kwargs, scheduler_owner_filter, session_belongs_to_actor, session_owner_filter
from .services.chatbot.llm_gate import stream_bot_content
from .services.routine_recommender import review_recommendation, start_recommendation

DIFF_NUM = {'초급': 1, '중급': 2, '고급': 3}


# ─── Exercise ────────────────────────────────────────────────────────────────

class ExerciseListView(View):
    def get(self, request):
        qs = Exercise.objects.values(
            'exercise_id', 'name_kor', 'name_eng', 'category',
            'slug', 'tag', 'description', 'target_primary', 'target_secondary',
            'equipment', 'difficulty', 'difficulty_label', 'default_duration_min',
            'estimated_cal_per_min', 'place_type', 'home_friendly', 'spine_loading',
            'video_url', 'image_url', 'guide', 'starting_position', 'movement',
            'breathing', 'caution', 'related_exercises',
        )
        results = [
            {
                'id': ex['exercise_id'],
                'name_kor': ex['name_kor'],
                'name_eng': ex['name_eng'] or '',
                'category': ex['category'],
                'slug': ex['slug'] or '',
                'tag': ex['tag'] or '',
                'description': ex['description'] or '',
                'target_primary': ex['target_primary'],
                'target_secondary': ex['target_secondary'] or [],
                'equipment': ex['equipment'] or '',
                'difficulty': DIFF_NUM.get(ex['difficulty'], 1),
                'difficulty_label': ex['difficulty_label'] or '',
                'default_duration_min': ex['default_duration_min'],
                'estimated_cal_per_min': ex['estimated_cal_per_min'],
                'place_type': ex['place_type'] or '',
                'home_friendly': ex['home_friendly'] or '',
                'spine_loading': ex['spine_loading'] or '',
                'video_url': ex['video_url'] or '',
                'image_url': ex['image_url'] or '',
                'guide': ex['guide'],
                'starting_position': ex['starting_position'] or '',
                'movement': ex['movement'] or '',
                'breathing': ex['breathing'] or '',
                'caution': ex['caution'],
                'related_exercises': ex['related_exercises'] or '',
            }
            for ex in qs
        ]
        return JsonResponse(results, safe=False)


# ─── Chat Sessions ────────────────────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class SessionListView(View):
    def get(self, request):
        device_uuid = request.GET.get('device_uuid')
        try:
            actor = resolve_actor(request, device_uuid)
        except ActorError as exc:
            return JsonResponse({'error': str(exc)}, status=400)
        
        sessions = ChatSession.objects.filter(
            **session_owner_filter(actor)
        ).order_by('-created_at').values('session_id', 'title', 'created_at')

        return JsonResponse(list(sessions), safe=False)
    

    def post(self, request):
        data = json.loads(request.body)
        device_uuid = data.get('device_uuid')
        title = data.get('title', '새 상담')

        try:
            actor = resolve_actor(request, device_uuid)
        except ActorError as exc:
            return JsonResponse({'error': str(exc)}, status=400)
        
        create_kwargs = {'title':title}
        if actor.mode == 'user':
            create_kwargs['user_id'] = actor.user_id
        if actor.device_uuid:
            create_kwargs['device_uuid'] = actor.device_uuid

        session = ChatSession.objects.create(**create_kwargs)

        return JsonResponse(
            {'session_id': session.session_id, 'title': session.title}, 
            status=201
        )


@method_decorator(csrf_exempt, name='dispatch')
class SessionDetailView(View):
    def _get_session(self, session_id, actor):

        # 채팅 사용자에게 세션이 있으면 셋팅 없으면 None
        try:
            session = ChatSession.objects.get(session_id=session_id)
        except ChatSession.DoesNotExist:
            return None
        
        # 세션에 주인이 없어도 None
        if not session_belongs_to_actor(session, actor):
            return None
        
        # 세션 확인되면 확인된 세션 리턴 
        return session

    def patch(self, request, session_id):
        data = json.loads(request.body)
        try:
            actor = resolve_actor(request, data.get('device_uuid'))
        except ActorError as exc:
            return JsonResponse({'error': str(exc)}, status=400)
        
        session = self._get_session(session_id, actor)
        if not session:
            return JsonResponse({'error': 'not found'}, status=404)
        
        if 'title' in data:
            session.title = data['title']
            session.save()
        return JsonResponse({'session_id': session.session_id, 'title': session.title})

    def delete(self, request, session_id):
        data = json.loads(request.body)
        try:
            actor = resolve_actor(request, data.get('device_uuid'))
        except ActorError as exc:
            return JsonResponse({'error': str(exc)}, status=400)
        
        session = self._get_session(session_id, actor)
        if not session:
            return JsonResponse({'error': 'not found'}, status=404)
        
        session.delete()
        return JsonResponse({'ok': True})

# ─── Chat Messages ─────────────────────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class MessageListView(View):
    def get(self, request, session_id):

        # device_uuid로 사용자 확인, 없으면 400
        try:
            actor = resolve_actor(request, request.GET.get('device_uuid'))
        except ActorError as exc:
            return JsonResponse({'error': str(exc)}, status=400)

        # 세션 확인, 없으면 404 
        try:
            session = ChatSession.objects.get(session_id=session_id)
        except ChatSession.DoesNotExist:
            return JsonResponse({'error': 'not found'}, status=404)

        # 세션에 주인이 없어도 404 (핼퍼 함수로 찾음)
        if not session_belongs_to_actor(session, actor):
            return JsonResponse({'error': 'not found'}, status=404)

        messages = ChatMessage.objects.filter(session_id=session_id).order_by('created_at').values(
            'message_id', 'sender', 'content', 'created_at'
        )
        return JsonResponse(list(messages), safe=False)

    def post(self, request, session_id):
        data = json.loads(request.body)

        # device_uuid로 사용자 확인, 없으면 400
        try: 
            actor = resolve_actor(request, data.get('device_uuid'))
        except ActorError as exc:
            return JsonResponse({'error': str(exc)}, status=400)

        # 세션 확인, 없으면 404 
        try:
            session = ChatSession.objects.get(session_id=session_id)
        except ChatSession.DoesNotExist:
            return JsonResponse({'error': 'not found'}, status=404)

        # 세션에 주인이 없어도 404 (핼퍼 함수로 찾음)
        if not session_belongs_to_actor(session, actor):
            return JsonResponse({'error': 'not found'}, status=404)

        content = data.get('content', '').strip()
        if not content:
            return JsonResponse({'error': 'content required'}, status=400)

        # 사용자 메시지 먼저 저장 (스트리밍 시작 전)
        user_msg = ChatMessage.objects.create(
            session_id=session_id,
            sender='user',
            content=content,
        )

        def event_stream():
            full_answer = ""

            try:
                for token_type, token_content in stream_bot_content(request, content, session_id):
                    if token_type == "token":
                        # SSE 형식: data: {"type": "token", "content": "..."}\n\n
                        yield f"data: {json.dumps({'type': 'token', 'content': token_content}, ensure_ascii=False)}\n\n"
                    elif token_type == "done":
                        full_answer = token_content

            except Exception as exc:
                print(f'[streaming] 오류: {exc}')
                fallback = '답변을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
                full_answer = full_answer or fallback
                yield f"data: {json.dumps({'type': 'token', 'content': fallback}, ensure_ascii=False)}\n\n"

            # 봇 메시지 DB 저장 (스트리밍 완료 후)
            bot_msg = ChatMessage.objects.create(
                session_id=session_id,
                sender='bot',
                content=full_answer or '답변을 생성할 수 없습니다.',
            )

            # 완료 이벤트: 프론트엔드에 message_id 전달
            yield f"data: {json.dumps({'type': 'done', 'user_message_id': user_msg.message_id, 'bot_message_id': bot_msg.message_id}, ensure_ascii=False)}\n\n"

        response = StreamingHttpResponse(
            event_stream(),
            content_type='text/event-stream; charset=utf-8',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'  # nginx 버퍼링 방지
        return response


def get_date_for_dow(year, week_number, dow_kor):
    dow_map = {'월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7}
    day_num = dow_map.get(dow_kor, 1)
    return datetime.date.fromisocalendar(year, week_number, day_num)


@method_decorator(csrf_exempt, name='dispatch')
class RoutineView(View):
    def get(self, request):
        device_uuid = request.GET.get('device_uuid')

        try:
            actor = resolve_actor(request, device_uuid)
        except ActorError as exc:
            return JsonResponse({'error': str(exc)}, status=400)
        
        now = datetime.datetime.now()
        current_year, current_week, _ = now.isocalendar()

        year_str = request.GET.get('year')
        week_str = request.GET.get('week_number')

        target_year = int(year_str) if year_str else current_year
        target_week = int(week_str) if week_str else current_week

        scheduler = WeeklyScheduler.objects.filter(
            **scheduler_filter_kwargs(actor, target_year, target_week)
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
                    'video_url': r.exercise.video_url if r.exercise else '',
                    'image_url': r.exercise.image_url if r.exercise else '',
                    'caution': r.exercise.caution if r.exercise else '',
                    'spine_loading': r.exercise.spine_loading if r.exercise else '',
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
                **scheduler_owner_filter(actor)
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
        try:
            actor = resolve_actor(request, device_uuid)
        except ActorError as exc:
            return JsonResponse({'error': str(exc)}, status=400)

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
                **scheduler_filter_kwargs(actor, year, week_number)
            ).order_by('-created_at')
            
            created = False
            if schedulers.exists():
                scheduler = schedulers[0]
                # unique 보장을 위해 중복 제거 
                dup_filter = scheduler_filter_kwargs(actor, year, week_number)
                WeeklyScheduler.objects.filter(**dup_filter).exclude(scheduler_id=scheduler.scheduler_id).delete()
                
                scheduler.split_style = split_style
                scheduler.goal = goal
                scheduler.session_min = session_min
                scheduler.pain_parts = pain_parts
                scheduler.work_days = work_days_db
                scheduler.weekly_review = weekly_review
                
                # 로그인 된 상태인 경우 user_id를 저장
                if actor.mode == 'user':
                    scheduler.user_id = actor.user_id
                scheduler.save()
                    
            else:
                create_kwargs = dict(
                    year=year,
                    week_number=week_number,
                    split_style=split_style,
                    goal=goal,
                    session_min=session_min,
                    pain_parts=pain_parts,
                    work_days=work_days_db,
                    weekly_review=weekly_review
                )
                # 유저가 있으면 유저 id 추가 
                if actor.mode == 'user':
                    create_kwargs['user_id'] = actor.user_id
                # device_uuid가 있으면 추가 
                if actor.device_uuid:
                    create_kwargs['device_uuid'] = actor.device_uuid

                scheduler = WeeklyScheduler.objects.create(**create_kwargs)
                created = True
            
            DailyRoutine.objects.filter(scheduler=scheduler).delete()
            
            for day, exercises_list in workout_routine.items():
                scheduled_date = get_date_for_dow(year, week_number, day)
                daily_issue = daily_notes.get(day, "")
                
                for idx, ex in enumerate(exercises_list):
                    is_completed = ex.get('is_completed', False) or ex.get('completed', False)
                    exercise_id = ex.get('id') or ex.get('exercise_id')
                    if not exercise_id:
                        continue
                    
                    try:
                        ex_obj = Exercise.objects.get(exercise_id=exercise_id)
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


@method_decorator(csrf_exempt, name='dispatch')
class RoutineRecommendView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'ok': False, 'status': 'failed', 'message': 'Invalid JSON'}, status=400)

        try:
            actor = resolve_actor(request, data.get('device_uuid'))
        except ActorError as exc:
            return JsonResponse({'ok': False, 'status': 'failed', 'message': str(exc)}, status=400)

        graph_user_id = str(actor.user_id) if actor.mode == 'user' else str(actor.device_uuid)
        result = start_recommendation(data, user_id=graph_user_id)
        return JsonResponse(result, status=200 if result.get('ok') else 400)


@method_decorator(csrf_exempt, name='dispatch')
class RoutineRecommendReviewView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'ok': False, 'status': 'failed', 'message': 'Invalid JSON'}, status=400)

        try:
            resolve_actor(request, data.get('device_uuid'))
        except ActorError as exc:
            return JsonResponse({'ok': False, 'status': 'failed', 'message': str(exc)}, status=400)

        result = review_recommendation(
            thread_id=data.get('thread_id', ''),
            decision=data.get('decision', 'revise'),
            feedback=data.get('feedback', ''),
        )
        return JsonResponse(result, status=200 if result.get('ok') else 400)
