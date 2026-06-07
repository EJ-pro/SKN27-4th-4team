from typing import Optional

from api.models import ChatSession, WeeklyScheduler

def migrate_guest_sessions_to_user(user_id:int, device_uuid:Optional[str]=None) -> int:
    """
    device_uuid로만 묶인 게스트 채팅 세션을 회원 user_id에 귀속한다.
    chat_messages는 session_id FK로 자동 연동 — 별도 이전 없음.

    Returns:
        이전된 chat_sessions 행 수
    """
    # device_uuid가 없으면 이전 불가 
    if not device_uuid:
        return 0

    return ChatSession.objects.filter(
        device_uuid=device_uuid,
        user_id__isnull=True,
    ).update(user_id=user_id, is_converted=True)

def migrate_guest_routines_to_user(user_id:int, device_uuid:Optional[str]=None) -> int:
    """
    device_uuid로만 묶인 게스트 루틴(weekly_schedulers)을 회원 user_id에 귀속한다.

    Returns:
        이전된 weekly_schedulers 행 수
    """
    if not device_uuid:
        return 0

    return WeeklyScheduler.objects.filter(
        device_uuid=device_uuid,
        user_id__isnull=True,
    ).update(user_id=user_id)