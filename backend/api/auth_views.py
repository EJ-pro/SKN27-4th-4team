import json

from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie

from api.services.auth_service import (
    AuthError, authenticate_user, bind_user_to_session, check_email_available,
    check_nickname_available, clear_session, create_user, get_session_user,
)

from api.services.session_migration_service import (
    migrate_guest_sessions_to_user,
    migrate_guest_routines_to_user,
)


def _parse_json(request) -> dict:
    try:
        # 요청 body가 byte로 반환되면 utf-8로 디코딩
        return json.loads(request.body.decode('utf-8'))

    # 디코딩 실패 시 내용 중 읽을 수 있는 error만 캐치한 다음 빈 dict 반환 
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfCookieView(View):
    """SPA가 CSRF 토큰 쿠키를 받기 위한 엔드포인트 """

    def get(self, request):
        # SPA(다른 포트)는 document.cookie로 csrftoken을 읽을 수 없어 body로도 내려준다.
        return JsonResponse({'ok': True, 'csrfToken': get_token(request)})

class CheckNicknameView(View):
    def get(self, request):
        nickname = request.GET.get("nickname", '')
        try:
            available = check_nickname_available(nickname)
        except AuthError as exc:
            return JsonResponse({'error': str(exc)}, status=400)
        return JsonResponse({'available': available})

class CheckEmailView(View):
    def get(self, request):
        email = request.GET.get("email", '')
        try:
            available = check_email_available(email)
        except AuthError as exc:
            return JsonResponse({'error': str(exc)}, status=400)
        return JsonResponse({'available': available})

class RegisterView(View):
    def post(self, request):
        data = _parse_json(request)

        try:
            user = create_user(
                nickname=data.get('nickname', ''),
                email=data.get('email', ''),
                password=data.get('password', ''),
            )

        except AuthError as exc:
            return JsonResponse({'error': str(exc)}, status=400)

        # 회원가입 성공 시 가입한 사용자 정보 반환 
        return JsonResponse({
            'user_id': user.user_id,
            'nickname': user.nickname,
            'email': user.email,
        }, status=201)


class LoginView(View):
    def post(self, request):
        data = _parse_json(request)
        try:
            # 사용자 인증해서 AppUser 객체 반환
            user = authenticate_user(
                email=data.get('email', ''),
                password=data.get('password', ''),
            )
            # 사용자 정보를 세션에 바인딩
            bind_user_to_session(request, user)

            # 게스트 채팅 세션 이전 (device_uuid optional)
            device_uuid = (data.get('device_uuid') or '').strip() or None
            migrated_sessions = migrate_guest_sessions_to_user(user.user_id, device_uuid)
            migrated_routines = migrate_guest_routines_to_user(user.user_id, device_uuid)

        # 인증 에러 발생 시 리턴 
        except AuthError as exc:
            return JsonResponse({'error': str(exc)}, status=401)

        return JsonResponse({
            'user_id': user.user_id,
            'nickname': user.nickname,
            'migrated_sessions': migrated_sessions,
            'migrated_routines': migrated_routines,
        })

class LogoutView(View):
    def post(self, request):
        clear_session(request)
        return JsonResponse({'ok': True})


# 로그인 사용자 조회 엔드포인트
class MeView(View):
    def get(self, request):
        # 서비스 함수를 통해서 사용자를 특정함 
        user = get_session_user(request)

        # 인증된 사용자가 아니면 
        if not user:
            return JsonResponse({'error': '로그인이 필요합니다.'}, status=401)

        return JsonResponse({
            'user_id': user.user_id,
            'nickname': user.nickname,
            'email': user.email,
        })