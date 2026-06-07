from typing import Any

from queries import GraphQuery

from .config import settings
from .policies import (
    ALL_GYM_EQUIPMENT,
    GRAPH_CANDIDATE_LIMIT_MAX,
    GRAPH_MIN_CANDIDATES_PER_TARGET,
    GRAPH_SEARCH_POOL_LIMIT,
    GOAL_EQUIPMENT_POLICY,
)


SPLIT_TARGETS = ["CHEST", "BACK", "LEG", "SHOULDER", "ARM"]
DEFAULT_EQUIPMENT = ALL_GYM_EQUIPMENT


def normalize_equipment(values: Any) -> list[str]:
    if not values:
        return DEFAULT_EQUIPMENT
    if isinstance(values, str):
        values = [values]

    aliases = {
        "bodyweight": "body",
        "body": "body",
        "barbell": "barbell",
        "dumbbell": "dumbbell",
        "dumbbells": "dumbbell",
        "machine": "machine",
        "machines": "machine",
        "cable": "machine",
        "band": "band",
        "pull-up bar": "pull_up_bar",
        "pull_up_bar": "pull_up_bar",
        "kettlebell": "kettlebell",
        "맨몸": "body",
        "바벨": "barbell",
        "덤벨": "dumbbell",
        "머신": "machine",
        "운동 머신": "machine",
        "밴드": "band",
        "풀업바": "pull_up_bar",
        "케틀벨": "kettlebell",
    }

    normalized = []
    for value in values:
        key = str(value).strip()
        item = aliases.get(key.lower(), aliases.get(key, key))
        if item not in normalized:
            normalized.append(item)
    return normalized or DEFAULT_EQUIPMENT


def normalize_split_targets(values: Any) -> list[str]:
    if not values:
        return SPLIT_TARGETS
    if isinstance(values, str):
        values = [values]

    aliases = {
        "chest": "CHEST",
        "back": "BACK",
        "leg": "LEG",
        "legs": "LEG",
        "shoulder": "SHOULDER",
        "shoulders": "SHOULDER",
        "arm": "ARM",
        "arms": "ARM",
        "가슴": "CHEST",
        "등": "BACK",
        "하체": "LEG",
        "어깨": "SHOULDER",
        "팔": "ARM",
    }

    normalized = []
    for value in values:
        key = str(value).strip()
        target = aliases.get(key.lower(), aliases.get(key, key.upper()))
        if target in SPLIT_TARGETS and target not in normalized:
            normalized.append(target)
    return normalized or SPLIT_TARGETS


def normalize_level(value: Any) -> str:
    if isinstance(value, list):
        value = value[0] if value else None
    text = str(value or "intermediate").strip().lower()
    aliases = {
        "beginner": "beginner",
        "intermediate": "intermediate",
        "advanced": "advanced",
        "초급": "beginner",
        "중급": "intermediate",
        "상급": "advanced",
    }
    return aliases.get(text, "intermediate")


def normalize_spine(value: Any) -> str:
    if isinstance(value, list):
        value = value[0] if value else None
    text = str(value or "all").strip().lower()
    aliases = {
        "all": "all",
        "mid": "mid",
        "low": "low",
        "전체": "all",
        "보통": "mid",
        "낮음": "low",
    }
    return aliases.get(text, "all")


def search_exercises(params: dict[str, Any]) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    split_targets = normalize_split_targets(params.get("split_targets"))
    level = normalize_level(params.get("level"))
    spine = normalize_spine(params.get("spine"))
    equipment = normalize_equipment(params.get("available_equipment"))
    limit = min(
        max(int(params.get("candidate_limit_per_target", GRAPH_CANDIDATE_LIMIT_MAX)), 1),
        GRAPH_CANDIDATE_LIMIT_MAX,
    )
    pool_limit = max(GRAPH_SEARCH_POOL_LIMIT, limit * 2)
    goal = str(params.get("goal") or "").strip().lower()
    intensity_bias = str(params.get("intensity_bias") or "").strip().lower()
    excluded_names = _normalized_excluded_names(params.get("exclude_exercises"))
    relationship_seed_ids = params.get("relationship_seed_ids_by_target") or {}
    excluded_equipment = GOAL_EQUIPMENT_POLICY.get(goal, {}).get("excluded", set())
    equipment = [item for item in equipment if item not in excluded_equipment]

    candidates: dict[str, list[dict[str, Any]]] = {}
    insufficient: list[str] = []
    graph = GraphQuery(settings.neo4j_uri, settings.neo4j_user, settings.neo4j_password)
    try:
        required_by_target = params.get("required_exercises") or {}
        required_rows = graph.get_exercises_by_ids([
            policy["id"]
            for target, policy in required_by_target.items()
            if target in split_targets
        ])
        required_row_by_id = {row.get("id"): row for row in required_rows}

        for split_day in split_targets:
            base_rows = graph.get_exercises_by_split(
                split_day=split_day,
                spine=spine,
                equip=equipment,
                level=level,
                home_only=False,
                limit=pool_limit,
            )
            rows = [
                _annotate_candidate(row, "split_filter")
                for row in base_rows
                if not _is_excluded_candidate(row, excluded_names)
            ]
            seed_ids = _normalize_seed_ids(relationship_seed_ids.get(split_day))
            if seed_ids:
                substitute_rows = [
                    _annotate_candidate(row, "substitute_relation")
                    for row in graph.get_related_exercises(
                        exercise_ids=seed_ids,
                        relationship_type="SUBSTITUTE_FOR",
                        split_day=split_day,
                        spine=spine,
                        equip=equipment,
                        level=level,
                        limit=pool_limit,
                    )
                    if not _is_excluded_candidate(row, excluded_names)
                ]
                rows = [*substitute_rows, *rows]

            progression_seed_ids = _unique_ids([
                *seed_ids,
                *[row.get("id") for row in rows[:6]],
            ])
            if progression_seed_ids and (
                goal == "strength"
                or intensity_bias in {"high", "higher", "high_intensity", "increased"}
            ):
                progression_rows = [
                    _annotate_candidate(row, "progression_relation")
                    for row in graph.get_related_exercises(
                        exercise_ids=progression_seed_ids,
                        relationship_type="PROGRESSION_OF",
                        split_day=split_day,
                        spine=spine,
                        equip=equipment,
                        level=level,
                        limit=pool_limit,
                    )
                    if not _is_excluded_candidate(row, excluded_names)
                ]
                rows = [*progression_rows, *rows]

            rows = _deduplicate_candidates(rows)
            if len(rows) < limit:
                similar_seed_ids = _unique_ids([
                    *seed_ids,
                    *[row.get("id") for row in rows[:6]],
                ])
                if similar_seed_ids:
                    rows.extend(
                        _annotate_candidate(row, "similar_relation")
                        for row in graph.get_related_exercises(
                            exercise_ids=similar_seed_ids,
                            relationship_type="SIMILAR_TO",
                            split_day=split_day,
                            spine=spine,
                            equip=equipment,
                            level=level,
                            limit=pool_limit,
                        )
                        if not _is_excluded_candidate(row, excluded_names)
                    )
                    rows = _deduplicate_candidates(rows)

            if goal == "health" and not any(row.get("equipment") == "body" for row in rows):
                bodyweight_rows = graph.get_exercises_by_split(
                    split_day=split_day,
                    spine=spine,
                    equip=["body"],
                    level=level,
                    home_only=False,
                    limit=1,
                )
                rows = [
                    *rows,
                    *[
                        _annotate_candidate(row, "health_bodyweight_policy")
                        for row in bodyweight_rows
                        if row.get("id") not in {item.get("id") for item in rows}
                        and not _is_excluded_candidate(row, excluded_names)
                    ],
                ]
            sorted_rows = _sort_rows_for_goal(rows, goal)
            required_policy = required_by_target.get(split_day)
            required_row = None
            if required_policy:
                required_row = required_row_by_id.get(required_policy["id"])
                if required_row:
                    required_row = _annotate_candidate({
                        **required_row,
                        "expert_policy_required": True,
                    }, "expert_required")
                    sorted_rows = [
                        required_row,
                        *[
                            row for row in sorted_rows
                            if row.get("id") != required_row.get("id")
                        ],
                    ]
                elif split_day not in insufficient:
                    insufficient.append(split_day)
            sorted_rows = _diversify_candidates(
                _deduplicate_candidates(sorted_rows),
                limit=limit,
                required_id=required_row.get("id") if required_row else None,
            )
            candidates[split_day] = sorted_rows
            if len(sorted_rows) < GRAPH_MIN_CANDIDATES_PER_TARGET and split_day not in insufficient:
                insufficient.append(split_day)
    finally:
        graph.close()
    return candidates, insufficient


def _sort_rows_for_goal(rows: list[dict[str, Any]], goal: str) -> list[dict[str, Any]]:
    if goal == "fat_loss":
        return sorted(rows, key=lambda row: _float_value(row.get("cal_per_min")), reverse=True)

    if goal == "strength":
        equipment_rank = {"barbell": 0, "dumbbell": 1, "machine": 2, "body": 3}
        return sorted(
            rows,
            key=lambda row: (
                equipment_rank.get(str(row.get("equipment") or ""), 9),
                -_difficulty_value(row),
            ),
        )

    if goal == "health":
        equipment_rank = {"machine": 0, "body": 1, "band": 2, "dumbbell": 3, "barbell": 4}
        spine_rank = {"하": 0, "low": 0, "저": 0, "중": 1, "mid": 1, "상": 2, "high": 2}
        return sorted(
            rows,
            key=lambda row: (
                equipment_rank.get(str(row.get("equipment") or ""), 9),
                spine_rank.get(str(row.get("spine_loading") or ""), 1),
                _difficulty_value(row),
            ),
        )

    if goal == "hypertrophy":
        equipment_rank = {"machine": 0, "dumbbell": 1, "barbell": 2, "body": 3}
        return sorted(
            rows,
            key=lambda row: (
                equipment_rank.get(str(row.get("equipment") or ""), 9),
                abs(_difficulty_value(row) - 2),
            ),
        )

    return rows


def movement_family(row_or_name: dict[str, Any] | str) -> str:
    if isinstance(row_or_name, dict):
        existing = str(row_or_name.get("movement_family") or "").strip()
        if existing:
            return existing
        text = " ".join(
            str(row_or_name.get(key) or "")
            for key in ("name_kor", "name_eng", "tag")
        ).lower()
    else:
        text = str(row_or_name or "").lower()

    groups = [
        ("hinge", ("데드리프트", "굿모닝", "deadlift", "good morning", "hip hinge")),
        ("squat_lunge", ("스쿼트", "런지", "레그 프레스", "squat", "lunge", "leg press")),
        ("fly", ("플라이", "펙덱", "크로스오버", "fly", "pec deck", "crossover", "cross over")),
        ("vertical_pull", ("풀다운", "풀 업", "풀업", "친 업", "친업", "pulldown", "pull down", "pull-up", "pullup", "chin-up")),
        ("horizontal_pull", ("페이스 풀", "로우", "face pull", "row")),
        ("press", ("프레스", "푸쉬", "푸시", "딥스", "press", "push", "dip")),
        ("curl", ("컬", "curl")),
        ("extension", ("익스텐션", "푸쉬다운", "푸시다운", "extension", "pushdown")),
        ("raise", ("레이즈", "raise")),
        ("abduction_adduction", ("어브덕션", "어덕션", "abduction", "adduction")),
        ("calf", ("카프", "calf")),
        ("core", ("플랭크", "크런치", "싯업", "코어", "plank", "crunch", "sit-up", "core")),
    ]
    for family, keywords in groups:
        if any(keyword in text for keyword in keywords):
            return family
    return "other"


def _annotate_candidate(row: dict[str, Any], source: str) -> dict[str, Any]:
    annotated = {
        **row,
        "candidate_source": row.get("candidate_source") or source,
    }
    annotated["movement_family"] = movement_family(annotated)
    return annotated


def _diversify_candidates(
    rows: list[dict[str, Any]],
    limit: int,
    required_id: int | None = None,
) -> list[dict[str, Any]]:
    if not rows or limit <= 0:
        return []

    indexed = list(enumerate(rows))
    selected: list[dict[str, Any]] = []
    if required_id is not None:
        required = next((row for row in rows if row.get("id") == required_id), None)
        if required:
            selected.append(required)
            indexed = [(index, row) for index, row in indexed if row.get("id") != required_id]

    while indexed and len(selected) < limit:
        family_counts = {
            family: sum(1 for row in selected if movement_family(row) == family)
            for family in {movement_family(row) for row in selected}
        }
        target_counts = {
            target: sum(1 for row in selected if _candidate_primary_target(row) == target)
            for target in {_candidate_primary_target(row) for row in selected}
            if target
        }
        used_families = set(family_counts)
        used_targets = set(target_counts)
        used_equipment = {str(row.get("equipment") or "") for row in selected}

        def diversity_score(item: tuple[int, dict[str, Any]]) -> tuple[int, int, int, int, int, int]:
            index, row = item
            family = movement_family(row)
            primary_target = _candidate_primary_target(row)
            return (
                int(family not in used_families),
                int(bool(primary_target) and primary_target not in used_targets),
                -family_counts.get(family, 0),
                -target_counts.get(primary_target, 0),
                int(str(row.get("equipment") or "") not in used_equipment),
                -index,
            )

        _, chosen = max(indexed, key=diversity_score)
        selected.append(chosen)
        indexed = [(index, row) for index, row in indexed if row.get("id") != chosen.get("id")]

    return selected


def _candidate_primary_target(row: dict[str, Any]) -> str:
    primary = str(row.get("target_primary") or "").strip().lower()
    if primary:
        return primary
    body_parts = row.get("primary_body_parts") or []
    return str(body_parts[0]).strip().lower() if body_parts else ""


def _deduplicate_candidates(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[Any] = set()
    unique = []
    for row in rows:
        identifier = row.get("id")
        key = identifier if identifier is not None else (
            str(row.get("name_kor") or "").strip().lower(),
            str(row.get("name_eng") or "").strip().lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def _normalized_excluded_names(values: Any) -> list[str]:
    if not values:
        return []
    if isinstance(values, str):
        values = [values]
    return [
        str(value).strip().lower()
        for value in values
        if str(value).strip()
    ]


def _is_excluded_candidate(row: dict[str, Any], excluded_names: list[str]) -> bool:
    if not excluded_names:
        return False
    names = " ".join(
        str(row.get(key) or "").strip().lower()
        for key in ("name_kor", "name_eng")
    )
    return any(excluded in names for excluded in excluded_names)


def _normalize_seed_ids(values: Any) -> list[int]:
    if not values:
        return []
    if not isinstance(values, (list, tuple, set)):
        values = [values]
    normalized = []
    for value in values:
        try:
            identifier = int(value)
        except (TypeError, ValueError):
            continue
        if identifier not in normalized:
            normalized.append(identifier)
    return normalized


def _unique_ids(values: list[Any]) -> list[int]:
    return _normalize_seed_ids(values)


def _float_value(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _difficulty_value(row: dict[str, Any]) -> int:
    try:
        return int(row.get("difficulty") or 2)
    except (TypeError, ValueError):
        label = str(row.get("difficulty_label") or "").lower()
        return {"beginner": 1, "intermediate": 2, "advanced": 3}.get(label, 2)
