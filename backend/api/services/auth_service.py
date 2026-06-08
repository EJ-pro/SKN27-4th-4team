from django.contrib.auth.hashers import make_password, check_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from api.models import AppUser


# 유저 인증시 에러 클래스
class AuthError(ValueError):
    """인증/가입 검증 실패. 메시지를 그대로 API error로 반환한다."""


def _validate_register(nickname: str, email: str, password: str) -> None:
    nickname = (nickname or '').strip().lower()
    email = (email or '').strip().lower()

    if not nickname:
        raise AuthError("닉네임을 입력해주세요.")
    if len(nickname) < 3:
        raise AuthError("닉네임은 최소 3자 이상이어야 합니다.")
    if not email:
        raise AuthError("이메일을 입력해주세요.")
    if not password:
        raise AuthError("비밀번호를 입력해주세요.")

    try:
        validate_email(email)
    except ValidationError as exc:
        raise AuthError("입력한 이메일 양식이 올바르지 않습니다.") from exc

    if AppUser.objects.filter(nickname=nickname).exists():
        raise AuthError("이미 사용 중인 닉네임입니다.")
    if AppUser.objects.filter(email=email).exists():
        raise AuthError("이미 사용 중인 이메일입니다.")


def check_nickname_available(nickname: str) -> bool:
    """사용 가능한 닉네임인지 체크."""
    nickname = (nickname or '').strip().lower()
    if not nickname:
        raise AuthError("닉네임을 입력해주세요.")
    if len(nickname) < 3:
        raise AuthError("닉네임은 최소 3자 이상이어야 합니다.")
    return not AppUser.objects.filter(nickname=nickname).exists()


def check_email_available(email: str) -> bool:
    """
    사용 가능한 이메일인지 체크.
    - 이미 존재하는 이메일이면 False
    - 올바른 이메일 양식이 아니면 AuthError 발생
    - 사용 가능한 이메일이면 True
    """
    email = (email or '').strip().lower()
    if not email:
        raise AuthError("이메일을 입력해주세요.")
    try:
        validate_email(email)
    except ValidationError as exc:
        raise AuthError("입력한 이메일 양식이 올바르지 않습니다.") from exc
    return not AppUser.objects.filter(email=email).exists()


def create_user(nickname: str, email: str, password: str) -> AppUser:
    """회원가입. 성공시 AppUser 반환, 실패 시 AuthError 발생."""
    _validate_register(nickname, email, password)

    return AppUser.objects.create(
        nickname=nickname.strip().lower(),
        email=email.strip().lower(),
        password_hash=make_password(password),
    )


def authenticate_user(email: str, password: str) -> AppUser:
    """로그인 인증. 성공시 AppUser 반환, 실패 시 AuthError 발생."""
    email = (email or '').strip().lower()

    if not email:
        raise AuthError("이메일을 입력해주세요.")
    if not password:
        raise AuthError("비밀번호를 입력해주세요.")

    try:
        user = AppUser.objects.get(email=email)
    except AppUser.DoesNotExist:
        raise AuthError("등록되지 않은 이메일입니다.")

    if not check_password(password, user.password_hash):
        raise AuthError("비밀번호가 일치하지 않습니다.")

    return user


def issue_tokens_for_app_user(user: AppUser) -> dict:
    """앱 사용자에 대한 JWT 토큰 발급."""

    refresh = RefreshToken()
    refresh['user_id'] = user.user_id
    refresh['nickname'] = user.nickname

    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }


def bind_user_to_session(request, user: AppUser) -> None:
    """request 세션에 사용자 정보 및 JWT를 저장."""
    tokens = issue_tokens_for_app_user(user)
    request.session['user_id'] = user.user_id
    request.session['nickname'] = user.nickname
    request.session['access_token'] = tokens['access']
    request.session['refresh_token'] = tokens['refresh']
    request.session.save()


def clear_session(request) -> None:
    """로그아웃 시 세션 전체 삭제."""
    request.session.flush()


def get_session_user(request) -> AppUser | None:
    """세션의 user_id로 AppUser 조회. 없으면 None."""
    user_id = request.session.get('user_id')

    if not user_id:
        return None

    try:
        return AppUser.objects.get(user_id=user_id)
    except AppUser.DoesNotExist:
        return None


def validate_session_access_token(request) -> bool:
    """
    Django 세션에 저장된 access_token JWT가 유효한지 검사한다.

    - 토큰 없음 / 만료 / 서명 오류 → False
    - 유효 → True
    """
    raw = request.session.get('access_token')
    if not raw:
        return False
    try:
        AccessToken(raw)
    except (InvalidToken, TokenError):
        return False
    return True
