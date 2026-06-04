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
    if action not in ALLOWED_ACTIONS or not _is_action_allowed_now(action, state):
        action = _fallback_next_action(state)
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
    return {"exercise_candidates": candidates, "insufficient_targets": insufficient}


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
        "응답은 JSON만 반환하세요: {\"is_valid\":true,\"risk_level\":\"low|medium|high\",\"issues\":[],\"revision_instructions\":[]}"
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
    system = (
        "당신은 Routine Revision Agent입니다. 검증 이슈 또는 사용자 피드백을 반영해 기존 루틴을 최소 수정하세요. "
        "운동 후보 안에서만 수정하세요. 응답은 JSON만 반환하세요: "
        "{\"revision_type\":\"...\",\"revision_reason\":\"...\",\"routine_draft\":{...}}"
    )
    parsed = invoke_json(system, compact_json({
        "routine_draft": state.get("routine_draft"),
        "validation_result": state.get("validation_result"),
        "human_review_result": state.get("human_review_result"),
        "allowed_exercises": _candidate_name_index(state.get("exercise_candidates", {})),
    }))
    return {
        "revision_request": parsed,
        "routine_draft": _ensure_split_routine(
            parsed.get("routine_draft", state.get("routine_draft")),
            state.get("exercise_candidates", {}),
            state.get("recommendation_params", {}),
        ),
        "validation_result": None,
        "human_review_result": None,
    }


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
        "추천 이유, 조건 반영 내용, 통증 주의사항을 포함하세요."
    )
    text = invoke_text(system, compact_json({
        "profile": state.get("user_profile", {}),
        "routine": state.get("routine_draft"),
        "validation": state.get("validation_result"),
        "review": state.get("human_review_result"),
    }))
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
    days = routine.get("days") if isinstance(routine, dict) else []
    days = days if isinstance(days, list) else []
    normalized_days = []

    for index, target in enumerate(targets[:5]):
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
                    "sets": exercise.get("sets", 3),
                    "reps": exercise.get("reps", "8-12"),
                    "rest_seconds": exercise.get("rest_seconds", 75),
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
                "sets": 3,
                "reps": "8-12",
                "rest_seconds": 75,
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


def _exercise_name(exercise: dict[str, Any]) -> str:
    for key in ["name", "name_kor", "name_eng", "exercise", "exercise_name", "workout"]:
        value = exercise.get(key)
        if value:
            return str(value)
    return ""


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
            if low_spine_required and row.get("spine_loading") == "상":
                _add_validation_issue(
                    result,
                    "high_spine_loading",
                    f"통증/부상/저부담 조건에서 고부하 운동 '{name}'이 포함되었습니다.",
                    "spine_loading이 '하'인 운동 후보로 대체하세요.",
                    risk_level="high",
                )

    result["is_valid"] = bool(result.get("is_valid", True)) and not result["issues"]
    if not result["issues"]:
        result["risk_level"] = result.get("risk_level") or "low"
    return result


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
