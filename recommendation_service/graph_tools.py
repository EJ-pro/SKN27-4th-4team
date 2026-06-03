from typing import Any

from queries import GraphQuery

from .config import settings


SPLIT_TARGETS = ["CHEST", "BACK", "LEG", "SHOULDER", "ARM"]
DEFAULT_EQUIPMENT = ["barbell", "dumbbell", "machine", "body", "pull_up_bar", "band", "kettlebell"]


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
    home_only = bool(params.get("home_only", False))
    limit = min(int(params.get("candidate_limit_per_target", 8)), 8)

    candidates: dict[str, list[dict[str, Any]]] = {}
    insufficient: list[str] = []
    graph = GraphQuery(settings.neo4j_uri, settings.neo4j_user, settings.neo4j_password)
    try:
        for split_day in split_targets:
            rows = graph.get_exercises_by_split(
                split_day=split_day,
                spine=spine,
                equip=equipment,
                level=level,
                home_only=home_only,
                limit=limit,
            )
            candidates[split_day] = rows
            if len(rows) < 3:
                insufficient.append(split_day)
    finally:
        graph.close()
    return candidates, insufficient
