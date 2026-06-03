from typing import Any

from langgraph.types import interrupt

from .graph_tools import SPLIT_TARGETS, normalize_equipment, normalize_level, normalize_spine
from .json_utils import compact_json
from .llm import invoke_json, invoke_text
from .state import ALLOWED_ACTIONS, DEFAULT_PROFILE, RecommendationState


def _history(state: RecommendationState, action: str) -> list[str]:
    return [*state.get("action_history", []), action]


def supervisor_agent(state: RecommendationState) -> dict[str, Any]:
    system = (
        "당신은 5분할 루틴 추천 LangGraph의 Routine Supervisor Agent입니다. "
        "현재 State를 보고 다음 action 하나만 JSON으로 선택하세요. "
        "허용 action: " + ", ".join(sorted(ALLOWED_ACTIONS)) + ". "
        "프론트엔드 설문에서 필수 정보 입력을 보장하므로 추천 시작 전 REQUEST_REQUIRED_INFO는 선택하지 마세요. "
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
    }


def user_profile_tool(state: RecommendationState) -> dict[str, Any]:
    system = (
        "You are a User Profile Extraction Agent for a workout recommendation service. "
        "Extract only facts stated by the completed frontend survey or user message. "
        "Return JSON only with these optional fields: age, gender, level, goal, "
        "available_days, available_equipment, injuries, pain_points, preferences, "
        "disliked_exercises, home_only, spine. "
        "Normalize level to beginner/intermediate/advanced, goal to "
        "hypertrophy/strength/fat_loss/health, and spine to all/mid/low. "
        "Use [] for empty list fields and null for unknown scalar fields."
    )
    parsed = invoke_json(system, compact_json({
        "user_message": state.get("user_message", ""),
        "existing_profile": state.get("user_profile", {}),
    }))
    profile = _normalize_profile(
        {**DEFAULT_PROFILE, **state.get("user_profile", {}), **parsed},
        state.get("user_message", ""),
    )
    return {"user_profile": profile, "workout_history": state.get("workout_history", [])}


def profile_clarification_agent(state: RecommendationState) -> dict[str, Any]:
    system = (
        "당신은 Profile Clarification Agent입니다. 사용자의 요청과 현재 프로필에서 "
        "5분할 루틴 추천에 필요한 필수 정보 누락을 판단하세요. "
        "필수 필드: level, goal, available_days, available_equipment, injuries 또는 pain_points. "
        "응답은 JSON만 반환하세요: "
        "{\"missing_fields\":[],\"clarification_question\":\"...\",\"structured_answers\":{...}}"
    )
    parsed = invoke_json(system, compact_json({
        "user_message": state.get("user_message", ""),
        "user_profile": state.get("user_profile", {}),
        "human_answers": state.get("human_answers", {}),
    }))
    missing = parsed.get("missing_fields") or []
    return {
        "missing_fields": missing,
        "human_answers": parsed.get("structured_answers", state.get("human_answers", {})),
        "final_response": parsed.get("clarification_question") if missing else state.get("final_response"),
    }


def recommendation_param_agent(state: RecommendationState) -> dict[str, Any]:
    system = (
        "당신은 Recommendation Param Agent입니다. Neo4j 조회에 사용할 파라미터만 구조화하세요. "
        "Cypher를 만들면 안 됩니다. split_targets는 CHEST, BACK, LEG, SHOULDER, ARM을 사용하세요. "
        "level은 beginner/intermediate/advanced, goal은 hypertrophy/strength/fat_loss/health 중 하나로 정규화하세요. "
        "spine은 all/mid/low 중 하나입니다. 응답은 JSON만 반환하세요."
    )
    parsed = invoke_json(system, compact_json({
        "user_message": state.get("user_message", ""),
        "user_profile": state.get("user_profile", {}),
    }))
    params = {
        "split_targets": parsed.get("split_targets") or SPLIT_TARGETS,
        "goal": parsed.get("goal") or state.get("user_profile", {}).get("goal") or "hypertrophy",
        "level": parsed.get("level") or state.get("user_profile", {}).get("level") or "intermediate",
        "available_equipment": parsed.get("available_equipment") or state.get("user_profile", {}).get("available_equipment") or [],
        "exclude_exercises": parsed.get("exclude_exercises") or state.get("user_profile", {}).get("disliked_exercises") or [],
        "avoid_conditions": parsed.get("avoid_conditions") or state.get("user_profile", {}).get("pain_points") or [],
        "home_only": parsed.get("home_only", state.get("user_profile", {}).get("home_only", False)),
        "spine": parsed.get("spine") or state.get("user_profile", {}).get("spine") or "all",
        "candidate_limit_per_target": int(parsed.get("candidate_limit_per_target", 12)),
    }
    return {"recommendation_params": params}


def graph_search_tool(state: RecommendationState) -> dict[str, Any]:
    from .graph_tools import search_exercises

    candidates, insufficient = search_exercises(state.get("recommendation_params", {}))
    return {"exercise_candidates": candidates, "insufficient_targets": insufficient}


def routine_composition_agent(state: RecommendationState) -> dict[str, Any]:
    system = (
        "당신은 Routine Composition Agent입니다. 제공된 Neo4j 운동 후보 안에서만 5분할 루틴을 구성하세요. "
        "후보에 없는 운동을 만들면 안 됩니다. 각 분할마다 3~5개 운동을 고르고 sets/reps/rest_seconds/reason을 포함하세요. "
        "응답은 JSON만 반환하세요: {\"split_type\":\"5-day\",\"days\":[...]}"
    )
    parsed = invoke_json(system, compact_json({
        "profile": state.get("user_profile", {}),
        "params": state.get("recommendation_params", {}),
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
    return {"validation_result": parsed}


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
    if not state.get("user_profile"):
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


def _routing_state_summary(state: RecommendationState) -> dict[str, Any]:
    candidates = state.get("exercise_candidates", {})
    return {
        "has_user_profile": bool(state.get("user_profile")),
        "has_recommendation_params": bool(state.get("recommendation_params")),
        "candidate_counts": {split: len(rows) for split, rows in candidates.items()},
        "insufficient_targets": state.get("insufficient_targets", []),
        "has_routine_draft": bool(state.get("routine_draft")),
        "validation_result": state.get("validation_result"),
        "human_review_result": state.get("human_review_result"),
        "has_final_response": bool(state.get("final_response")),
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
            if len(existing) >= 3:
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
            "exercises": existing[:5],
        })

    return {
        **(routine if isinstance(routine, dict) else {}),
        "split_type": "5-day",
        "days": normalized_days,
    }


def _exercise_name(exercise: dict[str, Any]) -> str:
    for key in ["name", "name_kor", "name_eng", "exercise", "exercise_name", "workout"]:
        value = exercise.get(key)
        if value:
            return str(value)
    return ""


def _normalize_profile(profile: dict[str, Any], user_message: str) -> dict[str, Any]:
    text = user_message.lower()
    normalized = {**DEFAULT_PROFILE, **profile}
    ko_beginner = "\ucd08\uae09"
    ko_intermediate = "\uc911\uae09"
    ko_advanced = "\uc0c1\uae09"
    ko_hypertrophy = "\uadfc\ube44\ub300"
    ko_week_5 = "\uc8fc 5\uc77c"
    ko_day_5 = "5\uc77c"
    ko_dumbbell = "\ub364\ubca8"
    ko_machine = "\uba38\uc2e0"
    ko_injury = "\ubd80\uc0c1"
    ko_pain = "\ud1b5\uc99d"
    ko_none = "\uc5c6\uc74c"
    ko_prefer = "\uc120\ud638"
    ko_dislike = "\uc2eb"
    ko_exclude = "\uc81c\uc678"

    normalized["level"] = normalize_level(normalized.get("level"))
    if ko_intermediate in user_message:
        normalized["level"] = "intermediate"
    elif ko_beginner in user_message:
        normalized["level"] = "beginner"
    elif ko_advanced in user_message:
        normalized["level"] = "advanced"

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
    if ko_hypertrophy in user_message:
        normalized["goal"] = "hypertrophy"

    days = normalized.get("available_days")
    if isinstance(days, list):
        normalized["available_days"] = len(days)
    if ko_week_5 in user_message or ko_day_5 in user_message:
        normalized["available_days"] = 5

    normalized["available_equipment"] = normalize_equipment(normalized.get("available_equipment"))
    explicit_equipment = []
    if ko_dumbbell in user_message or "dumbbell" in text:
        explicit_equipment.append("dumbbell")
    if ko_machine in user_message or "machine" in text:
        explicit_equipment.append("machine")
    if explicit_equipment:
        normalized["available_equipment"] = normalize_equipment(explicit_equipment)

    if ko_injury in user_message and ko_none in user_message:
        normalized["injuries"] = []
    if (ko_pain in user_message or "pain" in text) and ko_none in user_message:
        normalized["pain_points"] = []

    if not normalized.get("injuries"):
        normalized["injuries"] = []
    if not normalized.get("pain_points"):
        normalized["pain_points"] = []
    normalized["spine"] = normalize_spine(normalized.get("spine"))
    if not normalized["injuries"] and not normalized["pain_points"]:
        normalized["spine"] = "all"

    for key in ["preferences", "disliked_exercises"]:
        if not isinstance(normalized.get(key), list):
            normalized[key] = []
    if ko_prefer not in user_message and "prefer" not in text:
        normalized["preferences"] = []
    if ko_dislike not in user_message and ko_exclude not in user_message and "dislike" not in text and "exclude" not in text:
        normalized["disliked_exercises"] = []
    normalized["home_only"] = bool(normalized.get("home_only", False))
    return normalized


def _is_action_allowed_now(action: str, state: RecommendationState) -> bool:
    if action == "CALL_USER_PROFILE_TOOL":
        return not bool(state.get("user_profile"))
    if action == "REQUEST_REQUIRED_INFO":
        return False
    if action == "CALL_RECOMMENDATION_PARAM_AGENT":
        return bool(state.get("user_profile")) and not bool(state.get("recommendation_params"))
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
