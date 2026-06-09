from typing import Any

from langgraph.types import interrupt

from .graph_tools import (
    SPLIT_TARGETS,
    movement_family,
    normalize_equipment,
    normalize_level,
    normalize_spine,
    normalize_split_targets,
)
from .json_utils import compact_json
from .llm import invoke_json
from .policies import (
    GOAL_EQUIPMENT_POLICY,
    GOAL_LOAD_GUIDANCE,
    LOW_SPINE_RISK_LEVELS,
    MANDATORY_EXERCISES_BY_GOAL,
    SENIOR_AGE_THRESHOLD,
    SESSION_EXERCISE_COUNT_POLICY,
)
from .state import RecommendationState


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
                "입력값, 운동 후보, 검증 결과를 확인한 뒤 다시 시도해주세요."
            )
        return result

    inconsistency = _state_inconsistency_reason(state)
    if inconsistency:
        return _supervisor_recovery_decision(
            state,
            inconsistency,
            current_step,
        )

    action = _fallback_next_action(state)
    if action == "CALL_REVISION_AGENT":
        local_removed = _local_exercise_removal_names(
            str((state.get("human_review_result") or {}).get("feedback") or ""),
            state.get("routine_draft"),
        )
        if local_removed:
            return {
                "next_action": action,
                "action_reason": "local exercise removal detected from human feedback",
                "action_history": _history(state, action),
                "supervisor_step_count": current_step + 1,
                "revision_request": {
                    "revision_type": "local_exercise_removal",
                    "revision_reason": "사용자 피드백에서 특정 운동 제거 의도를 감지했습니다.",
                    "removed_exercises": local_removed,
                },
            }
        if _needs_supervisor_revision_decision(state):
            return _supervisor_revision_decision(state, current_step)

    return {
        "next_action": action,
        "action_reason": "deterministic normal-flow route",
        "action_history": _history(state, action),
        "supervisor_step_count": current_step + 1,
    }


def _supervisor_revision_decision(
    state: RecommendationState,
    current_step: int,
) -> dict[str, Any]:
    human_review = state.get("human_review_result") or {}
    feedback = str(human_review.get("feedback") or "").strip()
    validation = state.get("validation_result") or {}
    local_updates = _local_revision_param_hints(feedback) if feedback else {}
    system = (
        "당신은 5분할 루틴 추천의 예외·수정 전략을 결정하는 Supervisor Agent입니다. "
        "정상 작업 순서는 코드가 처리하므로 지금은 실제 판단이 필요한 수정 분기만 결정하세요. "
        "strategy는 research 또는 local_revision 중 하나입니다. "
        "사용자 피드백이 통증, 부상, 강도, 특정 부위 집중, 부위 안 세부 자극 다양성, 장비, 제외 운동, 목표, 레벨, 시간처럼 "
        "검색 또는 추천 조건을 바꾸면 research를 선택하고 updated_params에 변경값을 넣으세요. "
        "세부 자극 다양성 요청은 GraphDB 후보의 target_primary, movement_family, tag를 다시 활용해야 하므로 research를 선택하세요. "
        "운동 순서 변경이나 현재 후보 안의 단순 교체처럼 검색 조건이 그대로면 local_revision을 선택하세요. "
        "검증 문제가 여러 개이고 현재 후보만으로 해결하기 어렵다면 research를 선택하세요. "
        "이 서비스는 체육관 전용이므로 장소와 home_only는 변경하지 마세요. "
        "updated_params에는 split_targets, goal, level, available_equipment, exclude_exercises, "
        "avoid_conditions, session_min, spine, intensity_bias, candidate_limit_per_target, "
        "focus_targets, volume_bias, detail_focus_terms 중 필요한 키만 넣으세요. "
        "응답은 JSON만 반환하세요: "
        "{\"strategy\":\"research|local_revision\",\"reason\":\"...\",\"updated_params\":{}}"
    )
    parsed = invoke_json(system, compact_json({
        "feedback": feedback,
        "validation_result": validation,
        "current_params": state.get("recommendation_params", {}),
        "candidate_counts": {
            target: len(rows)
            for target, rows in state.get("exercise_candidates", {}).items()
        },
    }))
    llm_updates = parsed.get("updated_params")
    if not isinstance(llm_updates, dict):
        llm_updates = {}
    updates = _sanitize_supervisor_updates({
        **llm_updates,
        **local_updates,
    })
    changed_updates = _changed_recommendation_params(
        state.get("recommendation_params", {}),
        updates,
    )
    strategy = str(parsed.get("strategy") or "").strip().lower()
    should_research = bool(changed_updates) and (
        strategy == "research" or bool(local_updates)
    )

    revision_request = {
        "handled_by_supervisor": True,
        "strategy": "research" if should_research else "local_revision",
        "reason": parsed.get("reason", ""),
        "updated_params": changed_updates if should_research else {},
    }
    if should_research:
        action = "CALL_GRAPH_SEARCH_TOOL"
        merged_params = _merge_recommendation_params(
            state.get("recommendation_params", {}),
            changed_updates,
        )
        merged_params = _apply_revision_exclusions_to_params(
            merged_params,
            state.get("revision_excluded_exercises", []),
        )
        seed_ids = _routine_exercise_ids_by_target(state.get("routine_draft"))
        if seed_ids:
            merged_params["relationship_seed_ids_by_target"] = seed_ids
        return {
            "next_action": action,
            "action_reason": parsed.get("reason", "Supervisor selected GraphDB research."),
            "action_history": _history(state, action),
            "supervisor_step_count": current_step + 1,
            "revision_request": revision_request,
            "revision_constraints": changed_updates,
            "recommendation_params": merged_params,
            "exercise_candidates": {},
            "insufficient_targets": [],
            "previous_routine_draft": state.get("routine_draft"),
            "routine_draft": None,
            "validation_result": None,
            "human_review_result": None,
        }

    action = "CALL_REVISION_AGENT"
    return {
        "next_action": action,
        "action_reason": parsed.get("reason", "Supervisor selected local routine revision."),
        "action_history": _history(state, action),
        "supervisor_step_count": current_step + 1,
        "revision_request": revision_request,
        "recommendation_params": _apply_revision_exclusions_to_params(
            _clear_initial_required_exercises(
                state.get("recommendation_params", {}),
            ),
            state.get("revision_excluded_exercises", []),
        ),
        "previous_routine_draft": state.get("routine_draft"),
    }


def _supervisor_recovery_decision(
    state: RecommendationState,
    inconsistency: str,
    current_step: int,
) -> dict[str, Any]:
    options = _safe_recovery_options(state)
    system = (
        "당신은 LangGraph State 복구 Supervisor입니다. 정상 순서로 처리할 수 없는 State가 감지되었습니다. "
        "허용된 recovery_option 중 복구에 필요한 가장 뒤쪽 단계를 하나 선택하세요. "
        "안전하게 복구할 수 없으면 END를 선택하세요. "
        "응답은 JSON만 반환하세요: {\"recovery_option\":\"...\",\"reason\":\"...\"}"
    )
    parsed = invoke_json(system, compact_json({
        "inconsistency": inconsistency,
        "allowed_recovery_options": options,
        "state": _routing_state_summary(state),
    }))
    choice = str(parsed.get("recovery_option") or "").strip().upper()
    if choice not in options:
        choice = _default_recovery_option(state)
    return _recovery_result(
        state,
        choice,
        parsed.get("reason", inconsistency),
        current_step,
    )


def _needs_supervisor_revision_decision(state: RecommendationState) -> bool:
    review = state.get("human_review_result") or {}
    if review.get("decision") == "revise":
        return False
    validation = state.get("validation_result") or {}
    return len(validation.get("issues") or []) >= 2


def _sanitize_supervisor_updates(updates: dict[str, Any]) -> dict[str, Any]:
    allowed = {
        "split_targets",
        "goal",
        "level",
        "available_equipment",
        "exclude_exercises",
        "avoid_conditions",
        "session_min",
        "spine",
        "intensity_bias",
        "candidate_limit_per_target",
        "focus_targets",
        "volume_bias",
        "detail_focus_terms",
    }
    return {
        key: value
        for key, value in updates.items()
        if key in allowed and value is not None and value != ""
    }


def _state_inconsistency_reason(state: RecommendationState) -> str:
    if state.get("validation_result") and not state.get("routine_draft"):
        return "validation_result exists without routine_draft"
    if state.get("human_review_result") and not state.get("validation_result"):
        return "human_review_result exists without validation_result"
    if state.get("routine_draft") and not state.get("exercise_candidates"):
        return "routine_draft exists without exercise_candidates"
    if state.get("exercise_candidates") and not state.get("recommendation_params"):
        return "exercise_candidates exist without recommendation_params"
    if state.get("recommendation_params") and not state.get("profile_normalized"):
        return "recommendation_params exist before profile normalization"
    return ""


def _safe_recovery_options(state: RecommendationState) -> list[str]:
    options = []
    if state.get("user_profile"):
        options.append("RESTART_PROFILE")
    if state.get("profile_normalized"):
        options.append("REBUILD_PARAMS")
    if state.get("recommendation_params"):
        options.append("RESEARCH_GRAPH")
    if state.get("exercise_candidates"):
        options.append("RECOMPOSE_ROUTINE")
    if state.get("routine_draft"):
        options.append("REVALIDATE")
    options.append("END")
    return options


def _default_recovery_option(state: RecommendationState) -> str:
    if state.get("routine_draft"):
        return "REVALIDATE"
    if state.get("exercise_candidates"):
        return "RECOMPOSE_ROUTINE"
    if state.get("recommendation_params"):
        return "RESEARCH_GRAPH"
    if state.get("profile_normalized"):
        return "REBUILD_PARAMS"
    if state.get("user_profile"):
        return "RESTART_PROFILE"
    return "END"


def _recovery_result(
    state: RecommendationState,
    choice: str,
    reason: str,
    current_step: int,
) -> dict[str, Any]:
    base = {
        "action_reason": f"LLM recovery decision: {reason}",
        "supervisor_step_count": current_step + 1,
    }
    if choice == "RESTART_PROFILE":
        action = "CALL_USER_PROFILE_TOOL"
        return {
            **base,
            "next_action": action,
            "action_history": _history(state, action),
            "profile_normalized": False,
            "recommendation_params": {},
            "exercise_candidates": {},
            "routine_draft": None,
            "validation_result": None,
            "human_review_result": None,
        }
    if choice == "REBUILD_PARAMS":
        action = "CALL_RECOMMENDATION_PARAM_AGENT"
        return {
            **base,
            "next_action": action,
            "action_history": _history(state, action),
            "recommendation_params": {},
            "exercise_candidates": {},
            "routine_draft": None,
            "validation_result": None,
            "human_review_result": None,
        }
    if choice == "RESEARCH_GRAPH":
        action = "CALL_GRAPH_SEARCH_TOOL"
        return {
            **base,
            "next_action": action,
            "action_history": _history(state, action),
            "exercise_candidates": {},
            "routine_draft": None,
            "validation_result": None,
            "human_review_result": None,
        }
    if choice == "RECOMPOSE_ROUTINE":
        action = "CALL_COMPOSITION_AGENT"
        return {
            **base,
            "next_action": action,
            "action_history": _history(state, action),
            "routine_draft": None,
            "validation_result": None,
            "human_review_result": None,
        }
    if choice == "REVALIDATE":
        action = "CALL_VALIDATION_AGENT"
        return {
            **base,
            "next_action": action,
            "action_history": _history(state, action),
            "validation_result": None,
            "human_review_result": None,
        }

    action = "END"
    return {
        **base,
        "next_action": action,
        "action_history": _history(state, action),
        "final_response": (
            "추천 상태를 안전하게 복구할 수 없어 중단했습니다. "
            "설문을 다시 확인한 뒤 추천을 재시도해주세요."
        ),
        "errors": [*state.get("errors", []), f"State recovery failed: {reason}"],
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
    profile_session_min = _required_profile_value(profile, "session_min")
    goal = str(profile_goal).strip().lower()
    available_equipment = normalize_equipment(profile_equipment)
    excluded_equipment = GOAL_EQUIPMENT_POLICY.get(goal, {}).get("excluded", set())
    available_equipment = [
        item for item in available_equipment
        if item not in excluded_equipment
    ]
    if not available_equipment:
        raise ValueError(f"운동 목표 '{goal}'에 사용할 수 있는 장비가 없습니다.")

    split_targets = _normalize_profile_split_targets(profile_split_targets)

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
        "goal": goal,
        "level": parsed.get("level") or profile_level,
        "available_equipment": available_equipment,
        "exclude_exercises": parsed.get("exclude_exercises") or profile.get("disliked_exercises") or [],
        "avoid_conditions": avoid_conditions,
        "home_only": False,
        "session_min": profile_session_min,
        "spine": spine,
        "intensity_bias": parsed.get("intensity_bias") or profile.get("intensity_bias") or "standard",
        "candidate_limit_per_target": int(parsed.get("candidate_limit_per_target", 12)),
        "required_exercises": MANDATORY_EXERCISES_BY_GOAL.get(goal, {}),
        "load_guidance": GOAL_LOAD_GUIDANCE.get(goal, ""),
    }


def _normalize_profile_split_targets(values: Any) -> list[str]:
    if not values:
        return SPLIT_TARGETS
    if isinstance(values, str):
        values = [values]

    normalized = []
    for value in values:
        text = str(value or "").strip().upper()
        if text in SPLIT_TARGETS:
            normalized.append(text)
    return normalized or normalize_split_targets(values)


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
        "revision_request가 있으면 그 수정 의도를 우선 반영하세요. "
        "같은 분할 안에서는 movement_family와 target_primary가 가능한 한 겹치지 않게 구성하고, "
        "프레스·컬·레이즈처럼 동일한 움직임 계열만 반복하지 마세요. "
        "focus_targets가 있고 volume_bias가 higher/lower가 아니면 해당 분할은 볼륨 증가가 아니라 "
        "GraphDB 후보의 target_primary, tag, movement_family를 활용한 세부 자극 다양성을 우선하세요. "
        "detail_focus_terms가 있으면 해당 자연어 요구와 후보의 name_kor, name_eng, tag, target_primary가 가장 잘 맞는 운동을 우선하세요. "
        "응답은 JSON만 반환하세요: {\"split_type\":\"5-day\",\"days\":[...]}"
    )
    parsed = invoke_json(system, compact_json({
        "profile": state.get("user_profile", {}),
        "params": state.get("recommendation_params", {}),
        "revision_request": state.get("revision_request"),
        "revision_constraints": state.get("revision_constraints"),
        "exercise_count_per_split": _exercise_count_for_session(state.get("user_profile", {})),
        "exercise_candidates": _slim_candidates(state.get("exercise_candidates", {})),
    }))
    repaired = _ensure_split_routine(
        parsed,
        state.get("exercise_candidates", {}),
        state.get("recommendation_params", {}),
    )
    if _should_apply_revision_removal_guard(state):
        guarded_routine, newly_excluded = _apply_revision_removal_guard(
            repaired,
            state.get("exercise_candidates", {}),
            state.get("recommendation_params", {}),
            state.get("previous_routine_draft"),
        )
    else:
        guarded_routine, newly_excluded = repaired, []
    scoped_revision_targets = _target_scoped_revision_targets(state)
    next_candidates = state.get("exercise_candidates", {})
    if scoped_revision_targets:
        guarded_routine = _preserve_unfocused_previous_days(
            guarded_routine,
            state.get("previous_routine_draft"),
            scoped_revision_targets,
        )
        next_candidates = _augment_candidates_with_preserved_previous_days(
            next_candidates,
            state.get("previous_routine_draft"),
            scoped_revision_targets,
        )
    if not newly_excluded:
        result = {
            "routine_draft": guarded_routine,
            "previous_routine_draft": None,
        }
        if scoped_revision_targets:
            result["exercise_candidates"] = next_candidates
        return result

    next_exclusions = _merge_unique_list(
        state.get("revision_excluded_exercises", []),
        newly_excluded,
    )
    return {
        "routine_draft": guarded_routine,
        "previous_routine_draft": None,
        "revision_excluded_exercises": next_exclusions,
        "exercise_candidates": next_candidates,
        "recommendation_params": _apply_revision_exclusions_to_params(
            state.get("recommendation_params", {}),
            next_exclusions,
        ),
    }


def routine_validation_agent(state: RecommendationState) -> dict[str, Any]:
    system = (
        "당신은 Routine Validation Agent입니다. 루틴이 후보 운동만 사용했는지, 장비/난이도/통증/부위 균형 조건을 만족하는지 검증하세요. "
        "같은 분할에 동일 movement_family 운동이 과도하게 반복되는지도 검증하세요. "
        "부상이나 통증 조건이 있으면 루틴이 유효하더라도 risk_level을 낮게 평가하지 마세요. "
        "장비 다양성은 검증 기준이 아니며, 사용 가능한 장비 안에서 머신 중심으로 구성된 것을 문제로 평가하지 마세요. "
        "응답은 JSON만 반환하세요: "
        "{\"is_valid\":true,\"risk_level\":\"low|medium|high\",\"issues\":[],\"revision_instructions\":[]}"
    )
    parsed = invoke_json(system, compact_json({
        "profile": _validation_profile(state.get("user_profile", {})),
        "params": _validation_params(state.get("recommendation_params", {})),
        "selected_exercise_candidates": _slim_selected_candidates(
            state.get("exercise_candidates", {}),
            state.get("routine_draft"),
        ),
        "routine_draft": _slim_routine_for_validation(state.get("routine_draft")),
    }))
    if "is_valid" not in parsed:
        parsed["is_valid"] = False
        parsed["issues"] = [{"type": "invalid_validation_output", "message": "validation JSON missing is_valid"}]
    return {"validation_result": _apply_deterministic_validation(state, parsed)}


def routine_revision_agent(state: RecommendationState) -> dict[str, Any]:
    human_review = state.get("human_review_result") or {}
    feedback = str(human_review.get("feedback") or "").strip()
    supervisor_request = state.get("revision_request") or {}
    handled_by_supervisor = bool(supervisor_request.get("handled_by_supervisor"))
    requested_removed = _match_routine_exercise_names(
        supervisor_request.get("removed_exercises"),
        state.get("routine_draft"),
    )
    explicit_removed = requested_removed or _local_exercise_removal_names(
        feedback,
        state.get("routine_draft"),
    )
    if explicit_removed:
        next_params = _apply_revision_exclusions_to_params(
            _clear_initial_required_exercises(
                state.get("recommendation_params", {}),
            ),
            _merge_unique_list(
                state.get("revision_excluded_exercises", []),
                explicit_removed,
            ),
        )
        revised_routine = _replace_excluded_exercises_in_routine(
            state.get("routine_draft"),
            state.get("exercise_candidates", {}),
            next_params,
            explicit_removed,
        )
        return {
            "revision_request": {
                "revision_type": "local_exercise_removal",
                "revision_reason": "사용자가 명시한 운동만 현재 후보 안에서 교체했습니다.",
                "removed_exercises": explicit_removed,
            },
            "revision_constraints": None,
            "recommendation_params": next_params,
            "routine_draft": revised_routine,
            "previous_routine_draft": None,
            "revision_excluded_exercises": _merge_unique_list(
                state.get("revision_excluded_exercises", []),
                explicit_removed,
            ),
            "validation_result": None,
            "human_review_result": None,
        }
    if feedback and not handled_by_supervisor:
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
            merged_params = _apply_revision_exclusions_to_params(
                merged_params,
                state.get("revision_excluded_exercises", []),
            )
            seed_ids = _routine_exercise_ids_by_target(state.get("routine_draft"))
            if seed_ids:
                merged_params["relationship_seed_ids_by_target"] = seed_ids
            return {
                "revision_request": constraint_request,
                "revision_constraints": updated_params,
                "recommendation_params": merged_params,
                "exercise_candidates": {},
                "insufficient_targets": [],
                "previous_routine_draft": state.get("routine_draft"),
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

    next_params = _apply_revision_exclusions_to_params(
        _clear_initial_required_exercises(
            state.get("recommendation_params", {}),
        ),
        state.get("revision_excluded_exercises", []),
    ) if feedback else state.get("recommendation_params", {})
    revised_routine = _ensure_split_routine(
        parsed.get("routine_draft", state.get("routine_draft")),
        state.get("exercise_candidates", {}),
        next_params,
    )
    if _should_apply_revision_removal_guard(state):
        guarded_routine, newly_excluded = _apply_revision_removal_guard(
            revised_routine,
            state.get("exercise_candidates", {}),
            next_params,
            state.get("previous_routine_draft") or state.get("routine_draft"),
        )
    else:
        guarded_routine, newly_excluded = revised_routine, []
    if newly_excluded:
        next_params = _apply_revision_exclusions_to_params(next_params, newly_excluded)

    return {
        "revision_request": parsed,
        "revision_constraints": None,
        "recommendation_params": next_params,
        "routine_draft": guarded_routine,
        "previous_routine_draft": None,
        "revision_excluded_exercises": _merge_unique_list(
            state.get("revision_excluded_exercises", []),
            newly_excluded,
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
        "사용자가 명시적으로 요청하지 않은 목표, 분할 부위, 분할 순서, 장비, 시간, 레벨은 변경하지 마세요. "
        "이 서비스는 체육관 전용이므로 장소 또는 home_only를 변경하지 마세요. "
        "안전, 통증, 부상, 부담 감소 요청은 최우선으로 반영해야 하며 기존의 넓은 검색 조건을 그대로 유지하면 안 됩니다. "
        "spine은 척추 부하 허용 범위이며 all은 상/중/하, mid는 중/하, low는 하만 허용합니다. "
        "새로운 통증 또는 부상으로 척추 부담 감소가 필요하면 spine을 low로 제한하고 avoid_conditions에 상태를 추가하세요. "
        "운동 강도, 장비, 목표, 운동 시간, 제외 운동처럼 GraphDB 검색 또는 추천 조건에 영향을 주는 요청도 "
        "반드시 updated_params에 반영하세요. "
        "사용자가 더 고강도를 요청하면 intensity_bias를 higher로, 더 낮은 강도를 요청하면 lower로 설정하세요. "
        "사용자가 특정 부위에 더 집중하거나 볼륨을 늘리고 싶다고 하면 split_targets를 바꾸지 말고 "
        "focus_targets와 volume_bias를 사용하세요. 예: 가슴 집중 -> {\"focus_targets\":[\"CHEST\"],\"volume_bias\":\"higher\"}. "
        "사용자가 특정 부위 안에서 자극을 나누거나 다양하게 해달라고 하면 split_targets를 바꾸지 말고 "
        "해당 부위를 focus_targets에 넣으세요. 이 경우 볼륨 증가 요청이 아니면 volume_bias를 넣지 마세요. "
        "사용자가 예시로 든 세부 자극 표현은 detail_focus_terms에 보존하세요. "
        "세부 자극 예시가 있으면 detail_focus_terms는 필수이며, 사용자가 쓴 표현을 원문 그대로 배열에 복사하세요. "
        "예: 특정 부위 안에서 사용자가 'A, B'라고 예시를 쓰면 {\"detail_focus_terms\":{\"CHEST\":[\"A\",\"B\"]}}. "
        "updated_params에는 split_targets, goal, level, available_equipment, exclude_exercises, "
        "avoid_conditions, session_min, spine, intensity_bias, candidate_limit_per_target, "
        "focus_targets, volume_bias, detail_focus_terms 중 필요한 키만 넣으세요. "
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
                "target_primary": row.get("target_primary"),
                "movement_family": movement_family(row),
                "tag": row.get("tag"),
                "expert_policy_required": bool(row.get("expert_policy_required")),
            }
            for row in rows
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
        candidate_by_name = {
            str(row.get("name_kor") or row.get("name_eng") or row.get("id")): row
            for row in candidates.get(target, [])
        }
        existing = []
        required_row = next(
            (
                row for row in candidates.get(target, [])
                if row.get("expert_policy_required")
            ),
            None,
        )
        if required_row:
            required_name = str(
                required_row.get("name_kor")
                or required_row.get("name_eng")
                or required_row.get("id")
            )
            existing.append({
                "name": required_name,
                "exercise_id": required_row.get("id"),
                "equipment": required_row.get("equipment"),
                "sets": prescription["sets"],
                "reps": prescription["reps"],
                "rest_seconds": prescription["rest_seconds"],
                "intensity_note": prescription["note"],
                "expert_policy_required": True,
                "movement_family": movement_family(required_row),
                "target_primary": required_row.get("target_primary"),
                "reason": "전문가 검토를 거친 목표별 필수 운동입니다.",
            })

        for exercise in source_day.get("exercises", []) or []:
            name = _exercise_name(exercise)
            if name in valid_names and name not in {item.get("name") for item in existing}:
                if _is_repetitive_movement_name(
                    name,
                    [item.get("name", "") for item in existing],
                ):
                    continue
                candidate_row = candidate_by_name.get(name, {})
                existing.append({
                    **exercise,
                    "name": name,
                    "exercise_id": exercise.get("exercise_id") or exercise.get("id") or candidate_row.get("id"),
                    "equipment": exercise.get("equipment") or candidate_row.get("equipment"),
                    "sets": prescription["sets"],
                    "reps": prescription["reps"],
                    "rest_seconds": prescription["rest_seconds"],
                    "intensity_note": prescription["note"],
                    "movement_family": movement_family(candidate_row or name),
                    "target_primary": candidate_row.get("target_primary"),
                })

        deferred_rows = []
        for row in candidates.get(target, []):
            if len(existing) >= target_count:
                break
            name = str(row.get("name_kor") or row.get("name_eng") or row.get("id"))
            if name in {item.get("name") for item in existing}:
                continue
            if _is_repetitive_movement_name(name, [item.get("name", "") for item in existing]):
                deferred_rows.append(row)
                continue
            existing.append({
                "name": name,
                "exercise_id": row.get("id"),
                "equipment": row.get("equipment"),
                "sets": prescription["sets"],
                "reps": prescription["reps"],
                "rest_seconds": prescription["rest_seconds"],
                "intensity_note": prescription["note"],
                "movement_family": movement_family(row),
                "target_primary": row.get("target_primary"),
                "reason": f"{target} candidate from graph DB",
            })

        while deferred_rows and len(existing) < target_count:
            family_counts = {
                family: sum(
                    1
                    for exercise in existing
                    if movement_family(exercise.get("movement_family") or exercise.get("name", "")) == family
                )
                for family in {movement_family(row) for row in deferred_rows}
            }
            selected_index, row = min(
                enumerate(deferred_rows),
                key=lambda item: (
                    family_counts.get(movement_family(item[1]), 0),
                    item[0],
                ),
            )
            deferred_rows.pop(selected_index)
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
                "movement_family": movement_family(row),
                "target_primary": row.get("target_primary"),
                "reason": f"{target} candidate from graph DB",
            })

        if str(params.get("goal") or "").lower() == "health":
            bodyweight_row = next(
                (
                    row for row in candidates.get(target, [])
                    if row.get("equipment") == "body"
                ),
                None,
            )
            has_bodyweight = any(
                exercise.get("equipment") == "body"
                for exercise in existing
            )
            if bodyweight_row and not has_bodyweight:
                bodyweight_exercise = {
                    "name": str(
                        bodyweight_row.get("name_kor")
                        or bodyweight_row.get("name_eng")
                        or bodyweight_row.get("id")
                    ),
                    "exercise_id": bodyweight_row.get("id"),
                    "equipment": "body",
                    "sets": prescription["sets"],
                    "reps": prescription["reps"],
                    "rest_seconds": prescription["rest_seconds"],
                    "intensity_note": prescription["note"],
                    "movement_family": movement_family(bodyweight_row),
                    "target_primary": bodyweight_row.get("target_primary"),
                    "reason": f"{target} 체력 유지 목표의 맨몸 운동 후보입니다.",
                }
                if len(existing) >= target_count:
                    existing[-1] = bodyweight_exercise
                else:
                    existing.append(bodyweight_exercise)

        detail_terms = _detail_focus_terms_for_target(params.get("detail_focus_terms"), target)
        if detail_terms:
            existing = _apply_detail_focus_terms(
                existing,
                candidates.get(target, []),
                detail_terms,
                prescription,
                target_count,
            )

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


def _target_scoped_revision_targets(state: RecommendationState) -> set[str]:
    if not state.get("previous_routine_draft"):
        return set()
    constraints = state.get("revision_constraints") or {}
    if not isinstance(constraints, dict):
        return set()

    global_keys = {
        "spine",
        "intensity_bias",
        "available_equipment",
        "avoid_conditions",
        "session_min",
        "goal",
        "level",
        "split_targets",
        "candidate_limit_per_target",
        "exclude_exercises",
    }
    if any(key in constraints for key in global_keys):
        return set()

    targets = set(_normalize_focus_targets(constraints.get("focus_targets")))
    detail_terms = _normalize_detail_focus_terms(constraints.get("detail_focus_terms"))
    targets.update(target for target in detail_terms if target in SPLIT_TARGETS)
    if not targets and "ALL" in detail_terms:
        targets.update(_normalize_focus_targets(constraints.get("focus_targets")))
    return targets


def _preserve_unfocused_previous_days(
    routine: dict[str, Any],
    previous_routine: dict[str, Any] | None,
    scoped_targets: set[str],
) -> dict[str, Any]:
    if not scoped_targets or not isinstance(routine, dict) or not isinstance(previous_routine, dict):
        return routine

    previous_days = previous_routine.get("days") if isinstance(previous_routine, dict) else []
    previous_by_target = {
        str(day.get("target") or "").strip().upper(): day
        for day in previous_days or []
        if isinstance(day, dict) and day.get("target")
    }
    next_days = []
    for day in routine.get("days") or []:
        if not isinstance(day, dict):
            continue
        target = str(day.get("target") or "").strip().upper()
        if target and target not in scoped_targets and target in previous_by_target:
            next_days.append(previous_by_target[target])
        else:
            next_days.append(day)

    return {
        **routine,
        "days": next_days,
    }


def _augment_candidates_with_preserved_previous_days(
    candidates: dict[str, list[dict[str, Any]]],
    previous_routine: dict[str, Any] | None,
    scoped_targets: set[str],
) -> dict[str, list[dict[str, Any]]]:
    if not scoped_targets or not isinstance(previous_routine, dict):
        return candidates

    augmented = {
        target: list(rows or [])
        for target, rows in (candidates or {}).items()
    }
    for day in previous_routine.get("days") or []:
        if not isinstance(day, dict):
            continue
        target = str(day.get("target") or "").strip().upper()
        if not target or target in scoped_targets:
            continue
        rows = augmented.setdefault(target, [])
        existing_names = {
            str(row.get("name_kor") or row.get("name_eng") or row.get("id"))
            for row in rows
        }
        existing_ids = {row.get("id") for row in rows if row.get("id") is not None}
        for exercise in day.get("exercises") or []:
            if not isinstance(exercise, dict):
                continue
            name = _exercise_name(exercise)
            exercise_id = exercise.get("exercise_id") or exercise.get("id")
            if not name:
                continue
            if name in existing_names or (exercise_id is not None and exercise_id in existing_ids):
                continue
            rows.append({
                "id": exercise_id,
                "name_kor": name,
                "name_eng": name,
                "equipment": exercise.get("equipment"),
                "spine_loading": exercise.get("spine_loading"),
                "movement_family": exercise.get("movement_family") or movement_family(exercise),
                "target_primary": exercise.get("target_primary"),
                "source": "preserved_previous_routine",
            })
            existing_names.add(name)
            if exercise_id is not None:
                existing_ids.add(exercise_id)
    return augmented


def _detail_focus_terms_for_target(value: Any, target: str) -> list[str]:
    normalized = _normalize_detail_focus_terms(value)
    return [
        *normalized.get(str(target or "").upper(), []),
        *normalized.get("ALL", []),
    ]


def _apply_detail_focus_terms(
    exercises: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    terms: list[str],
    prescription: dict[str, Any],
    target_count: int,
) -> list[dict[str, Any]]:
    selected = list(exercises[:target_count])
    if not selected or not candidates:
        return selected

    for term in terms:
        if any(_exercise_matches_detail_term(exercise, term) for exercise in selected):
            continue
        candidate = _candidate_matching_detail_term(candidates, selected, term)
        if not candidate:
            continue
        replace_index = _replaceable_detail_index(selected, terms)
        if replace_index is None:
            break
        replacement = _exercise_from_candidate_row(
            candidate,
            {
                "sets": prescription["sets"],
                "reps": prescription["reps"],
                "rest_seconds": prescription["rest_seconds"],
                "intensity_note": prescription["note"],
            },
        )
        replacement["reason"] = "사람 피드백의 세부 자극 요청과 GraphDB 후보 메타데이터가 일치합니다."
        selected[replace_index] = replacement
    return selected[:target_count]


def _candidate_matching_detail_term(
    candidates: list[dict[str, Any]],
    selected: list[dict[str, Any]],
    term: str,
) -> dict[str, Any] | None:
    compact_term = _compact_text(term)
    if not compact_term:
        return None
    selected_ids = {
        exercise.get("exercise_id") or exercise.get("id")
        for exercise in selected
        if exercise.get("exercise_id") is not None or exercise.get("id") is not None
    }
    selected_names = {_compact_text(_exercise_name(exercise)) for exercise in selected}
    for row in candidates:
        name = str(row.get("name_kor") or row.get("name_eng") or row.get("id"))
        if row.get("id") in selected_ids or _compact_text(name) in selected_names:
            continue
        searchable = _compact_text(" ".join(
            str(row.get(key) or "")
            for key in ("name_kor", "name_eng", "tag", "target_primary")
        ))
        if compact_term and (compact_term in searchable or searchable in compact_term):
            return row
    return None


def _replaceable_detail_index(exercises: list[dict[str, Any]], protected_terms: list[str]) -> int | None:
    for index in range(len(exercises) - 1, -1, -1):
        if exercises[index].get("expert_policy_required"):
            continue
        if any(_exercise_matches_detail_term(exercises[index], term) for term in protected_terms):
            continue
        return index
    for index in range(len(exercises) - 1, -1, -1):
        if not exercises[index].get("expert_policy_required"):
            return index
    return None


def _exercise_matches_detail_term(exercise: dict[str, Any], term: str) -> bool:
    compact_term = _compact_text(term)
    if not compact_term:
        return False
    searchable = _compact_text(" ".join(
        str(exercise.get(key) or "")
        for key in ("name", "name_kor", "name_eng", "tag", "target_primary")
    ))
    return compact_term in searchable or searchable in compact_term


def _validation_profile(profile: dict[str, Any]) -> dict[str, Any]:
    keys = ("age", "gender", "injuries", "pain_points", "risk_level")
    return {key: profile.get(key) for key in keys if profile.get(key) not in (None, [], "")}


def _validation_params(params: dict[str, Any]) -> dict[str, Any]:
    keys = (
        "split_targets",
        "goal",
        "level",
        "available_equipment",
        "avoid_conditions",
        "spine",
        "intensity_bias",
        "focus_targets",
        "volume_bias",
        "detail_focus_terms",
    )
    return {key: params.get(key) for key in keys if params.get(key) not in (None, [], "")}


def _slim_selected_candidates(
    candidates: dict[str, list[dict[str, Any]]],
    routine: Any,
) -> dict[str, list[dict[str, Any]]]:
    selected_by_target: dict[str, tuple[set[Any], set[str]]] = {}
    if isinstance(routine, dict):
        for day in routine.get("days") or []:
            if not isinstance(day, dict):
                continue
            target = str(day.get("target") or "")
            ids: set[Any] = set()
            names: set[str] = set()
            for exercise in day.get("exercises") or []:
                if not isinstance(exercise, dict):
                    continue
                identifier = exercise.get("exercise_id") or exercise.get("id")
                if identifier is not None:
                    ids.add(identifier)
                name = _exercise_name(exercise)
                if name:
                    names.add(name)
            selected_by_target[target] = (ids, names)

    selected: dict[str, list[dict[str, Any]]] = {}
    for target, rows in candidates.items():
        ids, names = selected_by_target.get(target, (set(), set()))
        selected[target] = [
            {
                "id": row.get("id"),
                "name_kor": row.get("name_kor"),
                "equipment": row.get("equipment"),
                "difficulty_label": row.get("difficulty_label"),
                "spine_loading": row.get("spine_loading"),
                "target_primary": row.get("target_primary"),
                "movement_family": movement_family(row),
                "tag": row.get("tag"),
            }
            for row in rows
            if row.get("id") in ids
            or str(row.get("name_kor") or row.get("name_eng") or row.get("id")) in names
        ]
    return selected


def _slim_routine_for_validation(routine: Any) -> dict[str, Any]:
    if not isinstance(routine, dict):
        return {}
    return {
        "split_type": routine.get("split_type"),
        "days": [
            {
                "day": day.get("day"),
                "target": day.get("target"),
                "exercises": [
                    {
                        "name": _exercise_name(exercise),
                        "exercise_id": exercise.get("exercise_id") or exercise.get("id"),
                        "equipment": exercise.get("equipment"),
                        "sets": exercise.get("sets"),
                        "reps": exercise.get("reps"),
                        "rest_seconds": exercise.get("rest_seconds"),
                        "movement_family": exercise.get("movement_family"),
                        "target_primary": exercise.get("target_primary"),
                    }
                    for exercise in day.get("exercises") or []
                    if isinstance(exercise, dict)
                ],
            }
            for day in routine.get("days") or []
            if isinstance(day, dict)
        ],
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


def _is_repetitive_movement_name(name: str, existing_names: list[str]) -> bool:
    lowered = name.lower()
    existing_lowered = [item.lower() for item in existing_names]
    if any(
        len(existing) >= 3 and (existing in lowered or lowered in existing)
        for existing in existing_lowered
    ):
        return True
    family = movement_family(name)
    return family != "other" and any(
        movement_family(existing) == family
        for existing in existing_names
    )


def _routine_exercise_ids_by_target(routine: Any) -> dict[str, list[int]]:
    if not isinstance(routine, dict):
        return {}
    result: dict[str, list[int]] = {}
    for day in routine.get("days") or []:
        if not isinstance(day, dict):
            continue
        target = str(day.get("target") or "").strip().upper()
        if target not in SPLIT_TARGETS:
            continue
        identifiers = []
        for exercise in day.get("exercises") or []:
            if not isinstance(exercise, dict):
                continue
            try:
                exercise_id = int(exercise.get("exercise_id") or exercise.get("id"))
            except (TypeError, ValueError):
                continue
            if exercise_id not in identifiers:
                identifiers.append(exercise_id)
        if identifiers:
            result[target] = identifiers
    return result


def _prescription_for_params(params: dict[str, Any]) -> dict[str, Any]:
    goal = str(params.get("goal") or "hypertrophy").strip().lower()
    if goal == "strength":
        base = {
            "sets": 4,
            "reps": "3-5",
            "rest_seconds": 180,
            "note": "스트렝스 목표를 반영해 저반복, 고중량, 긴 휴식으로 구성했습니다.",
        }
    elif goal == "fat_loss":
        base = {
            "sets": 3,
            "reps": "12-15",
            "rest_seconds": 60,
            "note": "다이어트 목표를 반영해 저중량, 고반복, 짧은 휴식으로 구성했습니다.",
        }
    elif goal == "health":
        base = {
            "sets": 3,
            "reps": "10-15",
            "rest_seconds": 90,
            "note": "체력 유지 목표를 반영해 머신 중심의 안정적인 볼륨으로 구성했습니다.",
        }
    else:
        base = {
            "sets": 4,
            "reps": "6-8",
            "rest_seconds": 90,
            "note": "근비대 목표를 반영해 중간 반복과 충분한 볼륨으로 구성했습니다.",
        }

    load_guidance = str(params.get("load_guidance") or "").strip()
    if load_guidance:
        base["note"] = f"{base['note']} {load_guidance}"

    intensity = _normalize_intensity_bias(params.get("intensity_bias"))
    if intensity == "higher":
        return {
            **base,
            "sets": int(base["sets"]) + 1,
            "reps": "6-10" if goal not in {"strength", "fat_loss"} else base["reps"],
            "rest_seconds": max(int(base["rest_seconds"]), 90),
            "note": f"{base['note']} 추가 고강도 요청을 반영해 세트 수를 늘렸습니다.",
        }
    if intensity == "lower" or intensity == "slightly_conservative":
        return {
            **base,
            "sets": max(1, int(base["sets"]) - 1),
            "reps": "10-15",
            "rest_seconds": max(int(base["rest_seconds"]), 90),
            "note": f"{base['note']} 보수적인 강도 요청을 반영해 세트 수를 줄였습니다.",
        }
    return base


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


def _normalize_detail_focus_terms(value: Any) -> dict[str, list[str]]:
    if not value:
        return {}
    if isinstance(value, str):
        return {"ALL": [value.strip()]} if value.strip() else {}
    if isinstance(value, (list, tuple, set)):
        terms = [str(item).strip() for item in value if str(item).strip()]
        return {"ALL": terms} if terms else {}
    if not isinstance(value, dict):
        return {}

    normalized: dict[str, list[str]] = {}
    for raw_target, raw_terms in value.items():
        targets = normalize_split_targets([raw_target])
        target = targets[0] if targets else str(raw_target or "").strip().upper()
        if isinstance(raw_terms, str):
            terms = [raw_terms]
        elif isinstance(raw_terms, (list, tuple, set)):
            terms = list(raw_terms)
        else:
            terms = [raw_terms] if raw_terms else []
        cleaned = [str(term).strip() for term in terms if str(term).strip()]
        if cleaned:
            normalized[target] = cleaned
    return normalized


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
        "현재 운동 후보가 부족해 안전한 추천 루틴을 생성하지 않았습니다.\n"
        f"부족한 분할: {', '.join(insufficient)}\n"
        f"조회된 후보 수: {counts}\n"
        "현재 조건에 맞는 운동 후보가 부족합니다. "
        "장비/운동 장소/통증 조건을 완화하거나 운동 데이터를 보강한 뒤 다시 시도해주세요."
    )


def _condition_summary(state: RecommendationState) -> list[str]:
    constraints = state.get("revision_constraints") or {}
    validation = state.get("validation_result") or {}
    summary: list[str] = []

    if constraints.get("spine") == "low":
        summary.append("사람 피드백을 반영해 척추 부하가 낮은 운동 후보 위주로 다시 구성했습니다.")
    if _normalize_intensity_bias(constraints.get("intensity_bias")) == "higher":
        summary.append("사람 피드백을 반영해 세트 수와 운동 강도를 높였습니다.")
    if _normalize_intensity_bias(constraints.get("intensity_bias")) in {"lower", "slightly_conservative"}:
        summary.append("사람 피드백을 반영해 운동 강도를 보수적으로 조정했습니다.")
    focus_targets = _normalize_focus_targets(constraints.get("focus_targets"))
    if focus_targets and _normalize_volume_bias(constraints.get("volume_bias")) == "higher":
        summary.append(f"사람 피드백을 반영해 {', '.join(focus_targets)} 부위의 볼륨을 높였습니다.")
    elif focus_targets:
        summary.append(f"사람 피드백을 반영해 {', '.join(focus_targets)} 부위의 세부 자극 구성을 다양화했습니다.")
    detail_focus_terms = _normalize_detail_focus_terms(constraints.get("detail_focus_terms"))
    if detail_focus_terms:
        summary.append("사람 피드백의 세부 자극 요청을 GraphDB 후보 태그와 타깃 정보에 반영했습니다.")
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


def _risk_label(value: Any) -> str:
    return {
        "low": "낮음",
        "medium": "주의 필요",
        "high": "높음",
    }.get(str(value or "").lower(), "확인 필요")


def _apply_revision_exclusions_to_params(
    params: dict[str, Any],
    exclusions: Any,
) -> dict[str, Any]:
    if not params:
        return {}
    merged = {**params}
    merged["exclude_exercises"] = _merge_unique_list(
        merged.get("exclude_exercises", []),
        exclusions,
    )
    merged["required_exercises"] = {}
    return merged


def _apply_revision_removal_guard(
    routine: dict[str, Any],
    candidates: dict[str, list[dict[str, Any]]],
    params: dict[str, Any],
    previous_routine: dict[str, Any] | None,
) -> tuple[dict[str, Any], list[str]]:
    removed_names = _revision_removed_exercise_names(previous_routine, routine)
    if not removed_names:
        return routine, []

    blacklist = _merge_unique_list(params.get("exclude_exercises", []), removed_names)
    days = routine.get("days") if isinstance(routine, dict) else []
    days = days if isinstance(days, list) else []
    guarded_days = []
    used_names = {
        _exercise_name(exercise)
        for day in days
        if isinstance(day, dict)
        for exercise in (day.get("exercises") or [])
        if isinstance(exercise, dict)
        and not _is_exercise_name_excluded(_exercise_name(exercise), blacklist)
    }

    for day in days:
        if not isinstance(day, dict):
            guarded_days.append(day)
            continue
        target = str(day.get("target") or "").strip().upper()
        next_exercises = []
        for exercise in day.get("exercises", []) or []:
            if not isinstance(exercise, dict):
                continue
            name = _exercise_name(exercise)
            if not _is_exercise_name_excluded(name, blacklist):
                next_exercises.append(exercise)
                continue

            replacement = _replacement_candidate_for_removed_exercise(
                target,
                candidates,
                blacklist,
                used_names,
                next_exercises,
            )
            if replacement:
                replacement_exercise = _exercise_from_candidate_row(replacement, exercise)
                next_exercises.append(replacement_exercise)
                used_names.add(replacement_exercise["name"])
            else:
                next_exercises.append(exercise)
        guarded_days.append({
            **day,
            "exercises": next_exercises,
        })

    return {
        **routine,
        "days": guarded_days,
    }, removed_names


def _should_apply_revision_removal_guard(state: RecommendationState) -> bool:
    request = state.get("revision_request") or {}
    if request.get("removed_exercises") or request.get("revision_type") == "local_exercise_removal":
        return True
    if state.get("revision_excluded_exercises"):
        return True
    params = state.get("recommendation_params") or {}
    if params.get("exclude_exercises"):
        return True
    if state.get("previous_routine_draft") and normalize_spine(params.get("spine")) in {"low", "mid"}:
        return True
    validation = state.get("validation_result") or {}
    guarded_issue_types = {
        "excluded_exercise_reused",
        "non_low_spine_loading",
    }
    return any(
        isinstance(issue, dict) and issue.get("type") in guarded_issue_types
        for issue in validation.get("issues") or []
    )


def _explicit_removed_exercise_names(
    feedback: str,
    routine: dict[str, Any] | None,
) -> list[str]:
    text = _compact_text(feedback)
    if not text:
        return []
    remove_terms = [
        "빼",
        "빼줘",
        "빼달",
        "제외",
        "삭제",
        "하지마",
        "하지말",
        "하지않",
        "하지 말",
        "안할",
        "안 할",
    ]
    if not any(_compact_text(term) in text for term in remove_terms):
        return []

    removed: list[str] = []
    for exercise in _routine_exercises(routine):
        name = _exercise_name(exercise)
        if name and _compact_text(name) in text and name not in removed:
            removed.append(name)
    return removed


def _local_exercise_removal_names(
    feedback: str,
    routine: dict[str, Any] | None,
    *,
    allow_llm: bool = True,
) -> list[str]:
    explicit = _explicit_removed_exercise_names(feedback, routine)
    if explicit or not allow_llm:
        return explicit
    if not _feedback_mentions_routine_exercise(feedback, routine):
        return []

    system = (
        "당신은 운동 루틴 수정 피드백의 의도를 분류하는 에이전트입니다. "
        "사용자가 현재 루틴 안의 특정 운동을 빼거나 다른 운동으로 대체하라는 뜻인지 판단하세요. "
        "강도, 통증, 부상, 목표, 장비, 시간 변경처럼 루틴 전체 조건을 바꾸는 요청이면 false입니다. "
        "운동명이 축약되어 있어도 current_exercises 중 가장 가까운 실제 운동명으로 반환하세요. "
        "대명사만 있고 특정 운동을 알 수 없으면 false입니다. "
        "응답은 JSON만 반환하세요: "
        "{\"is_local_removal\":true,\"removed_exercises\":[\"...\"],\"confidence\":0.0,\"reason\":\"...\"}"
    )
    parsed = invoke_json(system, compact_json({
        "feedback": feedback,
        "current_exercises": [
            _exercise_name(exercise)
            for exercise in _routine_exercises(routine)
            if _exercise_name(exercise)
        ],
    }))
    if not parsed.get("is_local_removal"):
        return []
    try:
        confidence = float(parsed.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0
    if confidence < 0.65:
        return []
    return _match_routine_exercise_names(parsed.get("removed_exercises"), routine)


def _feedback_mentions_routine_exercise(
    feedback: str,
    routine: dict[str, Any] | None,
) -> bool:
    text = _compact_text(feedback)
    if not text:
        return False
    for exercise in _routine_exercises(routine):
        name = _exercise_name(exercise)
        if not name:
            continue
        compact_name = _compact_text(name)
        if compact_name and compact_name in text:
            return True
        for token in str(name).replace("/", " ").split():
            token = _compact_text(token)
            if len(token) >= 2 and token in text:
                return True
    return False


def _match_routine_exercise_names(
    values: Any,
    routine: dict[str, Any] | None,
) -> list[str]:
    if isinstance(values, str):
        candidates = [values]
    elif isinstance(values, list):
        candidates = values
    else:
        return []

    matched: list[str] = []
    routine_names = [
        _exercise_name(exercise)
        for exercise in _routine_exercises(routine)
        if _exercise_name(exercise)
    ]
    for value in candidates:
        compact_value = _compact_text(value)
        if not compact_value:
            continue
        for name in routine_names:
            compact_name = _compact_text(name)
            if compact_value == compact_name or compact_value in compact_name or compact_name in compact_value:
                if name not in matched:
                    matched.append(name)
                break
    return matched


def _replace_excluded_exercises_in_routine(
    routine: dict[str, Any] | None,
    candidates: dict[str, list[dict[str, Any]]],
    params: dict[str, Any],
    removed_names: list[str],
) -> dict[str, Any]:
    if not isinstance(routine, dict):
        return {}
    blacklist = _merge_unique_list(params.get("exclude_exercises", []), removed_names)
    days = routine.get("days") if isinstance(routine.get("days"), list) else []
    used_names = {
        _exercise_name(exercise)
        for exercise in _routine_exercises(routine)
        if not _is_exercise_name_excluded(_exercise_name(exercise), blacklist)
    }
    next_days = []
    for day in days:
        if not isinstance(day, dict):
            next_days.append(day)
            continue
        target = str(day.get("target") or "").strip().upper()
        next_exercises = []
        for exercise in day.get("exercises", []) or []:
            if not isinstance(exercise, dict):
                continue
            name = _exercise_name(exercise)
            if not _is_exercise_name_excluded(name, blacklist):
                next_exercises.append(exercise)
                continue
            replacement = _replacement_candidate_for_removed_exercise(
                target,
                candidates,
                blacklist,
                used_names,
                next_exercises,
            )
            if replacement:
                replacement_exercise = _exercise_from_candidate_row(replacement, exercise)
                next_exercises.append(replacement_exercise)
                used_names.add(replacement_exercise["name"])
        next_days.append({
            **day,
            "exercises": next_exercises,
        })
    return {
        **routine,
        "days": next_days,
    }


def _routine_exercises(routine: dict[str, Any] | None) -> list[dict[str, Any]]:
    days = routine.get("days") if isinstance(routine, dict) else []
    days = days if isinstance(days, list) else []
    return [
        exercise
        for day in days
        if isinstance(day, dict)
        for exercise in (day.get("exercises") or [])
        if isinstance(exercise, dict)
    ]


def _compact_text(value: Any) -> str:
    return str(value or "").strip().lower().replace(" ", "")


def _revision_removed_exercise_names(
    previous_routine: dict[str, Any] | None,
    current_routine: dict[str, Any] | None,
) -> list[str]:
    previous_days = previous_routine.get("days") if isinstance(previous_routine, dict) else []
    current_days = current_routine.get("days") if isinstance(current_routine, dict) else []
    previous_days = previous_days if isinstance(previous_days, list) else []
    current_days = current_days if isinstance(current_days, list) else []
    current_by_target = {
        str(day.get("target") or "").strip().upper(): day
        for day in current_days
        if isinstance(day, dict)
    }
    removed: list[str] = []
    for day_index, previous_day in enumerate(previous_days):
        if not isinstance(previous_day, dict):
            continue
        target = str(previous_day.get("target") or "").strip().upper()
        current_day = current_by_target.get(target)
        if current_day is None and day_index < len(current_days):
            current_day = current_days[day_index] if isinstance(current_days[day_index], dict) else {}
        current_exercises = current_day.get("exercises", []) if isinstance(current_day, dict) else []
        current_exercises = current_exercises if isinstance(current_exercises, list) else []
        for exercise_index, previous_exercise in enumerate(previous_day.get("exercises", []) or []):
            if not isinstance(previous_exercise, dict):
                continue
            previous_name = _exercise_name(previous_exercise)
            if not previous_name:
                continue
            current_name = ""
            if exercise_index < len(current_exercises) and isinstance(current_exercises[exercise_index], dict):
                current_name = _exercise_name(current_exercises[exercise_index])
            if previous_name != current_name and previous_name not in removed:
                removed.append(previous_name)
    return removed


def _replacement_candidate_for_removed_exercise(
    target: str,
    candidates: dict[str, list[dict[str, Any]]],
    blacklist: list[str],
    used_names: set[str],
    current_exercises: list[dict[str, Any]],
) -> dict[str, Any] | None:
    rows = candidates.get(target, [])
    existing_names = [exercise.get("name", "") for exercise in current_exercises]
    fallback = None
    for row in rows:
        name = str(row.get("name_kor") or row.get("name_eng") or row.get("id"))
        if not name or name in used_names or _is_exercise_name_excluded(name, blacklist):
            continue
        if not _is_repetitive_movement_name(name, existing_names):
            return row
        if fallback is None:
            fallback = row
    return fallback


def _exercise_from_candidate_row(
    row: dict[str, Any],
    template: dict[str, Any],
) -> dict[str, Any]:
    name = str(row.get("name_kor") or row.get("name_eng") or row.get("id"))
    return {
        **template,
        "name": name,
        "exercise_id": row.get("id"),
        "equipment": row.get("equipment"),
        "movement_family": movement_family(row),
        "target_primary": row.get("target_primary"),
        "tag": row.get("tag"),
        "reason": "이전 revision에서 제외된 운동을 재추천하지 않도록 대체했습니다.",
    }


def _is_exercise_name_excluded(name: str, exclusions: Any) -> bool:
    normalized_name = str(name or "").strip().lower()
    if not normalized_name:
        return False
    if isinstance(exclusions, str):
        exclusions = [exclusions]
    if not isinstance(exclusions, (list, tuple, set)):
        return False
    for exclusion in exclusions:
        normalized_exclusion = str(exclusion or "").strip().lower()
        if normalized_exclusion and (
            normalized_exclusion in normalized_name
            or normalized_name in normalized_exclusion
        ):
            return True
    return False


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
        elif key == "detail_focus_terms":
            merged[key] = _normalize_detail_focus_terms(value)
        else:
            merged[key] = value

    goal = str(merged.get("goal") or "").strip().lower()
    excluded_equipment = GOAL_EQUIPMENT_POLICY.get(goal, {}).get("excluded", set())
    merged["available_equipment"] = [
        item
        for item in normalize_equipment(merged.get("available_equipment"))
        if item not in excluded_equipment
    ]
    merged["required_exercises"] = {}
    merged["load_guidance"] = GOAL_LOAD_GUIDANCE.get(goal, "")
    merged["home_only"] = False
    return merged


def _clear_initial_required_exercises(params: dict[str, Any]) -> dict[str, Any]:
    """Human review revisions should not re-enforce initial expert defaults."""
    if not params:
        return {}
    return {
        **params,
        "required_exercises": {},
    }


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
    model_issues = list(validation.get("issues") or [])
    blocking_model_issues = [
        issue
        for issue in model_issues
        if isinstance(issue, dict) and issue.get("type") == "invalid_validation_output"
    ]
    model_warnings = [
        str(issue.get("message") or issue) if isinstance(issue, dict) else str(issue)
        for issue in model_issues
        if issue not in blocking_model_issues
    ]
    result = {
        **validation,
        "issues": blocking_model_issues,
        "safety_warnings": [
            *list(validation.get("safety_warnings") or []),
            *model_warnings,
        ],
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
    required_by_target = params.get("required_exercises") or {}
    allowed_equipment = set(normalize_equipment(params.get("available_equipment")))
    excluded_exercises = params.get("exclude_exercises") or []

    for target in expected_targets:
        day = days_by_target.get(target, {})
        exercises = day.get("exercises", []) if isinstance(day, dict) else []
        exercise_ids = {
            exercise.get("exercise_id") or exercise.get("id")
            for exercise in exercises
            if isinstance(exercise, dict)
        }
        required_policy = required_by_target.get(target)
        if required_policy and required_policy.get("id") not in exercise_ids:
            _add_validation_issue(
                result,
                "missing_required_exercise",
                f"{target} 분할에 전문가 정책 필수 운동이 누락되었습니다.",
                "목표별 필수 운동을 GraphDB에서 다시 조회해 해당 분할에 포함하세요.",
                risk_level="medium",
            )

        for exercise in exercises if isinstance(exercises, list) else []:
            if not isinstance(exercise, dict):
                continue
            name = _exercise_name(exercise)
            if _is_exercise_name_excluded(name, excluded_exercises):
                _add_validation_issue(
                    result,
                    "excluded_exercise_reused",
                    f"재추천 금지 운동 '{name}'이 다시 포함되었습니다.",
                    "사람 피드백 또는 이전 revision에서 제외된 운동은 다시 추천하지 마세요.",
                    risk_level="medium",
                )
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
            if row.get("equipment") and row.get("equipment") not in allowed_equipment:
                _add_validation_issue(
                    result,
                    "disallowed_equipment",
                    f"목표별 장비 정책에 맞지 않는 운동 '{name}'이 포함되었습니다.",
                    "현재 목표에서 허용된 장비의 GraphDB 후보로 대체하세요.",
                    risk_level="medium",
                )
            if low_spine_required and row.get("spine_loading") != "하":
                if row.get("expert_policy_required"):
                    _add_safety_warning(
                        result,
                        f"전문가 정책 필수 운동 '{name}'은 척추 부하가 낮지 않으므로 통증이 있으면 수행 전 전문가 확인이 필요합니다.",
                        risk_level="high",
                    )
                else:
                    _add_validation_issue(
                        result,
                        "non_low_spine_loading",
                        f"통증/부상/저부담 조건에서 척추 부하가 낮지 않은 운동 '{name}'이 포함되었습니다.",
                        "spine_loading이 '하'인 운동 후보로 대체하세요.",
                        risk_level="high",
                    )

        available_families = {
            movement_family(row)
            for row in candidates.get(target, [])
            if movement_family(row) != "other"
        }
        selected_families = {
            movement_family(
                candidate_index.get(target, {}).get(_exercise_name(exercise), exercise)
            )
            for exercise in exercises
            if isinstance(exercise, dict)
        }
        selected_families.discard("other")
        required_family_count = min(3, len(exercises), len(available_families))
        if required_family_count >= 2 and len(selected_families) < required_family_count:
            _add_validation_issue(
                result,
                "insufficient_movement_diversity",
                f"{target} 분할이 유사한 움직임 계열에 편중되어 있습니다.",
                "GraphDB 후보의 movement_family와 세부 타깃을 분산해 루틴을 다시 구성하세요.",
                risk_level="medium",
            )

    if _has_health_risk_context(state):
        _add_safety_warning(
            result,
            "부상 또는 통증 관련 조건을 반영해 루틴을 구성했지만, 현재 통증과 운동 가능 여부를 확인한 뒤 진행해야 합니다.",
            risk_level="medium",
        )

    result["is_valid"] = not result["issues"]
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
    return "루틴이 현재 추천 조건과 안전 기준을 만족합니다."


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
    normalized["place"] = "gym"
    normalized["home_only"] = False
    return normalized


def _required_profile_value(profile: dict[str, Any], key: str) -> Any:
    value = profile.get(key)
    if value is None or value == "" or value == []:
        raise ValueError(f"필수 설문 항목 '{key}' 값이 없어 추천을 진행할 수 없습니다.")
    return value
