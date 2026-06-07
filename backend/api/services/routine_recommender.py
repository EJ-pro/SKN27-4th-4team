import sys
from pathlib import Path
from uuid import uuid4

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.errors import GraphRecursionError
from langgraph.types import Command


ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
QUERY_DIR = Path("/workspace")
if QUERY_DIR.exists() and str(QUERY_DIR) not in sys.path:
    sys.path.insert(0, str(QUERY_DIR))

from recommendation_service.config import settings
from recommendation_service.state import initial_state
from recommendation_service.survey_scenarios import survey_to_user_profile
from recommendation_service.workflow import build_recommendation_graph


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
    user_profile = survey_to_user_profile(survey)
    if not user_profile.get("split_targets"):
        return {
            "ok": False,
            "thread_id": thread_id,
            "status": "failed",
            "message": "요일별 운동 부위를 추천 대상 부위로 변환하지 못했습니다.",
        }
    return _invoke_graph(
        initial_state(user_id=user_id, user_profile=user_profile),
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
    return _invoke_graph(Command(resume=review), _graph_config(thread_id), thread_id)


def _graph_config(thread_id: str) -> dict:
    return {
        "recursion_limit": max(80, settings.max_supervisor_steps * 3 + 10),
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
        if value is None or value == "" or value == [] or value == {}:
            missing.append(field)
    return missing
