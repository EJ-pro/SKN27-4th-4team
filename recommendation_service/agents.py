from typing import Any

from langgraph.types import interrupt

from .graph_tools import (
    SPLIT_TARGETS,
    normalize_equipment,
    normalize_level,
    normalize_spine,
    normalize_split_targets,
)
from .json_utils import compact_json
from .llm import invoke_json, invoke_text
from .policies import (
    LOW_SPINE_RISK_LEVELS,
    SENIOR_AGE_THRESHOLD,
    SESSION_EXERCISE_COUNT_POLICY,
)
from .state import ALLOWED_ACTIONS, RecommendationState


def _history(state: RecommendationState, action: str) -> list[str]:
    return [*state.get("action_history", []), action]


def supervisor_agent(state: RecommendationState) -> dict[str, Any]:
    current_step = _supervisor_step_count(state)
    max_steps = _max_supervisor_steps(state)
    if state.get("final_response"):
        action = "END"
        return {
            "next_action": action,
            "action_reason": "final_response already exists",
            "action_history": _history(state, action),
            "supervisor_step_count": current_step + 1,
        }

    if current_step >= max_steps:
        action = _loop_guard_action(state)
        result = {
            "next_action": action,
            "action_reason": f"Supervisor loop guard reached max_supervisor_steps={max_steps}.",
            "action_history": _history(state, action),
            "supervisor_step_count": current_step + 1,
            "errors": [
                *state.get("errors", []),
                f"Supervisor loop guard reached max_supervisor_steps={max_steps}.",
            ],
        }
        if action == "END" and not state.get("final_response"):
            result["final_response"] = (
                "추천 루프가 최대 단계 수에 도달해 안전하게 중단했습니다. "
                "입력값, GraphDB 후보, 검증 결과를 확인한 뒤 다시 시도해주세요."
            )
        return result

    system = (
        "당신은 5분할 루틴 추천 LangGraph의 Routine Supervisor Agent입니다. "
        "현재 State를 보고 다음 action 하나만 JSON으로 선택하세요. "
        "허용 action: " + ", ".join(sorted(ALLOWED_ACTIONS)) + ". "
        "루틴 생성 전에는 프로필 확인, 추천 파라미터 생성, 그래프 검색, 루틴 구성, 검증, 최종 확인, 최종 응답 순서를 지켜야 합니다. "
        "최종 확인 단계에서는 REQUEST_FINAL_HUMAN_REVIEW를 선택해야 합니다. "
        "응답은 반드시 {\"next_action\":\"...\",\"reason\":\"...\"} JSON만 반환하세요."
    )
    user = compact_json({
        "state": _routing_state_summary(state),
        "routing_rules": {
            "profile_missing": "CALL_USER_PROFILE_TOOL",
            "params_missing": "CALL_RECOMMENDATION_PARAM_AGENT",
            "candidates_missing": "CALL_GRAPH_SEARCH_TOOL",
            "routine_missing": "CALL_COMPOSITION_AGENT",
            "validation_missing": "CALL_VALIDATION_AGENT",
            "validation_failed": "CALL_REVISION_AGENT",
            "review_missing": "REQUEST_FINAL_HUMAN_REVIEW",
            "final_missing": "CALL_FINAL_RESPONSE_GENERATOR",
            "final_done": "END",
        },
    })
    parsed = invoke_json(system, user)
    action = parsed.get("next_action")
    expected_action = _fallback_next_action(state)
    if (
        action not in ALLOWED_ACTIONS
        or not _is_action_allowed_now(action, state)
        or action != expected_action
    ):
        action = expected_action
    return {
        "next_action": action,
        "action_reason": parsed.get("reason", "fallback route selected"),
        "action_history": _history(state, action),
        "supervisor_step_count": current_step + 1,
    }


def user_profile_tool(state: RecommendationState) -> dict[str, Any]:
    if not state.get("user_profile"):
        message = "구조화된 프론트 설문 user_profile이 없어 추천을 진행할 수 없습니다."
        return {
            "final_response": message,
            "next_action": "END",
            "errors": [*state.get("errors", []), message],
        }
    profile = _normalize_profile(
        state.get("user_profile", {}),
    )
    return {
        "user_profile": profile,
        "profile_normalized": True,
        "workout_history": state.get("workout_history", []),
    }


def recommendation_param_agent(state: RecommendationState) -> dict[str, Any]:
    system = (
        "당신은 Recommendation Param Agent입니다. Neo4j 조회에 사용할 파라미터만 구조화하세요. "
        "Cypher를 만들면 안 됩니다. split_targets는 CHEST, BACK, LEG, SHOULDER, ARM을 사용하세요. "
        "level은 beginner/intermediate/advanced, goal은 hypertrophy/strength/fat_loss/health 중 하나로 정규화하세요. "
        "spine은 all/mid/low 중 하나입니다. 응답은 JSON만 반환하세요."
    )
    parsed = invoke_json(system, compact_json({
        "user_profile": state.get("user_profile", {}),
    }))
    try:
        return {
            "recommendation_params": build_recommendation_params_from_profile(
                state.get("user_profile", {}),
                parsed,
            )
        }
    except ValueError as exc:
        message = str(exc)
        return {
            "final_response": message,
            "next_action": "END",
            "errors": [*state.get("errors", []), message],
        }


def build_recommendation_params_from_profile(
    profile: dict[str, Any],
    parsed: dict[str, Any] | None = None,
) -> dict[str, Any]:
    parsed = parsed or {}
    profile_split_targets = _required_profile_value(profile, "split_targets")
    profile_goal = _required_profile_value(profile, "goal")
    profile_level = _required_profile_value(profile, "level")
    profile_equipment = _required_profile_value(profile, "available_equipment")
    profile_home_only = _required_profile_value(profile, "home_only")
    profile_session_min = _required_profile_value(profile, "session_min")

    split_targets = normalize_split_targets(
        parsed.get("split_targets") or profile_split_targets,
    )

    spine = normalize_spine(parsed.get("spine") or profile.get("spine") or "all")
    if _needs_low_spine_load(profile):
        spine = "low"

    avoid_conditions = parsed.get("avoid_conditions") or profile.get("pain_points") or []
    if not isinstance(avoid_conditions, list):
        avoid_conditions = [avoid_conditions]
    for item in [*profile.get("injuries", []), *profile.get("pain_points", [])]:
        if item and item not in avoid_conditions:
            avoid_conditions.append(item)

    return {
        "split_targets": split_targets,
        "goal": parsed.get("goal") or profile_goal,
        "level": parsed.get("level") or profile_level,
        "available_equipment": parsed.get("available_equipment") or profile_equipment,
        "exclude_exercises": parsed.get("exclude_exercises") or profile.get("disliked_exercises") or [],
        "avoid_conditions": avoid_conditions,
        "home_only": parsed["home_only"] if parsed.get("home_only") is not None else profile_home_only,
        "session_min": profile_session_min,
        "spine": spine,
        "intensity_bias": parsed.get("intensity_bias") or profile.get("intensity_bias") or "standard",
        "candidate_limit_per_target": int(parsed.get("candidate_limit_per_target", 12)),
    }


def graph_search_tool(state: RecommendationState) -> dict[str, Any]:
    from .graph_tools import search_exercises

    candidates, insufficient = search_exercises(state.get("recommendation_params", {}))
    result: dict[str, Any] = {
        "exercise_candidates": candidates,
        "insufficient_targets": insufficient,
    }
    if insufficient:
        result["final_response"] = _insufficient_candidates_message(
            state.get("recommendation_params", {}),
            candidates,
            insufficient,
        )
        result["next_action"] = "END"
        result["errors"] = [
            *state.get("errors", []),
            f"GraphDB candidates are insufficient for: {', '.join(insufficient)}",
        ]
    return result


def routine_composition_agent(state: RecommendationState) -> dict[str, Any]:
    system = (
        "당신은 Routine Composition Agent입니다. 제공된 Neo4j 운동 후보 안에서만 5분할 루틴을 구성하세요. "
        "후보에 없는 운동을 만들면 안 됩니다. session_min에 맞춰 각 분할의 운동 개수를 조절하고 sets/reps/rest_seconds/reason을 포함하세요. "
        "응답은 JSON만 반환하세요: {\"split_type\":\"5-day\",\"days\":[...]}"
    )
    parsed = invoke_json(system, compact_json({
        "profile": state.get("user_profile", {}),
        "params": state.get("recommendation_params", {}),
        "exercise_count_per_split": _exercise_count_for_session(state.get("user_profile", {})),
        "exercise_candidates": _slim_candidates(state.get("exercise_candidates", {})),
    }))
    repaired = _ensure_split_routine(
        parsed,
        state.get("exercise_candidates", {}),
        state.get("recommendation_params", {}),
    )
    return {"routine_draft": repaired}


def routine_validation_agent(state: RecommendationState) -> dict[str, Any]:
    system = (
        "당신은 Routine Validation Agent입니다. 루틴이 후보 운동만 사용했는지, 장비/난이도/통증/부위 균형 조건을 만족하는지 검증하세요. "
        "부상이나 통증 조건이 있으면 루틴이 유효하더라도 risk_level을 낮게 평가하지 마세요. "
        "장비 다양성은 검증 기준이 아니며, 사용 가능한 장비 안에서 머신 중심으로 구성된 것을 문제로 평가하지 마세요. "
        "응답은 JSON만 반환하세요: "
        "{\"is_valid\":true,\"risk_level\":\"low|medium|high\",\"issues\":[],\"revision_instructions\":[]}"
    )
    parsed = invoke_json(system, compact_json({
        "profile": state.get("user_profile", {}),
        "params": state.get("recommendation_params", {}),
        "allowed_exercises": _candidate_name_index(state.get("exercise_candidates", {})),
        "routine_draft": state.get("routine_draft"),
    }))
    if "is_valid" not in parsed:
        parsed["is_valid"] = False
        parsed["issues"] = [{"type": "invalid_validation_output", "message": "validation JSON missing is_valid"}]
    return {"validation_result": _apply_deterministic_validation(state, parsed)}


def routine_revision_agent(state: RecommendationState) -> dict[str, Any]:
    human_review = state.get("human_review_result") or {}
    feedback = str(human_review.get("feedback") or "").strip()
    if feedback:
        constraint_request = _extract_human_revision_constraints(state, feedback)
        updated_params = (
            constraint_request.get("updated_params")
            if isinstance(constraint_request.get("updated_params"), dict)
            else {}
        )
        if updated_params:
            merged_params = _merge_recommendation_params(
                state.get("recommendation_params", {}),
                updated_params,
            )
            return {
                "revision_request": constraint_request,
                "revision_constraints": updated_params,
                "recommendation_params": merged_params,
                "exercise_candidates": {},
                "insufficient_targets": [],
                "routine_draft": None,
                "validation_result": None,
                "human_review_result": None,
            }

    system = (
        "당신은 Routine Revision Agent입니다. 검증 이슈 또는 사용자 피드백을 반영하세요. "
        "현재 GraphDB 후보 안에서 해결 가능한 수정만 수행하세요. "
        "사람 피드백의 구조화 제약은 이미 별도 단계에서 처리되었습니다. "
        "응답은 JSON만 반환하세요: "
        "{\"revision_type\":\"...\",\"revision_reason\":\"...\",\"routine_draft\":{...}}"
    )
    parsed = invoke_json(system, compact_json({
        "routine_draft": state.get("routine_draft"),
        "validation_result": state.get("validation_result"),
        "human_review_result": human_review,
        "current_params": state.get("recommendation_params", {}),
        "allowed_exercises": _candidate_name_index(state.get("exercise_candidates", {})),
    }))

    return {
        "revision_request": parsed,
        "revision_constraints": None,
        "routine_draft": _ensure_split_routine(
            parsed.get("routine_draft", state.get("routine_draft")),
            state.get("exercise_candidates", {}),
            state.get("recommendation_params", {}),
        ),
        "validation_result": None,
        "human_review_result": None,
    }


def _extract_human_revision_constraints(
    state: RecommendationState,
    feedback: str,
) -> dict[str, Any]:
    local_updates = _local_revision_param_hints(feedback)
    system = (
        "당신은 Human Feedback Constraint Agent입니다. 사용자의 수정 요청을 추천 시스템이 실행할 수 있는 "
        "구조화된 파라미터 변경으로 변환하세요. 루틴을 작성하지 마세요. "
        "updated_params에는 현재값과 달라져야 하는 키만 넣고, 현재 파라미터 전체를 복사하지 마세요. "
        "사용자가 명시적으로 요청하지 않은 목표, 분할 부위, 분할 순서, 장소, 장비, 시간, 레벨은 변경하지 마세요. "
        "안전, 통증, 부상, 부담 감소 요청은 최우선으로 반영해야 하며 기존의 넓은 검색 조건을 그대로 유지하면 안 됩니다. "
        "spine은 척추 부하 허용 범위이며 all은 상/중/하, mid는 중/하, low는 하만 허용합니다. "
        "새로운 통증 또는 부상으로 척추 부담 감소가 필요하면 spine을 low로 제한하고 avoid_conditions에 상태를 추가하세요. "
        "운동 강도, 장소, 장비, 목표, 운동 시간, 제외 운동처럼 GraphDB 검색 또는 추천 조건에 영향을 주는 요청도 "
        "반드시 updated_params에 반영하세요. "
        "사용자가 더 고강도를 요청하면 intensity_bias를 higher로, 더 낮은 강도를 요청하면 lower로 설정하세요. "
        "사용자가 특정 부위에 더 집중하거나 볼륨을 늘리고 싶다고 하면 split_targets를 바꾸지 말고 "
        "focus_targets와 volume_bias를 사용하세요. 예: 가슴 집중 -> {\"focus_targets\":[\"CHEST\"],\"volume_bias\":\"higher\"}. "
        "updated_params에는 split_targets, goal, level, available_equipment, exclude_exercises, "
        "avoid_conditions, home_only, session_min, spine, intensity_bias, candidate_limit_per_target, "
        "focus_targets, volume_bias 중 필요한 키만 넣으세요. "
        "updated_params가 하나라도 있으면 requires_research=true입니다. 기존 후보 안에서 순서나 세트만 바꾸면 false입니다. "
        "응답은 JSON만 반환하세요: "
        "{\"requires_research\":true,\"revision_reason\":\"...\",\"updated_params\":{}}"
    )
    parsed = invoke_json(system, compact_json({
        "feedback": feedback,
        "current_params": state.get("recommendation_params", {}),
        "profile": state.get("user_profile", {}),
        "validation_result": state.get("validation_result"),
    }))
    if not isinstance(parsed.get("updated_params"), dict):
        parsed["updated_params"] = {}
    parsed["updated_params"] = {
        **parsed["updated_params"],
        **local_updates,
    }
    parsed["updated_params"] = _changed_recommendation_params(
        state.get("recommendation_params", {}),
        parsed["updated_params"],
    )
    parsed["requires_research"] = bool(parsed["updated_params"])
    return parsed


def final_human_review_node(state: RecommendationState) -> dict[str, Any]:
    if state.get("human_review_result"):
        return {}
    review = interrupt({
        "type": "final_human_review",
        "message": "추천 루틴을 확인한 뒤 승인하거나 수정 요청을 입력하세요.",
        "routine_draft": state.get("routine_draft"),
        "validation_result": state.get("validation_result"),
        "actions": ["approve", "revise"],
    })
    if not isinstance(review, dict):
        review = {"decision": "revise", "feedback": str(review)}
    decision = str(review.get("decision", "revise")).lower()
    if decision == "accept":
        decision = "approve"
    if decision not in {"approve", "revise"}:
        decision = "revise"
    return {
        "human_review_result": {
            "decision": decision,
            "feedback": review.get("feedback", ""),
        }
    }


def final_response_generator(state: RecommendationState) -> dict[str, Any]:
    system = (
        "당신은 Final Response Generator입니다. 확정된 5분할 루틴을 한국어로 보기 좋은 표와 주의사항으로 정리하세요. "
        "추천 이유, 조건 반영 내용, 통증 주의사항을 포함하세요. "
        "제공된 내용은 모두 사용자에게 보여도 되는 정보입니다. "
        "내부 시스템 구조를 추측하거나 기술 용어를 추가하지 말고 자연스러운 사용자 안내문만 작성하세요."
    )
    text = invoke_text(system, compact_json(_final_response_payload(state)))
    return {"final_response": text, "next_action": "END"}


def _fallback_next_action(state: RecommendationState) -> str:
    if state.get("final_response"):
        return "END"
    if not state.get("profile_normalized"):
        return "CALL_USER_PROFILE_TOOL"
    if not state.get("recommendation_params"):
        return "CALL_RECOMMENDATION_PARAM_AGENT"
    if not state.get("exercise_candidates"):
        return "CALL_GRAPH_SEARCH_TOOL"
    if not state.get("routine_draft"):
        return "CALL_COMPOSITION_AGENT"
    validation = state.get("validation_result")
    if not validation:
        return "CALL_VALIDATION_AGENT"
    if validation and not validation.get("is_valid"):
        return "CALL_REVISION_AGENT"
    if not state.get("human_review_result"):
        return "REQUEST_FINAL_HUMAN_REVIEW"
    if state.get("human_review_result", {}).get("decision") != "approve":
        return "CALL_REVISION_AGENT"
    if not state.get("final_response"):
        return "CALL_FINAL_RESPONSE_GENERATOR"
    return "END"


def _supervisor_step_count(state: RecommendationState) -> int:
    try:
        return int(state.get("supervisor_step_count", len(state.get("action_history", []))))
    except (TypeError, ValueError):
        return len(state.get("action_history", []))


def _max_supervisor_steps(state: RecommendationState) -> int:
    try:
        return int(state.get("max_supervisor_steps") or 1)
    except (TypeError, ValueError):
        return 1


def _loop_guard_action(state: RecommendationState) -> str:
    if state.get("final_response"):
        return "END"

    validation = state.get("validation_result")
    review = state.get("human_review_result")
    if validation and validation.get("is_valid") and not review:
        return "REQUEST_FINAL_HUMAN_REVIEW"
    if review and review.get("decision") == "approve" and not state.get("final_response"):
        return "CALL_FINAL_RESPONSE_GENERATOR"
    return "END"


def _routing_state_summary(state: RecommendationState) -> dict[str, Any]:
    candidates = state.get("exercise_candidates", {})
    return {
        "has_user_profile": bool(state.get("user_profile")),
        "profile_normalized": bool(state.get("profile_normalized")),
        "has_recommendation_params": bool(state.get("recommendation_params")),
        "candidate_counts": {split: len(rows) for split, rows in candidates.items()},
        "insufficient_targets": state.get("insufficient_targets", []),
        "has_routine_draft": bool(state.get("routine_draft")),
        "validation_result": state.get("validation_result"),
        "human_review_result": state.get("human_review_result"),
        "has_final_response": bool(state.get("final_response")),
        "supervisor_step_count": _supervisor_step_count(state),
        "max_supervisor_steps": _max_supervisor_steps(state),
        "last_actions": state.get("action_history", [])[-8:],
    }


def _slim_candidates(candidates: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    slim: dict[str, list[dict[str, Any]]] = {}
    for split, rows in candidates.items():
        slim[split] = [
            {
                "id": row.get("id"),
                "name_kor": row.get("name_kor"),
                "name_eng": row.get("name_eng"),
                "equipment": row.get("equipment"),
                "difficulty_label": row.get("difficulty_label"),
                "spine_loading": row.get("spine_loading"),
                "cal_per_min": row.get("cal_per_min"),
            }
            for row in rows[:8]
        ]
    return slim


def _candidate_name_index(candidates: dict[str, list[dict[str, Any]]]) -> dict[str, list[str]]:
    return {
        split: [
            str(row.get("name_kor") or row.get("name_eng") or row.get("id"))
            for row in rows[:8]
        ]
        for split, rows in candidates.items()
    }


def _ensure_split_routine(
    routine: dict[str, Any],
    candidates: dict[str, list[dict[str, Any]]],
    params: dict[str, Any],
) -> dict[str, Any]:
    targets = params.get("split_targets") or SPLIT_TARGETS
    target_count = _exercise_count_for_session(routine.get("profile", {}), params)
    base_prescription = _prescription_for_params(params)
    focus_targets = set(_normalize_focus_targets(params.get("focus_targets")))
    volume_bias = _normalize_volume_bias(params.get("volume_bias"))
    days = routine.get("days") if isinstance(routine, dict) else []
    days = days if isinstance(days, list) else []
    normalized_days = []

    for index, target in enumerate(targets[:5]):
        prescription = _prescription_for_target(base_prescription, target, focus_targets, volume_bias)
        source_day = days[index] if index < len(days) and isinstance(days[index], dict) else {}
        valid_names = {
            str(row.get("name_kor") or row.get("name_eng") or row.get("id"))
            for row in candidates.get(target, [])
        }
        existing = []
        for exercise in source_day.get("exercises", []) or []:
            name = _exercise_name(exercise)
            if name in valid_names and name not in {item.get("name") for item in existing}:
                existing.append({
                    **exercise,
                    "name": name,
                    "sets": prescription["sets"],
                    "reps": prescription["reps"],
                    "rest_seconds": prescription["rest_seconds"],
                    "intensity_note": prescription["note"],
                })

        for row in candidates.get(target, []):
            if len(existing) >= target_count:
                break
            name = str(row.get("name_kor") or row.get("name_eng") or row.get("id"))
            if name in {item.get("name") for item in existing}:
                continue
            existing.append({
                "name": name,
                "exercise_id": row.get("id"),
                "equipment": row.get("equipment"),
                "sets": prescription["sets"],
                "reps": prescription["reps"],
                "rest_seconds": prescription["rest_seconds"],
                "intensity_note": prescription["note"],
                "reason": f"{target} candidate from graph DB",
            })

        normalized_days.append({
            "day": source_day.get("day") or f"Day {index + 1}",
            "target": target,
            "exercises": existing[:target_count],
        })

    return {
        **(routine if isinstance(routine, dict) else {}),
        "split_type": "5-day",
        "days": normalized_days,
    }


def _exercise_count_for_session(profile: dict[str, Any], params: dict[str, Any] | None = None) -> int:
    session_min = profile.get("session_min")
    if session_min is None and params:
        session_min = params.get("session_min")
    try:
        minutes = int(session_min)
    except (TypeError, ValueError):
        minutes = 60

    if minutes <= 30:
        return SESSION_EXERCISE_COUNT_POLICY[30]
    if minutes <= 45:
        return SESSION_EXERCISE_COUNT_POLICY[45]
    if minutes <= 60:
        return SESSION_EXERCISE_COUNT_POLICY[60]
    return SESSION_EXERCISE_COUNT_POLICY[90]


def _prescription_for_params(params: dict[str, Any]) -> dict[str, Any]:
    intensity = _normalize_intensity_bias(params.get("intensity_bias"))
    if intensity == "higher":
        return {
            "sets": 4,
            "reps": "6-10",
            "rest_seconds": 90,
            "note": "고강도 요청을 반영해 세트 수를 늘리고 반복 범위를 낮췄습니다.",
        }
    if intensity == "lower" or intensity == "slightly_conservative":
        return {
            "sets": 2,
            "reps": "10-15",
            "rest_seconds": 90,
            "note": "보수적인 강도 요청을 반영해 세트 수를 줄였습니다.",
        }
    return {
        "sets": 3,
        "reps": "8-12",
        "rest_seconds": 75,
        "note": "표준 강도 처방입니다.",
    }


def _prescription_for_target(
    base: dict[str, Any],
    target: str,
    focus_targets: set[str],
    volume_bias: str,
) -> dict[str, Any]:
    if target not in focus_targets:
        return base
    if volume_bias == "higher":
        return {
            **base,
            "sets": int(base["sets"]) + 1,
            "note": f"{target} 집중 요청을 반영해 해당 부위 세트 수를 늘렸습니다.",
        }
    if volume_bias == "lower":
        return {
            **base,
            "sets": max(1, int(base["sets"]) - 1),
            "note": f"{target} 부담 감소 요청을 반영해 해당 부위 세트 수를 줄였습니다.",
        }
    return base


def _exercise_name(exercise: dict[str, Any]) -> str:
    for key in ["name", "name_kor", "name_eng", "exercise", "exercise_name", "workout"]:
        value = exercise.get(key)
        if value:
            return str(value)
    return ""


def _normalize_intensity_bias(value: Any) -> str:
    text = str(value or "standard").strip().lower()
    aliases = {
        "standard": "standard",
        "normal": "standard",
        "higher": "higher",
        "high": "higher",
        "higher_intensity": "higher",
        "more_intense": "higher",
        "hard": "higher",
        "lower": "lower",
        "low": "lower",
        "lower_intensity": "lower",
        "easier": "lower",
        "slightly_conservative": "slightly_conservative",
    }
    return aliases.get(text, text)


def _normalize_volume_bias(value: Any) -> str:
    text = str(value or "standard").strip().lower()
    aliases = {
        "standard": "standard",
        "normal": "standard",
        "higher": "higher",
        "high": "higher",
        "more": "higher",
        "increase": "higher",
        "lower": "lower",
        "low": "lower",
        "less": "lower",
        "decrease": "lower",
    }
    return aliases.get(text, text)


def _normalize_focus_targets(value: Any) -> list[str]:
    if not value:
        return []
    return normalize_split_targets(value)


def _insufficient_candidates_message(
    params: dict[str, Any],
    candidates: dict[str, list[dict[str, Any]]],
    insufficient: list[str],
) -> str:
    counts = ", ".join(
        f"{target} {len(candidates.get(target, []))}개"
        for target in params.get("split_targets", candidates.keys())
    )
    return (
        "현재 GraphDB 후보가 부족해 안전한 추천 루틴을 생성하지 않았습니다.\n"
        f"부족한 분할: {', '.join(insufficient)}\n"
        f"조회된 후보 수: {counts}\n"
        "프론트 설문 조건이 너무 엄격하거나 GraphDB 데이터 커버리지가 부족합니다. "
        "장비/운동 장소/통증 조건을 완화하거나 GraphDB에 해당 조건의 운동 데이터를 보강한 뒤 다시 시도해주세요."
    )


def _condition_summary(state: RecommendationState) -> list[str]:
    constraints = state.get("revision_constraints") or {}
    validation = state.get("validation_result") or {}
    summary: list[str] = []

    if constraints.get("spine") == "low":
        summary.append("사람 피드백을 반영해 척추 부하가 낮은 운동 후보만 GraphDB에서 다시 검색했습니다.")
    if _normalize_intensity_bias(constraints.get("intensity_bias")) == "higher":
        summary.append("사람 피드백을 반영해 세트 수와 운동 강도를 높였습니다.")
    if _normalize_intensity_bias(constraints.get("intensity_bias")) in {"lower", "slightly_conservative"}:
        summary.append("사람 피드백을 반영해 운동 강도를 보수적으로 조정했습니다.")
    focus_targets = _normalize_focus_targets(constraints.get("focus_targets"))
    if focus_targets and _normalize_volume_bias(constraints.get("volume_bias")) == "higher":
        summary.append(f"사람 피드백을 반영해 {', '.join(focus_targets)} 부위의 볼륨을 높였습니다.")
    avoid_conditions = constraints.get("avoid_conditions") or []
    if avoid_conditions:
        summary.append(f"주의 조건으로 {', '.join(str(item) for item in avoid_conditions)}을 반영했습니다.")
    if validation.get("risk_level") == "medium":
        summary.append("루틴은 추천 제약을 만족하지만 부상 또는 통증 이력으로 인해 주의가 필요합니다.")
    return summary


def _local_revision_param_hints(feedback: str) -> dict[str, Any]:
    text = str(feedback or "").lower().replace(" ", "")
    updates: dict[str, Any] = {}
    if any(term in text for term in ["고강도", "강하게", "빡세", "빡세게", "강도높", "강도올", "더강도"]):
        updates["intensity_bias"] = "higher"
    if any(term in text for term in ["저강도", "강도낮", "쉽게", "쉬운", "가볍게"]):
        updates["intensity_bias"] = "lower"

    focus_targets = _feedback_focus_targets(text)
    if focus_targets and any(term in text for term in ["집중", "강조", "비중", "더넣", "더해", "키우", "보강", "늘려"]):
        updates["focus_targets"] = focus_targets
        updates["volume_bias"] = "higher"

    avoid_conditions = _feedback_avoid_conditions(text)
    if avoid_conditions:
        updates["avoid_conditions"] = avoid_conditions
        if any(item in avoid_conditions for item in ["lower_back", "back", "neck"]):
            updates["spine"] = "low"
    return updates


def _feedback_focus_targets(text: str) -> list[str]:
    targets: list[str] = []
    aliases = [
        ("CHEST", ["가슴", "흉근", "체스트"]),
        ("BACK", ["등", "광배", "랫", "등넓", "등두께"]),
        ("LEG", ["하체", "다리", "허벅지", "둔근", "엉덩이"]),
        ("SHOULDER", ["어깨", "삼각근", "측면어깨", "후면어깨"]),
        ("ARM", ["팔", "이두", "삼두", "전완"]),
    ]
    for target, words in aliases:
        if any(word in text for word in words) and target not in targets:
            targets.append(target)
    return targets


def _feedback_avoid_conditions(text: str) -> list[str]:
    conditions: list[str] = []
    aliases = [
        ("lower_back", ["허리", "요추", "디스크"]),
        ("knee", ["무릎"]),
        ("wrist", ["손목"]),
        ("shoulder", ["어깨통증", "어깨아", "어깨부상"]),
        ("neck", ["목통증", "목이", "목을", "목부상", "경추"]),
        ("ankle", ["발목"]),
        ("elbow", ["팔꿈치", "엘보"]),
    ]
    risk_words = ["아프", "아파", "아픈", "통증", "다쳤", "부상", "불편", "부담", "무리"]
    has_risk_context = any(word in text for word in risk_words)
    if not has_risk_context:
        return conditions
    for condition, words in aliases:
        source_text = text.replace("손목", "").replace("팔목", "") if condition == "neck" else text
        if any(word in source_text for word in words) and condition not in conditions:
            conditions.append(condition)
    return conditions


def _final_response_payload(state: RecommendationState) -> dict[str, Any]:
    validation = state.get("validation_result") or {}
    profile = state.get("user_profile", {})
    return {
        "확정 루틴": state.get("routine_draft"),
        "사용자 조건": {
            "운동 목표": profile.get("goal"),
            "세션 시간": profile.get("session_min"),
        },
        "조건 반영 설명": _condition_summary(state),
        "주의 수준": _risk_label(validation.get("risk_level")),
        "주의사항": list(validation.get("safety_warnings") or []),
    }


def _risk_label(value: Any) -> str:
    return {
        "low": "낮음",
        "medium": "주의 필요",
        "high": "높음",
    }.get(str(value or "").lower(), "확인 필요")


def _merge_recommendation_params(
    current: dict[str, Any],
    updates: dict[str, Any],
) -> dict[str, Any]:
    merged = {**current}
    for key, value in updates.items():
        if value is None or value == "":
            continue
        if key == "avoid_conditions":
            merged[key] = _merge_unique_list(current.get(key, []), value)
        elif key == "exclude_exercises":
            merged[key] = _merge_unique_list(current.get(key, []), value)
        elif key == "available_equipment":
            merged[key] = normalize_equipment(value)
        elif key == "split_targets":
            merged[key] = normalize_split_targets(value)
        elif key == "level":
            merged[key] = normalize_level(value)
        elif key == "spine":
            merged[key] = normalize_spine(value)
        elif key == "intensity_bias":
            merged[key] = _normalize_intensity_bias(value)
        elif key == "focus_targets":
            merged[key] = _normalize_focus_targets(value)
        elif key == "volume_bias":
            merged[key] = _normalize_volume_bias(value)
        else:
            merged[key] = value
    return merged


def _changed_recommendation_params(
    current: dict[str, Any],
    updates: dict[str, Any],
) -> dict[str, Any]:
    merged = _merge_recommendation_params(current, updates)
    return {
        key: merged[key]
        for key in updates
        if key in merged and merged.get(key) != current.get(key)
    }


def _merge_unique_list(current: Any, updates: Any) -> list[Any]:
    if not isinstance(current, list):
        current = [current] if current else []
    if not isinstance(updates, list):
        updates = [updates] if updates else []
    merged = list(current)
    for item in updates:
        if item not in merged:
            merged.append(item)
    return merged


def _needs_low_spine_load(profile: dict[str, Any]) -> bool:
    age = profile.get("age")
    try:
        senior = int(age) >= SENIOR_AGE_THRESHOLD if age is not None else False
    except (TypeError, ValueError):
        senior = False
    risk_level = str(profile.get("risk_level") or "").lower()
    requested_spine = normalize_spine(profile.get("spine"))
    return (
        senior
        or bool(profile.get("injuries"))
        or bool(profile.get("pain_points"))
        or risk_level in LOW_SPINE_RISK_LEVELS
        or requested_spine == "low"
    )


def _apply_deterministic_validation(
    state: RecommendationState,
    validation: dict[str, Any],
) -> dict[str, Any]:
    result = {
        **validation,
        "issues": list(validation.get("issues") or []),
        "safety_warnings": [],
        "revision_instructions": list(validation.get("revision_instructions") or []),
    }
    params = state.get("recommendation_params", {})
    routine = state.get("routine_draft") or {}
    candidates = state.get("exercise_candidates", {})
    expected_targets = normalize_split_targets(params.get("split_targets") or SPLIT_TARGETS)
    days = routine.get("days") if isinstance(routine, dict) else []
    days = days if isinstance(days, list) else []
    days_by_target = {
        str(day.get("target")): day
        for day in days
        if isinstance(day, dict) and day.get("target")
    }

    missing_targets = [target for target in expected_targets if target not in days_by_target]
    if missing_targets:
        _add_validation_issue(
            result,
            "missing_split_target",
            f"5분할 필수 부위가 누락되었습니다: {', '.join(missing_targets)}",
            "누락된 분할 부위를 포함해 루틴을 다시 구성하세요.",
            risk_level="medium",
        )

    for target in expected_targets:
        day = days_by_target.get(target, {})
        exercises = day.get("exercises", []) if isinstance(day, dict) else []
        exercises = exercises if isinstance(exercises, list) else []
        if len(exercises) < 3:
            _add_validation_issue(
                result,
                "too_few_exercises",
                f"{target} 분할의 운동 수가 3개 미만입니다.",
                "각 분할마다 GraphDB 후보 안에서 최소 3개 운동을 배치하세요.",
                risk_level="medium",
            )

    candidate_index = _candidate_row_index(candidates)
    low_spine_required = _needs_low_spine_load(state.get("user_profile", {})) or normalize_spine(params.get("spine")) == "low"

    for target in expected_targets:
        day = days_by_target.get(target, {})
        exercises = day.get("exercises", []) if isinstance(day, dict) else []
        for exercise in exercises if isinstance(exercises, list) else []:
            if not isinstance(exercise, dict):
                continue
            name = _exercise_name(exercise)
            row = candidate_index.get(target, {}).get(name)
            if not row:
                _add_validation_issue(
                    result,
                    "exercise_not_in_candidates",
                    f"{target} 분할의 '{name}' 운동이 GraphDB 후보에 없습니다.",
                    "루틴은 GraphDB 검색 후보에 포함된 운동으로만 다시 구성하세요.",
                    risk_level="medium",
                )
                continue
            if low_spine_required and row.get("spine_loading") != "하":
                _add_validation_issue(
                    result,
                    "non_low_spine_loading",
                    f"통증/부상/저부담 조건에서 척추 부하가 낮지 않은 운동 '{name}'이 포함되었습니다.",
                    "spine_loading이 '하'인 운동 후보로 대체하세요.",
                    risk_level="high",
                )

    if _has_health_risk_context(state):
        _add_safety_warning(
            result,
            "부상 또는 통증 관련 조건을 반영해 루틴을 구성했지만, 현재 통증과 운동 가능 여부를 확인한 뒤 진행해야 합니다.",
            risk_level="medium",
        )

    result["is_valid"] = bool(result.get("is_valid", True)) and not result["issues"]
    if not result["issues"]:
        result["revision_instructions"] = []
    if not result["issues"]:
        result["risk_level"] = result.get("risk_level") or "low"
    result["reason"] = _validation_reason(result)
    return result


def _has_health_risk_context(state: RecommendationState) -> bool:
    profile = state.get("user_profile", {})
    params = state.get("recommendation_params", {})
    constraints = state.get("revision_constraints") or {}
    return bool(
        profile.get("injuries")
        or profile.get("pain_points")
        or params.get("avoid_conditions")
        or constraints.get("avoid_conditions")
    )


def _candidate_row_index(
    candidates: dict[str, list[dict[str, Any]]],
) -> dict[str, dict[str, dict[str, Any]]]:
    indexed: dict[str, dict[str, dict[str, Any]]] = {}
    for target, rows in candidates.items():
        indexed[target] = {}
        for row in rows:
            for key in ["name_kor", "name_eng", "id"]:
                name = row.get(key)
                if name:
                    indexed[target][str(name)] = row
    return indexed


def _add_validation_issue(
    validation: dict[str, Any],
    issue_type: str,
    message: str,
    instruction: str,
    risk_level: str,
) -> None:
    issue = {"type": issue_type, "message": message}
    if issue not in validation["issues"]:
        validation["issues"].append(issue)
    if instruction not in validation["revision_instructions"]:
        validation["revision_instructions"].append(instruction)
    validation["risk_level"] = _max_risk(validation.get("risk_level"), risk_level)


def _add_safety_warning(
    validation: dict[str, Any],
    message: str,
    risk_level: str,
) -> None:
    if message not in validation["safety_warnings"]:
        validation["safety_warnings"].append(message)
    validation["risk_level"] = _max_risk(validation.get("risk_level"), risk_level)


def _validation_reason(validation: dict[str, Any]) -> str:
    if validation.get("issues"):
        return "루틴 구성 또는 안전 조건에 해결이 필요한 문제가 있습니다."
    if validation.get("safety_warnings"):
        return "루틴은 현재 추천 제약을 만족하지만, 부상 또는 통증 이력으로 인해 주의가 필요합니다."
    return "루틴이 현재 추천 조건과 GraphDB 후보 제약을 만족합니다."


def _max_risk(current: Any, new: str) -> str:
    rank = {"low": 0, "medium": 1, "high": 2}
    current_text = str(current or "low").lower()
    return new if rank.get(new, 0) > rank.get(current_text, 0) else current_text


def _normalize_profile(profile: dict[str, Any]) -> dict[str, Any]:
    normalized = {**profile}

    if normalized.get("level"):
        normalized["level"] = normalize_level(normalized.get("level"))

    goal = str(normalized.get("goal") or "").strip().lower()
    goal_aliases = {
        "hypertrophy": "hypertrophy",
        "strength": "strength",
        "fat_loss": "fat_loss",
        "health": "health",
        "근비대": "hypertrophy",
        "근력": "strength",
        "다이어트": "fat_loss",
        "체지방": "fat_loss",
        "건강": "health",
    }
    normalized["goal"] = goal_aliases.get(goal, normalized.get("goal"))

    days = normalized.get("available_days")
    if isinstance(days, list):
        normalized["available_days"] = len(days)
    elif not normalized.get("available_days") and isinstance(normalized.get("work_days"), list):
        normalized["available_days"] = len(normalized["work_days"])

    if normalized.get("available_equipment"):
        normalized["available_equipment"] = normalize_equipment(normalized.get("available_equipment"))
    else:
        normalized["available_equipment"] = []

    if not normalized.get("injuries"):
        normalized["injuries"] = []
    if not normalized.get("pain_points"):
        normalized["pain_points"] = []
    normalized["spine"] = normalize_spine(normalized.get("spine"))
    if not normalized["injuries"] and not normalized["pain_points"]:
        normalized["spine"] = "all"
    elif normalized["spine"] == "all":
        normalized["spine"] = "low"

    for key in ["preferences", "disliked_exercises"]:
        if not isinstance(normalized.get(key), list):
            normalized[key] = []
    if "home_only" not in normalized:
        normalized["home_only"] = normalized.get("place") == "home"
    return normalized


def _required_profile_value(profile: dict[str, Any], key: str) -> Any:
    value = profile.get(key)
    if value is None or value == "" or value == []:
        raise ValueError(f"필수 설문 항목 '{key}' 값이 없어 추천을 진행할 수 없습니다.")
    return value


def _is_action_allowed_now(action: str, state: RecommendationState) -> bool:
    if action == "CALL_USER_PROFILE_TOOL":
        return not bool(state.get("profile_normalized"))
    if action == "CALL_RECOMMENDATION_PARAM_AGENT":
        return bool(state.get("profile_normalized")) and not bool(state.get("recommendation_params"))
    if action == "CALL_GRAPH_SEARCH_TOOL":
        return bool(state.get("recommendation_params")) and not bool(state.get("exercise_candidates"))
    if action == "CALL_COMPOSITION_AGENT":
        return bool(state.get("exercise_candidates")) and not bool(state.get("routine_draft"))
    if action == "CALL_VALIDATION_AGENT":
        return bool(state.get("routine_draft")) and not bool(state.get("validation_result"))
    if action == "CALL_REVISION_AGENT":
        validation = state.get("validation_result")
        review = state.get("human_review_result")
        validation_failed = bool(validation) and not validation.get("is_valid")
        review_rejected = bool(review) and review.get("decision") != "approve"
        return bool(state.get("routine_draft")) and (validation_failed or review_rejected)
    if action == "REQUEST_FINAL_HUMAN_REVIEW":
        validation = state.get("validation_result")
        return bool(validation) and validation.get("is_valid") and not bool(state.get("human_review_result"))
    if action == "CALL_FINAL_RESPONSE_GENERATOR":
        review = state.get("human_review_result")
        return bool(review) and review.get("decision") == "approve" and not bool(state.get("final_response"))
    if action == "END":
        return bool(state.get("final_response"))
    return False
