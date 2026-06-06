from django.contrib.auth.hashers import make_password, check_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from rest_framework_simplejwt.tokens import RefreshToken

from api.models import AppUser



# 유저 인증시 에러 클래스 
class AuthError(ValueError):
    """인증/가입 검증 실패. 메시지를 그대로 API error로 반환한다."""


def _validate_register(nickname:str, email:str, password:str) -> None:
    nickname = (nickname or '').strip()
    email = (email or '').strip()

    # 사용자 입력정보 검증 로직
    if len(nickname) < 4:
        raise AuthError("닉네임은 최소 4자 이상이어야 합니다.")
    if not password:
        raise AuthError("비밀번호를 입력해주세요.")
    if AppUser.objects.filter(nickname=nickname).exisits():
        raise AuthError("이미 존재하는 아이디입니다.")
    if AppUser.objects.filter(email=email).exists():
        raise AuthError("이미 존재하는 이메일입니다.")

    # 입력된 이메일 포멧 검사 
    try:
        validate_email(email)
    except ValidationError as exc:
        raise AuthError("입력한 이메일 양식이 올바르지 않습니다.") from exc

# 회원가입
def create_user(nickname:str, email:str, password:str) -> AppUser:
    """회원가입. 성공시 AppUser 반환, 실패 시 AuthError 발생"""
    _validate_register(nickname, email, password)

    return AppUser.objects.create(
        nickname=nickname.strip(),
        email=email.strip().lower(),
        password_hash=make_password(password),
    )

# 로그인 인증 -> 성공시 AppUser 반환, 실패시 AuthError 발생
def authenticate_user(nickname:str, password:str) -> AppUser:
    """로그인 인증. 성공시 AppUser 반환, 실패 시 AuthError 발생"""
    nickname = (nickname or '').strip()

    # 아이디 패스워드 입력 확인 
    if not nickname:
        raise AuthError("아이디를 입력해주세요.")
    elif not password:
        raise AuthError("비밀번호를 입력해주세요.")

    # 아이디 존재 확인 
    try:
        user = AppUser.objects.get(nickname=nickname)
    except AppUser.DoesNotExist:
        raise AuthError("아이디가 존재하지 않습니다.")
    
    # 비밀번호 검증 
    if not check_password(password, user.password_hash):
        raise AuthError("비밀번호가 일치하지 않습니다.")

    # 모든 검증 통과하면 로그인 객체 반환 
    return user

# 로그인에 성공한 AppUser에게 JWT access/refresh 토큰 쌍을 만들어 주는 함수
def issue_tokens_for_app_user(user:AppUser) -> dict:
    """앱 사용자에 대한 JWT 토큰 발급. 성공시 access/refresh 토큰 dict 반환, 실패시 AuthError 발생"""

    refresh = RefreshToken()
    refresh['user_id'] = user.user_id
    refresh['nickname'] = user.nickname

    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }


def bind_user_to_session(request, user:AppUser) -> None:
    """request가 가지고 있는 세션에 사용자 정보 및 JWT를 같이 저장"""
    tokens = issue_tokens_for_app_user(user)
    request.session['user_id'] = user.user_id
    request.session['nickname'] = user.nickname
    request.session['access_token'] = tokens['access']
    request.session['refresh_token'] = tokens['refresh']
    request.session.save()


def clear_session(request)-> None:
    """로그아웃 시 세션 전체 삭제 & JWT도 같이 제거"""
    request.session.flush()


def get_session_user(request) -> AppUser:
    """세션의 user_id를 통해 AppUser 조회. 없거나 인증되지 않은 유저면 None."""
    user_id = request.session.get('user_id')

    # 존재하지 않는 유저면 None
    if not user_id:
        return None

    try:
        return AppUser.objects.get(user_id=user_id)
    except AppUser.DoesNotExist:
        return None



