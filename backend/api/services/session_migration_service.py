from typing import Optional

from api.models import ChatSession, WeeklyScheduler

def migrate_guest_sessions_to_user(user_id:int, device_uuid:Optional[str]=None) -> int:
    """
    device_uuid로만 묶인 게스트 세션을 회원 user_id에 귀속하고 
    device_uuid로 등록된 채팅 기록들을 이전한다. 

    Returns:
        이전된 세션 수, 채팅 기록들 이전 
    """
    # device_uuid가 없으면 이전 불가 
    if not device_uuid:
        return 0

    return ChatSession.objects.filter(
        device_uuid=device_uuid,
        user_id__innull=True,
    ).update(user_id=user_id, is_converted=True)

def migrate_guest_routines_to_user(user_id:int, device_uuid:Optional[str]=None) -> int:
    """
    device_uuid로만 묶인 게스트 세션을 회원 user_id에 귀속하고 
    device_uuid로 등록된 운동 루틴을 이전한다. 

    Returns:
        이전된 운동 루틴 수 
    """
    if not device_uuid:
        return 0

    return WeeklyScheduler.objects.filter(
        device_uuid=device_uuid,
        user_id__isnull=True,
    ).update(user_id=user_id, is_converted=True)