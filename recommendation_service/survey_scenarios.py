"""Survey examples that can be converted into GraphDB search parameters.

These examples mirror the frontend onboarding fields and are intentionally
plain dictionaries so they can be reused by docs, tests, or a future API layer.
"""

from typing import Any

from .graph_tools import normalize_equipment, normalize_level
from .policies import ALL_GYM_EQUIPMENT


GOAL_MAP = {
    "hypertrophy": "hypertrophy",
    "strength": "strength",
    "diet": "fat_loss",
    "fat_loss": "fat_loss",
    "maintenance": "health",
    "health": "health",
}

PART_TO_SPLIT = {
    "가슴": "CHEST",
    "등": "BACK",
    "하체": "LEG",
    "어깨": "SHOULDER",
    "팔": "ARM",
    "팔/코어": "ARM",
    "이두": "ARM",
    "삼두": "ARM",
    "전완근": "ARM",
}


SURVEY_SCENARIOS: list[dict[str, Any]] = [
    {
        "id": "gym_intermediate_hypertrophy_no_pain",
        "description": "체육관, 중급, 통증 없음, 근비대 5분할",
        "survey": {
            "age": 28,
            "gender": "male",
            "level": "intermediate",
            "pain_parts": ["none"],
            "place": "gym",
            "available_equipment": list(ALL_GYM_EQUIPMENT),
            "split_style": "bodybuilding",
            "work_days": ["월", "화", "수", "목", "금"],
            "day_parts": {"월": "가슴", "화": "등", "수": "하체", "목": "어깨", "금": "팔/코어"},
            "goal": "hypertrophy",
            "session_min": 60,
        },
        "expected_params": {
            "home_only": False,
            "level": "intermediate",
            "goal": "hypertrophy",
            "spine": "all",
        },
    },
    {
        "id": "gym_beginner_female_knee_health",
        "description": "체육관, 여성 초급, 무릎 통증, 체력 유지",
        "survey": {
            "age": 34,
            "gender": "female",
            "level": "beginner",
            "pain_parts": ["knee"],
            "place": "gym",
            "available_equipment": list(ALL_GYM_EQUIPMENT),
            "split_style": "lower_core",
            "work_days": ["월", "화", "목", "금"],
            "day_parts": {"월": "하체", "화": "등", "목": "어깨", "금": "팔/코어"},
            "goal": "maintenance",
            "session_min": 45,
        },
        "expected_params": {
            "home_only": False,
            "level": "beginner",
            "goal": "health",
            "spine": "low",
        },
    },
    {
        "id": "gym_senior_female_lower_back_health",
        "description": "체육관, 고령 여성, 허리 통증, 저부하 건강 루틴",
        "survey": {
            "age": 67,
            "gender": "female",
            "level": "beginner",
            "pain_parts": ["lower_back"],
            "place": "gym",
            "available_equipment": list(ALL_GYM_EQUIPMENT),
            "split_style": "lower_core",
            "work_days": ["월", "수", "금"],
            "day_parts": {"월": "하체", "수": "어깨", "금": "등"},
            "goal": "health",
            "session_min": 30,
        },
        "expected_params": {
            "home_only": False,
            "level": "beginner",
            "goal": "health",
            "spine": "low",
        },
    },
    {
        "id": "gym_advanced_strength_no_pain",
        "description": "체육관, 상급, 통증 없음, 스트렝스",
        "survey": {
            "age": 35,
            "gender": "male",
            "level": "advanced",
            "pain_parts": ["none"],
            "place": "gym",
            "available_equipment": list(ALL_GYM_EQUIPMENT),
            "split_style": "strength",
            "work_days": ["월", "화", "목", "금", "토"],
            "day_parts": {"월": "하체", "화": "가슴", "목": "등", "금": "어깨", "토": "하체"},
            "goal": "strength",
            "session_min": 90,
        },
        "expected_params": {
            "home_only": False,
            "level": "advanced",
            "goal": "strength",
            "spine": "all",
        },
    },
    {
        "id": "gym_intermediate_female_wrist_diet",
        "description": "체육관, 여성 중급, 손목 통증, 다이어트",
        "survey": {
            "age": 26,
            "gender": "female",
            "level": "intermediate",
            "pain_parts": ["wrist"],
            "place": "gym",
            "available_equipment": list(ALL_GYM_EQUIPMENT),
            "split_style": "bodybuilding",
            "work_days": ["월", "화", "수", "목", "금"],
            "day_parts": {"월": "가슴", "화": "등", "수": "하체", "목": "어깨", "금": "팔/코어"},
            "goal": "diet",
            "session_min": 60,
        },
        "expected_params": {
            "home_only": False,
            "level": "intermediate",
            "goal": "fat_loss",
            "spine": "low",
        },
    },
]


def survey_to_user_profile(survey: dict[str, Any]) -> dict[str, Any]:
    pain_parts = [part for part in survey.get("pain_parts", []) if part and part != "none"]
    goal = GOAL_MAP.get(str(survey.get("goal", "")).strip().lower(), survey.get("goal"))
    level = survey.get("level")
    equipment = survey.get("available_equipment") or []
    work_days = list(survey.get("work_days") or [])
    split_targets = _split_targets_from_day_parts(work_days, survey.get("day_parts", {}))

    return {
        "age": survey.get("age"),
        "gender": survey.get("gender"),
        "level": normalize_level(level) if level else None,
        "goal": goal,
        "available_days": len(work_days),
        "work_days": work_days,
        "day_parts": survey.get("day_parts", {}),
        "split_targets": split_targets,
        "split_style": survey.get("split_style"),
        "session_min": survey.get("session_min"),
        "place": "gym",
        "home_only": False,
        "available_equipment": normalize_equipment(equipment) if equipment else [],
        "injuries": [],
        "pain_points": pain_parts,
        "spine": "low" if pain_parts else "all",
        "intensity_bias": _initial_intensity_bias(survey),
    }


def _split_targets_from_day_parts(work_days: list[str], day_parts: dict[str, str]) -> list[str]:
    targets = []
    for day in work_days:
        target = PART_TO_SPLIT.get(day_parts.get(day, ""))
        if target and target not in targets:
            targets.append(target)
    return targets


def _initial_intensity_bias(survey: dict[str, Any]) -> str:
    gender = str(survey.get("gender") or "").strip().lower()
    return "slightly_conservative" if gender == "female" else "standard"
