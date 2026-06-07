from typing import Any, Literal, TypedDict

from .config import settings


Action = Literal[
    "CALL_USER_PROFILE_TOOL",
    "CALL_RECOMMENDATION_PARAM_AGENT",
    "CALL_GRAPH_SEARCH_TOOL",
    "CALL_COMPOSITION_AGENT",
    "CALL_VALIDATION_AGENT",
    "REQUEST_FINAL_HUMAN_REVIEW",
    "CALL_REVISION_AGENT",
    "END",
]


ALLOWED_ACTIONS: set[str] = {
    "CALL_USER_PROFILE_TOOL",
    "CALL_RECOMMENDATION_PARAM_AGENT",
    "CALL_GRAPH_SEARCH_TOOL",
    "CALL_COMPOSITION_AGENT",
    "CALL_VALIDATION_AGENT",
    "REQUEST_FINAL_HUMAN_REVIEW",
    "CALL_REVISION_AGENT",
    "END",
}


class RecommendationState(TypedDict, total=False):
    user_id: str | None
    user_profile: dict[str, Any]
    profile_normalized: bool
    workout_history: list[dict[str, Any]]
    recommendation_params: dict[str, Any]
    exercise_candidates: dict[str, list[dict[str, Any]]]
    insufficient_targets: list[str]
    routine_draft: dict[str, Any] | None
    previous_routine_draft: dict[str, Any] | None
    validation_result: dict[str, Any] | None
    human_review_result: dict[str, Any] | None
    revision_request: dict[str, Any] | None
    revision_constraints: dict[str, Any] | None
    revision_excluded_exercises: list[str]
    final_response: str | None
    next_action: str
    action_reason: str
    action_history: list[str]
    supervisor_step_count: int
    max_supervisor_steps: int
    errors: list[str]


def initial_state(
    user_id: str | None = None,
    user_profile: dict[str, Any] | None = None,
    workout_history: list[dict[str, Any]] | None = None,
) -> RecommendationState:
    return {
        "user_id": user_id,
        "user_profile": user_profile or {},
        "profile_normalized": False,
        "workout_history": workout_history or [],
        "recommendation_params": {},
        "exercise_candidates": {},
        "insufficient_targets": [],
        "routine_draft": None,
        "previous_routine_draft": None,
        "validation_result": None,
        "human_review_result": None,
        "revision_request": None,
        "revision_constraints": None,
        "revision_excluded_exercises": [],
        "final_response": None,
        "next_action": "CALL_USER_PROFILE_TOOL",
        "action_reason": "",
        "action_history": [],
        "supervisor_step_count": 0,
        "max_supervisor_steps": settings.max_supervisor_steps,
        "errors": [],
    }

