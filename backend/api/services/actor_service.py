from dataclasses import dataclass
from typing import Optional

from django.http import HttpRequest

from api.services.auth_service import get_session_user
from api.models import ChatSession


@dataclass(frozen=True)
class Actor:
    mode: str  # 'user' | 'guest'
    user_id: Optional[int] = None
    device_uuid: Optional[str] = None


class ActorError(ValueError):
    """ 식별자 해석 실패. 메시를 API error로 반환해준다. """


def resolve_actor(request: HttpRequest, device_uuid: Optional[str] = None) -> Actor:
    """ request의 Django session과 device_uuid를 가지고 현재 사용자를 특정한다. 

    - 로그인: mode='user', user_id=세션값 (device_uuid는 마이그레이션·추적용으로만 허용)
    - 게스트: mode='guest', device_uuid 필수
    """
    # 사용자 정보 지정 / device_uuid 확보 
    user = get_session_user(request)
    device_uuid = (device_uuid or '').strip() or None

    # 사용자가 있을 떄만 반환 처리 
    if user:
        return Actor(
            mode='user',
            user_id=user.user_id,
            device_uuid=device_uuid,
        )
    
    if not device_uuid:
        raise ActorError('device_uuid is required')
    
    # 사용자가 아님 (로그인 안함) 이면서 device_uuid가 없으면 게스트 id 생성
    return Actor(
        mode='guest',
        device_uuid=device_uuid,
    )

def scheduler_filter_kwargs(actor:Actor, year:int, week_number:int) -> dict:
    """ 주간 스케줄러 조회 조건 생성 함수 """
    base = {'year': year, 'week_number': week_number}

    if actor.mode == 'user':
        return {**base, 'user_id':actor.user_id}
    return {**base, 'device_uuid':actor.device_uuid}


def scheduler_owner_filter(actor: Actor) -> dict:
    if actor.mode == 'user':
        return {'user_id':actor.user_id}
    return {'device_uuid':actor.device_uuid}


def session_owner_filter(actor:Actor) -> dict:
    """
    ChatSession 목록/소유권 검증 함수 
    유저가 있으면 유저id로 설정하고 아니면 device_uuid 사용한다. 
    """
    if actor.mode == 'user':
        return {'user_id':actor.user_id}
    return {'device_uuid':actor.device_uuid}


def session_belongs_to_actor(session: ChatSession, actor: Actor) -> bool:
    """채팅 세션이 현재 사용자(actor)에 속하는지 확인."""
    if actor.mode == 'user':
        return session.user_id == actor.user_id
    return str(session.device_uuid) == str(actor.device_uuid)
    
