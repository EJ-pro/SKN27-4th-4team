from typing import Any, Literal, TypedDict


Action = Literal[
    "CALL_USER_PROFILE_TOOL",
    "REQUEST_REQUIRED_INFO",
    "CALL_RECOMMENDATION_PARAM_AGENT",
    "CALL_GRAPH_SEARCH_TOOL",
    "CALL_COMPOSITION_AGENT",
    "CALL_VALIDATION_AGENT",
    "REQUEST_FINAL_HUMAN_REVIEW",
    "CALL_REVISION_AGENT",
    "CALL_FINAL_RESPONSE_GENERATOR",
    "END",
]


ALLOWED_ACTIONS: set[str] = {
    "CALL_USER_PROFILE_TOOL",
    "REQUEST_REQUIRED_INFO",
    "CALL_RECOMMENDATION_PARAM_AGENT",
    "CALL_GRAPH_SEARCH_TOOL",
    "CALL_COMPOSITION_AGENT",
    "CALL_VALIDATION_AGENT",
    "REQUEST_FINAL_HUMAN_REVIEW",
    "CALL_REVISION_AGENT",
    "CALL_FINAL_RESPONSE_GENERATOR",
    "END",
}


class RecommendationState(TypedDict, total=False):
    user_id: str | None
    user_message: str
    user_profile: dict[str, Any]
    workout_history: list[dict[str, Any]]
    missing_fields: list[str]
    human_answers: dict[str, Any]
    recommendation_params: dict[str, Any]
    exercise_candidates: dict[str, list[dict[str, Any]]]
    insufficient_targets: list[str]
    routine_draft: dict[str, Any] | None
    validation_result: dict[str, Any] | None
    human_review_result: dict[str, Any] | None
    revision_request: dict[str, Any] | None
    final_response: str | None
    next_action: str
    action_reason: str
    action_history: list[str]
    errors: list[str]


DEFAULT_PROFILE: dict[str, Any] = {
    "age": None,
    "gender": None,
    "level": None,
    "goal": None,
    "available_days": 5,
    "available_equipment": [],
    "injuries": [],
    "pain_points": [],
    "preferences": [],
    "disliked_exercises": [],
    "home_only": False,
    "spine": "all",
}


def initial_state(user_message: str, user_id: str | None = None) -> RecommendationState:
    return {
        "user_id": user_id,
        "user_message": user_message,
        "user_profile": {},
        "workout_history": [],
        "missing_fields": [],
        "human_answers": {},
        "recommendation_params": {},
        "exercise_candidates": {},
        "insufficient_targets": [],
        "routine_draft": None,
        "validation_result": None,
        "human_review_result": None,
        "revision_request": None,
        "final_response": None,
        "next_action": "CALL_USER_PROFILE_TOOL",
        "action_reason": "",
        "action_history": [],
        "errors": [],
    }

