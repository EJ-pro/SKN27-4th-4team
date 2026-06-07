"""
런타임 LLM 호출 전 JWT 게이트.

- should_run_llm: env 토글 + JWT 검사 (다른 LLM API에서도 재사용)
- generate_bot_content: 챗봇 MessageListView.post 전용
"""
from django.http import HttpRequest

from api.services.auth_service import validate_session_access_token
from .constants import CHATBOT_REQUIRE_AUTH, AUTH_REQUIRED_MESSAGE, LLM_ERROR_MESSAGE
from .chatbot import get_answer


def should_run_llm(request: HttpRequest) -> bool:
    """
    LLM 실행 허용 여부.

    CHATBOT_REQUIRE_AUTH=False → 검사 없이 True (즉시 통과).
    CHATBOT_REQUIRE_AUTH=True  → validate_session_access_token 결과.
    """
    # 환경변수가 False면 검사 없이 통과 
    if not CHATBOT_REQUIRE_AUTH:
        return True

    # 세션 토큰 검사 
    return validate_session_access_token(request)


def generate_bot_content(request: HttpRequest, user_content:str, session_id:int) -> str:
    """
    게이트 통과 시 get_answer(), 차단·오류 시 constants 안내 문구.
    get_answer 예외는 여기서 처리 (뷰 try/except 중복 제거).
    """
    if not should_run_llm(request):
        print('[llm_gate] LLM blocked: auth required (CHATBOT_REQUIRE_AUTH=True)')
        return AUTH_REQUIRED_MESSAGE

    try:
        return get_answer(user_content, session_id)
    except Exception as exc:
        print(f'[chatbot] answer generation failed: {exc}')
        return LLM_ERROR_MESSAGE