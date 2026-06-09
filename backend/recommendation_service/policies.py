"""Survey-based recommendation policy constants."""

SENIOR_AGE_THRESHOLD = 50
LOW_SPINE_RISK_LEVELS = {"medium", "high"}

ALL_GYM_EQUIPMENT = [
    "barbell",
    "dumbbell",
    "machine",
    "body",
    "pull_up_bar",
    "band",
    "kettlebell",
]

GOAL_EQUIPMENT_POLICY = {
    "strength": {"excluded": {"body"}},
    "hypertrophy": {"excluded": {"body"}},
    "fat_loss": {"excluded": {"body"}},
    "health": {"excluded": {"barbell", "dumbbell", "kettlebell"}},
}

GOAL_LOAD_GUIDANCE = {
    "strength": "벤치 프레스 100kg 1RM을 기준 예시로 삼되, 실제 중량은 개인 1RM에 맞춰 조절합니다.",
    "hypertrophy": "벤치 프레스 기준 예시는 70~80kg, 6~8회이며 실제 중량은 수행 능력에 맞춰 조절합니다.",
    "fat_loss": "벤치 프레스 기준 예시는 50~60kg, 12~15회이며 실제 중량은 수행 능력에 맞춰 조절합니다.",
    "health": "덤벨, 바벨, 케틀벨을 제외하고 머신과 맨몸 운동을 중심으로 구성합니다.",
}

# Expert-reviewed compound lifts that must be present for strength and
# hypertrophy routines. IDs are stable GraphDB identifiers; exercise metadata
# is fetched from Neo4j at recommendation time.
MANDATORY_EXERCISES_BY_GOAL = {
    "strength": {
        "CHEST": {"id": 2001},
        "BACK": {"id": 1001},
        "LEG": {"id": 4001},
        "SHOULDER": {"id": 3001},
    },
    "hypertrophy": {
        "CHEST": {"id": 2001},
        "BACK": {"id": 1001},
        "LEG": {"id": 4001},
        "SHOULDER": {"id": 3001},
    },
}

SESSION_EXERCISE_COUNT_POLICY = {
    30: 4,
    45: 4,
    60: 4,
    90: 5,
}

# The graph query intentionally fetches a wider pool than the LLM receives so
# the service can remove near-duplicate movements before composing a routine.
GRAPH_SEARCH_POOL_LIMIT = 64
GRAPH_CANDIDATE_LIMIT_MAX = 12
GRAPH_MIN_CANDIDATES_PER_TARGET = 3
