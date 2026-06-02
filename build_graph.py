"""
Planfit 5분할 그래프 DB 구축 스크립트
────────────────────────────────────────
입력 파일:
  planfit_exercises_enriched.json  ← 노드 데이터 (969개)
  exercise_edges.json              ← SUBSTITUTE_FOR 엣지 (3,170개)

실행:
  pip install neo4j python-dotenv
  python build_graph.py

.env:
  NEO4J_URI=bolt://localhost:7687
  NEO4J_USER=neo4j
  NEO4J_PASSWORD=your-password
"""

import json
import re
import os
from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()

# ── 설정 ────────────────────────────────────────────────────────────────────
ENRICHED_PATH = "./backend/data/planfit_exercises_enriched.json"
EDGES_PATH    = "./backend/data/exercise_edges.json"

NEO4J_URI      = os.getenv("NEO4J_URI")
NEO4J_USER     = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

# 5분할 카테고리 → split_day 매핑
SPLIT_MAP = {
    "가슴":   "CHEST",
    "등":     "BACK",
    "하체":   "LEG",
    "어깨":   "SHOULDER",
    "이두":   "ARM",
    "삼두":   "ARM",
    "전완근": "ARM",
}

# 분할별 기본 cal/분 (enriched estimated_cal_per_min 없을 때 폴백)
CAL_BASE = {
    "CHEST":    5.2,
    "BACK":     5.2,
    "LEG":      6.4,
    "SHOULDER": 4.7,
    "ARM":      4.1,
}

# ── 정적 노드 정의 ───────────────────────────────────────────────────────────
BODY_PARTS = [
    {"id": "bp_chest",     "name_ko": "가슴",    "name_en": "Chest",       "category": "UPPER",
     "primary_muscles": ["대흉근", "대흉근(상부)", "대흉근(하부)", "소흉근"]},
    {"id": "bp_back",      "name_ko": "등",      "name_en": "Back",        "category": "UPPER",
     "primary_muscles": ["광배근", "척추기립근", "능형근", "승모근"]},
    {"id": "bp_lower",     "name_ko": "하체",    "name_en": "Lower Body",  "category": "LOWER",
     "primary_muscles": ["대퇴사두근", "햄스트링", "둔근", "비복근"]},
    {"id": "bp_shoulder",  "name_ko": "어깨",    "name_en": "Shoulder",    "category": "UPPER",
     "primary_muscles": ["삼각근", "삼각근(전면)", "삼각근(측면)", "삼각근(후면)", "승모근"]},
    {"id": "bp_biceps",    "name_ko": "이두",    "name_en": "Biceps",      "category": "UPPER",
     "primary_muscles": ["상완이두근", "이두근"]},
    {"id": "bp_triceps",   "name_ko": "삼두",    "name_en": "Triceps",     "category": "UPPER",
     "primary_muscles": ["삼두근", "상완삼두근"]},
    {"id": "bp_forearm",   "name_ko": "전완근",  "name_en": "Forearm",     "category": "UPPER",
     "primary_muscles": ["전완굴근", "전완신근"]},
    {"id": "bp_core",      "name_ko": "코어",    "name_en": "Core",        "category": "CORE",
     "primary_muscles": ["복직근", "외복사근", "내복사근", "횡복근", "코어"]},
    {"id": "bp_glute",     "name_ko": "둔근",    "name_en": "Glute",       "category": "LOWER",
     "primary_muscles": ["대둔근", "중둔근", "소둔근", "둔근"]},
    {"id": "bp_hamstring", "name_ko": "햄스트링","name_en": "Hamstring",   "category": "LOWER",
     "primary_muscles": ["대퇴이두근", "반건양근", "반막양근", "햄스트링"]},
]

EQUIPMENT = [
    {"id": "eq_barbell",    "name_ko": "바벨",      "raw": "barbell",     "type": "FREE_WEIGHT",  "gym_required": True},
    {"id": "eq_dumbbell",   "name_ko": "덤벨",      "raw": "dumbbell",    "type": "FREE_WEIGHT",  "gym_required": False},
    {"id": "eq_machine",    "name_ko": "운동 머신", "raw": "machine",     "type": "MACHINE",      "gym_required": True},
    {"id": "eq_body",       "name_ko": "맨몸",      "raw": "body",        "type": "BODYWEIGHT",   "gym_required": False},
    {"id": "eq_pullupbar",  "name_ko": "풀업바",    "raw": "pull_up_bar", "type": "BODYWEIGHT",   "gym_required": False},
    {"id": "eq_band",       "name_ko": "저항 밴드", "raw": "band",        "type": "BAND",         "gym_required": False},
    {"id": "eq_kettlebell", "name_ko": "케틀벨",    "raw": "kettlebell",  "type": "FREE_WEIGHT",  "gym_required": False},
    {"id": "eq_normal",     "name_ko": "기타",      "raw": "normal",      "type": "OTHER",        "gym_required": False},
]

INTENSITY_LEVELS = [
    {"level": "LOW",       "cal_min": 1.8, "cal_max": 3.5},
    {"level": "MEDIUM",    "cal_min": 3.5, "cal_max": 5.1},
    {"level": "HIGH",      "cal_min": 5.2, "cal_max": 6.3},
    {"level": "VERY_HIGH", "cal_min": 6.4, "cal_max": 15.0},
]

SPLIT_DAYS = [
    {"id": "sd_chest",    "name": "가슴", "split_day": "CHEST",    "order": 1, "weekday": "월"},
    {"id": "sd_back",     "name": "등",   "split_day": "BACK",     "order": 2, "weekday": "화"},
    {"id": "sd_leg",      "name": "하체", "split_day": "LEG",      "order": 3, "weekday": "수"},
    {"id": "sd_shoulder", "name": "어깨", "split_day": "SHOULDER", "order": 4, "weekday": "목"},
    {"id": "sd_arm",      "name": "팔",   "split_day": "ARM",      "order": 5, "weekday": "금"},
]

# 팔 날 슈퍼셋 쌍 (이두 ID → 삼두 ID)
ARM_SUPERSET_PAIRS = [
    (7001, 6002),
    (7005, 6003),
    (7006, 6004),
    (7008, 6002),
]

# ── 유틸 ────────────────────────────────────────────────────────────────────
def get_bp_id(target: str) -> str | None:
    if not target:
        return None
    for bp in BODY_PARTS:
        if any(m in target for m in bp["primary_muscles"]):
            return bp["id"]
    return None

def get_eq_id(raw: str) -> str:
    for eq in EQUIPMENT:
        if eq["raw"] == raw:
            return eq["id"]
    return "eq_normal"

def get_intensity(cal: float) -> str:
    if cal <= 3.5:  return "LOW"
    if cal <= 5.1:  return "MEDIUM"
    if cal <= 6.3:  return "HIGH"
    return "VERY_HIGH"

def parse_related(s: str) -> list[int]:
    return [int(m) for m in re.findall(r'(\d+)\(', s or "")]


# ── 빌더 ────────────────────────────────────────────────────────────────────
class GraphBuilder:
    def __init__(self, uri, user, pw):
        self.driver = GraphDatabase.driver(uri, auth=(user, pw))

    def close(self):
        self.driver.close()

    def run(self, cypher, params=None):
        with self.driver.session() as s:
            s.run(cypher, params or {})

    def run_many(self, cypher, rows):
        with self.driver.session() as s:
            for row in rows:
                s.run(cypher, row)

    # ── 0. 초기화 ─────────────────────────────────────────────────────────
    def clear_all(self):
        print("  [0] DB 초기화...")
        self.run("MATCH (n) DETACH DELETE n")

    # ── 1. 인덱스 ─────────────────────────────────────────────────────────
    def create_indexes(self):
        print("  [1] 인덱스 생성...")
        for cypher in [
            "CREATE INDEX ex_id      IF NOT EXISTS FOR (e:Exercise)      ON (e.id)",
            "CREATE INDEX ex_split   IF NOT EXISTS FOR (e:Exercise)      ON (e.split_day)",
            "CREATE INDEX ex_spine   IF NOT EXISTS FOR (e:Exercise)      ON (e.spine_loading)",
            "CREATE INDEX ex_equip   IF NOT EXISTS FOR (e:Exercise)      ON (e.equipment)",
            "CREATE INDEX ex_place   IF NOT EXISTS FOR (e:Exercise)      ON (e.place_type)",
            "CREATE INDEX bp_id      IF NOT EXISTS FOR (b:BodyPart)      ON (b.id)",
            "CREATE INDEX eq_id      IF NOT EXISTS FOR (q:Equipment)     ON (q.id)",
            "CREATE INDEX il_level   IF NOT EXISTS FOR (i:IntensityLevel)ON (i.level)",
            "CREATE INDEX sd_split   IF NOT EXISTS FOR (s:SplitDay)      ON (s.split_day)",
        ]:
            self.run(cypher)

    # ── 2. 정적 노드 ──────────────────────────────────────────────────────
    def create_static_nodes(self):
        print("  [2] BodyPart 노드 생성...")
        self.run_many("""
            MERGE (b:BodyPart {id: $id})
            SET b.name_ko = $name_ko, b.name_en = $name_en,
                b.category = $category, b.primary_muscles = $primary_muscles
        """, BODY_PARTS)

        print("  [3] Equipment 노드 생성...")
        self.run_many("""
            MERGE (q:Equipment {id: $id})
            SET q.name_ko = $name_ko, q.raw = $raw,
                q.type = $type, q.gym_required = $gym_required
        """, EQUIPMENT)

        print("  [4] IntensityLevel 노드 생성...")
        self.run_many("""
            MERGE (i:IntensityLevel {level: $level})
            SET i.cal_min = $cal_min, i.cal_max = $cal_max
        """, INTENSITY_LEVELS)

        print("  [5] SplitDay 노드 생성...")
        self.run_many("""
            MERGE (s:SplitDay {split_day: $split_day})
            SET s.id = $id, s.name = $name,
                s.order = $order, s.weekday = $weekday
        """, SPLIT_DAYS)

    # ── 3. Exercise 노드 ──────────────────────────────────────────────────
    def create_exercises(self, data: list[dict]):
        print(f"  [6] Exercise 노드 생성... ({len(data)}개)")
        rows = []
        for d in data:
            split_day = SPLIT_MAP.get(d["category"])
            if not split_day:
                continue
            rows.append({
                "id":               d["id"],
                "name_kor":         d["name_kor"],
                "name_eng":         d["name_eng"],
                "slug":             d.get("slug", ""),
                "category":         d["category"],
                "split_day":        split_day,
                "equipment":        d.get("equipment", "normal"),
                "difficulty":       d.get("difficulty", 1),
                "difficulty_label": d.get("difficulty_label", "beginner"),
                "target_primary":   d.get("target_primary", ""),
                "target_secondary": d.get("target_secondary") or [],
                "cal_per_min":      d.get("estimated_cal_per_min") or CAL_BASE.get(split_day, 5.0),
                "duration_min":     d.get("default_duration_min", 15),
                "spine_loading":    d.get("spine_loading", "중"),
                "place_type":       d.get("place_type", "gym"),
                "home_friendly":    d.get("home_friendly", "N"),
                "tag":              d.get("tag", ""),
                "description":      d.get("description", ""),
                "video_url":        d.get("video_url", ""),
                "image_url":        d.get("image_url", ""),
            })

        self.run_many("""
            MERGE (e:Exercise {id: $id})
            SET e.name_kor         = $name_kor,
                e.name_eng         = $name_eng,
                e.slug             = $slug,
                e.category         = $category,
                e.split_day        = $split_day,
                e.equipment        = $equipment,
                e.difficulty       = $difficulty,
                e.difficulty_label = $difficulty_label,
                e.target_primary   = $target_primary,
                e.target_secondary = $target_secondary,
                e.cal_per_min      = $cal_per_min,
                e.duration_min     = $duration_min,
                e.spine_loading    = $spine_loading,
                e.place_type       = $place_type,
                e.home_friendly    = $home_friendly,
                e.tag              = $tag,
                e.description      = $description,
                e.video_url        = $video_url,
                e.image_url        = $image_url
        """, rows)

    # ── 4. TARGETS 엣지 ───────────────────────────────────────────────────
    def create_targets_edges(self, data: list[dict]):
        print("  [7] TARGETS_PRIMARY / TARGETS_SECONDARY 엣지 생성...")
        for d in data:
            if d["category"] not in SPLIT_MAP:
                continue
            # Primary
            bp_id = get_bp_id(d.get("target_primary", ""))
            if bp_id:
                self.run("""
                    MATCH (e:Exercise {id: $id})
                    MATCH (b:BodyPart {id: $bp_id})
                    MERGE (e)-[:TARGETS_PRIMARY]->(b)
                """, {"id": d["id"], "bp_id": bp_id})
            # Secondary (배열)
            for sec in (d.get("target_secondary") or []):
                sec_id = get_bp_id(sec)
                if sec_id and sec_id != bp_id:
                    self.run("""
                        MATCH (e:Exercise {id: $id})
                        MATCH (b:BodyPart {id: $bp_id})
                        MERGE (e)-[:TARGETS_SECONDARY]->(b)
                    """, {"id": d["id"], "bp_id": sec_id})

    # ── 5. REQUIRES_EQUIPMENT 엣지 ────────────────────────────────────────
    def create_equipment_edges(self, data: list[dict]):
        print("  [8] REQUIRES_EQUIPMENT 엣지 생성...")
        rows = [
            {"id": d["id"], "eq_id": get_eq_id(d.get("equipment", "normal"))}
            for d in data if d["category"] in SPLIT_MAP
        ]
        self.run_many("""
            MATCH (e:Exercise {id: $id})
            MATCH (q:Equipment {id: $eq_id})
            MERGE (e)-[:REQUIRES_EQUIPMENT]->(q)
        """, rows)

    # ── 6. HAS_INTENSITY 엣지 ─────────────────────────────────────────────
    def create_intensity_edges(self, data: list[dict]):
        print("  [9] HAS_INTENSITY 엣지 생성...")
        rows = [
            {"id": d["id"], "level": get_intensity(d.get("estimated_cal_per_min") or 5.0)}
            for d in data if d["category"] in SPLIT_MAP
        ]
        self.run_many("""
            MATCH (e:Exercise {id: $id})
            MATCH (i:IntensityLevel {level: $level})
            MERGE (e)-[:HAS_INTENSITY]->(i)
        """, rows)

    # ── 7. PART_OF_SPLIT 엣지 ─────────────────────────────────────────────
    def create_split_edges(self, data: list[dict]):
        print("  [10] PART_OF_SPLIT 엣지 생성...")
        rows = [
            {
                "id":           d["id"],
                "split_day":    SPLIT_MAP[d["category"]],
                "sets":         3,
                "reps":         "10",
                "duration_min": d.get("default_duration_min", 15),
            }
            for d in data if d["category"] in SPLIT_MAP
        ]
        self.run_many("""
            MATCH (e:Exercise {id: $id})
            MATCH (s:SplitDay {split_day: $split_day})
            MERGE (e)-[:PART_OF_SPLIT {
                sets: $sets,
                reps: $reps,
                duration_min: $duration_min
            }]->(s)
        """, rows)

    # ── 8. SIMILAR_TO 엣지 (related_exercises 파싱) ───────────────────────
    def create_similar_edges(self, data: list[dict]):
        print("  [11] SIMILAR_TO 엣지 생성 (related_exercises)...")
        all_ids = {d["id"] for d in data}
        five_ids = {d["id"] for d in data if d["category"] in SPLIT_MAP}
        count = 0
        for d in data:
            if d["category"] not in SPLIT_MAP:
                continue
            for rid in parse_related(d.get("related_exercises", "")):
                if rid in all_ids and rid != d["id"]:
                    self.run("""
                        MATCH (a:Exercise {id: $src})
                        MATCH (b:Exercise {id: $dst})
                        MERGE (a)-[:SIMILAR_TO {score: 1.0, basis: 'planfit_related'}]->(b)
                        MERGE (b)-[:SIMILAR_TO {score: 1.0, basis: 'planfit_related'}]->(a)
                    """, {"src": d["id"], "dst": rid})
                    count += 1
        print(f"       → {count}개 생성")

    # ── 9. SUBSTITUTE_FOR 엣지 (exercise_edges.json 직접 사용) ───────────
    def create_substitute_edges(self, edges: list[dict], valid_ids: set[int]):
        print(f"  [12] SUBSTITUTE_FOR 엣지 생성... ({len(edges)}개 원본)")
        five_edges = [
            e for e in edges
            if e["from"] in valid_ids and e["to"] in valid_ids
        ]
        print(f"       → 5분할 내 엣지: {len(five_edges)}개")
        self.run_many("""
            MATCH (a:Exercise {id: $from})
            MATCH (b:Exercise {id: $to})
            MERGE (a)-[:SUBSTITUTE_FOR {
                from_place:  $from_place,
                to_place:    $to_place,
                same_place:  $same_place
            }]->(b)
        """, five_edges)

    # ── 10. PROGRESSION_OF 엣지 (difficulty 기반) ─────────────────────────
    def create_progression_edges(self, data: list[dict]):
        print("  [13] PROGRESSION_OF 엣지 생성...")
        DIFF_RANK = {"beginner": 0, "intermediate": 1, "advanced": 2}
        by_key: dict[tuple, list] = {}
        for d in data:
            sd = SPLIT_MAP.get(d["category"])
            if not sd:
                continue
            key = (sd, get_bp_id(d.get("target_primary", "")))
            by_key.setdefault(key, []).append(d)

        count = 0
        for exercises in by_key.values():
            sorted_ex = sorted(
                exercises,
                key=lambda x: DIFF_RANK.get(x.get("difficulty_label", "beginner"), 0)
            )
            for i in range(len(sorted_ex) - 1):
                a, b = sorted_ex[i], sorted_ex[i + 1]
                if a.get("difficulty_label") != b.get("difficulty_label"):
                    self.run("""
                        MATCH (a:Exercise {id: $src})
                        MATCH (b:Exercise {id: $dst})
                        MERGE (a)-[:PROGRESSION_OF {type: 'LOAD'}]->(b)
                    """, {"src": a["id"], "dst": b["id"]})
                    count += 1
        print(f"       → {count}개 생성")

    # ── 11. ARM_SUPERSET 엣지 ─────────────────────────────────────────────
    def create_arm_superset_edges(self):
        print("  [14] ARM_SUPERSET 엣지 생성...")
        for bi_id, tri_id in ARM_SUPERSET_PAIRS:
            self.run("""
                MATCH (bi:Exercise  {id: $bi_id})
                MATCH (tri:Exercise {id: $tri_id})
                MERGE (bi)-[:ARM_SUPERSET]->(tri)
                MERGE (tri)-[:ARM_SUPERSET]->(bi)
            """, {"bi_id": bi_id, "tri_id": tri_id})
        print(f"       → {len(ARM_SUPERSET_PAIRS)}쌍 생성")


# ── 메인 ────────────────────────────────────────────────────────────────────
def main():
    print("=" * 55)
    print("  Planfit 5분할 그래프 DB 구축")
    print("=" * 55)

    # 데이터 로드
    print(f"\n[데이터 로드]")
    with open(ENRICHED_PATH, encoding="utf-8") as f:
        enriched = json.load(f)
    with open(EDGES_PATH, encoding="utf-8") as f:
        edges = json.load(f)

    five_split = [d for d in enriched if d["category"] in SPLIT_MAP]
    five_ids   = {d["id"] for d in five_split}
    print(f"  enriched 전체: {len(enriched)}개 → 5분할: {len(five_split)}개")
    print(f"  edges 전체: {len(edges)}개")

    # 빌드
    print(f"\n[Neo4j 연결] {NEO4J_URI}")
    builder = GraphBuilder(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
    try:
        print("\n[노드 & 엣지 생성]")
        builder.clear_all()
        builder.create_indexes()
        builder.create_static_nodes()
        builder.create_exercises(five_split)
        builder.create_targets_edges(five_split)
        builder.create_equipment_edges(five_split)
        builder.create_intensity_edges(five_split)
        builder.create_split_edges(five_split)
        builder.create_similar_edges(enriched)
        builder.create_substitute_edges(edges, five_ids)
        builder.create_progression_edges(five_split)
        builder.create_arm_superset_edges()

        print("\n" + "=" * 55)
        print("  ✅ 완료")
        print("=" * 55)
        _print_summary(builder)
    finally:
        builder.close()


def _print_summary(builder: GraphBuilder):
    queries = {
        "Exercise 노드":       "MATCH (n:Exercise)      RETURN count(n) AS c",
        "BodyPart 노드":       "MATCH (n:BodyPart)      RETURN count(n) AS c",
        "Equipment 노드":      "MATCH (n:Equipment)     RETURN count(n) AS c",
        "IntensityLevel 노드": "MATCH (n:IntensityLevel)RETURN count(n) AS c",
        "SplitDay 노드":       "MATCH (n:SplitDay)      RETURN count(n) AS c",
        "TARGETS_PRIMARY":     "MATCH ()-[r:TARGETS_PRIMARY]->()   RETURN count(r) AS c",
        "TARGETS_SECONDARY":   "MATCH ()-[r:TARGETS_SECONDARY]->() RETURN count(r) AS c",
        "REQUIRES_EQUIPMENT":  "MATCH ()-[r:REQUIRES_EQUIPMENT]->()RETURN count(r) AS c",
        "HAS_INTENSITY":       "MATCH ()-[r:HAS_INTENSITY]->()     RETURN count(r) AS c",
        "PART_OF_SPLIT":       "MATCH ()-[r:PART_OF_SPLIT]->()     RETURN count(r) AS c",
        "SIMILAR_TO":          "MATCH ()-[r:SIMILAR_TO]->()        RETURN count(r) AS c",
        "SUBSTITUTE_FOR":      "MATCH ()-[r:SUBSTITUTE_FOR]->()    RETURN count(r) AS c",
        "PROGRESSION_OF":      "MATCH ()-[r:PROGRESSION_OF]->()    RETURN count(r) AS c",
        "ARM_SUPERSET":        "MATCH ()-[r:ARM_SUPERSET]->()      RETURN count(r) AS c",
    }
    print("\n[요약]")
    with builder.driver.session() as s:
        for label, cypher in queries.items():
            n = s.run(cypher).single()["c"]
            print(f"  {label:<22} {n:>6,}")


if __name__ == "__main__":
    main()
