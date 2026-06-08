import sys
from pathlib import Path
from uuid import uuid4

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.errors import GraphRecursionError
from langgraph.types import Command


BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_GRAPH = None
_SETTINGS = None
_INITIAL_STATE = None
_SURVEY_TO_USER_PROFILE = None


def _load_recommendation_service():
    global _GRAPH, _SETTINGS, _INITIAL_STATE, _SURVEY_TO_USER_PROFILE
    if _GRAPH is not None:
        return

    from recommendation_service.config import settings
    from recommendation_service.state import initial_state
    from recommendation_service.survey_scenarios import survey_to_user_profile
    from recommendation_service.workflow import build_recommendation_graph

    _SETTINGS = settings
    _INITIAL_STATE = initial_state
    _SURVEY_TO_USER_PROFILE = survey_to_user_profile
    _GRAPH = build_recommendation_graph(checkpointer=InMemorySaver())


def start_recommendation(survey: dict, user_id: str | None = None) -> dict:
    missing = _missing_required_fields(survey)
    if missing:
        return {
            "ok": False,
            "status": "failed",
            "message": "필수 설문 항목이 비어 있어 추천을 시작하지 않았습니다.",
            "missing_fields": missing,
        }
    if str(survey.get("place") or "").strip().lower() != "gym":
        return {
            "ok": False,
            "status": "failed",
            "message": "현재 추천 서비스는 체육관 운동만 지원합니다.",
        }

    thread_id = str(uuid4())
    _load_recommendation_service()
    try:
        user_profile = _SURVEY_TO_USER_PROFILE(survey)
    except Exception as exc:
        return {
            "ok": False,
            "thread_id": thread_id,
            "status": "failed",
            "message": "설문 입력값을 추천 프로필로 변환하지 못했습니다.",
            "error": str(exc),
        }
    if not user_profile.get("split_targets"):
        return {
            "ok": False,
            "thread_id": thread_id,
            "status": "failed",
            "message": "요일별 운동 부위를 추천 대상 부위로 변환하지 못했습니다.",
        }
    return _invoke_graph(
        _INITIAL_STATE(user_id=user_id, user_profile=user_profile),
        _graph_config(thread_id),
        thread_id,
    )


def review_recommendation(thread_id: str, decision: str, feedback: str = "") -> dict:
    if not thread_id:
        return {
            "ok": False,
            "status": "failed",
            "message": "thread_id가 없어 이전 추천 검토를 이어갈 수 없습니다.",
        }

    normalized = str(decision or "").strip().lower()
    review = {
        "decision": "approve" if normalized in {"approve", "accept"} else "revise",
        "feedback": feedback or "",
    }
    _load_recommendation_service()
    return _invoke_graph(Command(resume=review), _graph_config(thread_id), thread_id)


def _graph_config(thread_id: str) -> dict:
    return {
        "recursion_limit": max(80, _SETTINGS.max_supervisor_steps * 3 + 10),
        "configurable": {"thread_id": thread_id},
    }


def _invoke_graph(payload, config: dict, thread_id: str) -> dict:
    try:
        result = _GRAPH.invoke(payload, config)
    except GraphRecursionError:
        return {
            "ok": False,
            "thread_id": thread_id,
            "status": "failed",
            "message": "추천 루프가 최대 단계 수에 도달해 안전하게 중단했습니다.",
        }
    except Exception as exc:
        return {
            "ok": False,
            "thread_id": thread_id,
            "status": "failed",
            "message": str(exc),
        }

    if "__interrupt__" in result:
        interrupt = result["__interrupt__"][0].value
        return {
            "ok": True,
            "thread_id": thread_id,
            "status": "needs_review",
            "message": interrupt.get("message", ""),
            "routine_draft": interrupt.get("routine_draft"),
            "validation_result": interrupt.get("validation_result"),
        }

    state_values = _state_values(config)
    routine_draft = result.get("routine_draft") or state_values.get("routine_draft")
    validation_result = result.get("validation_result") or state_values.get("validation_result")
    return {
        "ok": True,
        "thread_id": thread_id,
        "status": "completed",
        "routine_draft": routine_draft,
        "validation_result": validation_result,
    }


def _state_values(config: dict) -> dict:
    try:
        snapshot = _GRAPH.get_state(config)
        return snapshot.values or {}
    except Exception:
        return {}


def _missing_required_fields(survey: dict) -> list[str]:
    required = [
        "age",
        "gender",
        "level",
        "place",
        "available_equipment",
        "pain_parts",
        "split_style",
        "work_days",
        "day_parts",
        "goal",
        "session_min",
    ]
    missing = []
    for field in required:
        value = survey.get(field)
        if field == "pain_parts" and value == []:
            continue
        if value is None or value == "" or value == [] or value == {}:
            missing.append(field)
    return missing

def verify_thread_belongs_to_owner(thread_id: str, owner_key: str) -> bool:
    if not thread_id or not owner_key:
        return False

    _load_recommendation_service()
    state = _state_values(_graph_config(thread_id))
    state_user_id = state.get("user_id")
    if state_user_id is None:
        return False
    
    return str(state_user_id) == str(owner_key)
