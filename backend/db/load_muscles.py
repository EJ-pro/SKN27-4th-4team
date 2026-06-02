# -*- coding: utf-8 -*-
"""
근육 마스터 데이터 + 관계성 → PostgreSQL 적재
실행: python db/load_muscles.py

[필수 환경] Python >= 3.10
[실행 순서] load_exercises.py 이후 실행 필요 (exercise_muscles 브릿지 의존성)
"""

import sys
import os

if sys.version_info < (3, 10):
    sys.exit("[CRITICAL ERROR] Python 3.10 이상 환경이 필수입니다.")

import psycopg2
from psycopg2.extras import execute_values
from pathlib import Path
from dotenv import load_dotenv

# [보완 1] .env 환경 변수 로드 (하드코딩 패스워드 제거)
load_dotenv()

DB_CONFIG = dict(
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", 5434)),
    dbname=os.getenv("DB_NAME", "fitnessdb"),
    user=os.getenv("DB_USER", "fitness"),
    password=os.getenv("DB_PASSWORD"),  # 기본값 없음 — .env 필수
)

# ── 근육 마스터 데이터 (위키피디아 List of skeletal muscles 기반) ─────────────
# (name_kor, name_eng, muscle_group, action_text, origin, insertion)
MUSCLES = [
    # ── 등 ──────────────────────────────────────────────────────────────────
    ("광배근",    "Latissimus dorsi",    "등",
     "상완 내전·신전·내회전; 몸통 신전; 복식 호흡 보조",
     "T7~L5 극돌기, 흉요근막, 장골능, 하부 3~4 늑골",
     "상완골 결절간구(소결절릉)"),
    ("능형근",    "Rhomboid",            "등",
     "견갑골 내전·하방 회전·거상",
     "C7~T5 극돌기",
     "견갑골 내측연"),
    ("중부 승모근","Middle trapezius",   "등",
     "견갑골 내전",
     "T1~T5 극돌기",
     "견갑골 견봉·견갑극"),
    ("하부 승모근","Lower trapezius",    "등",
     "견갑골 하방 당기기·안정화",
     "T6~T12 극돌기",
     "견갑극 내측"),
    ("승모근",    "Trapezius",           "등",
     "견갑골 안정화·내전·거상; 경부 신전",
     "후두골, 경추·흉추 극돌기",
     "쇄골, 견봉, 견갑극"),
    ("척추기립근","Erector spinae",      "코어",
     "척추 신전·측굴·회전 안정화",
     "천골, 장골능, 하부 늑골, 척추 극돌기",
     "상위 늑골, 경추 횡돌기"),
    # ── 가슴 ────────────────────────────────────────────────────────────────
    ("대흉근",    "Pectoralis major",    "가슴",
     "상완 내전·굴곡·내회전; 호흡 보조",
     "쇄골 내측 1/2, 흉골, 늑연골 2~6",
     "상완골 대결절릉"),
    ("소흉근",    "Pectoralis minor",    "가슴",
     "견갑골 하방 회전·전방 경사·하강",
     "늑골 3~5번 전면",
     "견갑골 오훼돌기"),
    # ── 어깨 ────────────────────────────────────────────────────────────────
    ("상부 승모근","Upper trapezius",    "어깨",
     "견갑골·쇄골 거상; 경부 동측 굴곡",
     "후두골 외측, C1~C7 극돌기",
     "쇄골 외측 1/3, 견봉"),
    ("삼각근",    "Deltoid",             "어깨",
     "상완 굴곡·신전·외전·내전·내회전·외회전(섬유 방향별)",
     "쇄골 외측, 견봉, 견갑극",
     "상완골 삼각근 조면"),
    ("전면 삼각근","Anterior deltoid",   "어깨",
     "상완 굴곡·내회전·수평 내전",
     "쇄골 외측 1/3",
     "상완골 삼각근 조면"),
    ("측면 삼각근","Lateral deltoid",    "어깨",
     "상완 외전 90° 이상",
     "견봉 외측연",
     "상완골 삼각근 조면"),
    ("후면 삼각근","Posterior deltoid",  "어깨",
     "상완 신전·외회전·수평 외전",
     "견갑극 하순",
     "상완골 삼각근 조면"),
    # ── 회전근개 ────────────────────────────────────────────────────────────
    ("회전근개",  "Rotator cuff",        "회전근개",
     "상완 관절 안정화; 외회전·내회전",
     "견갑골 (섬유별 상이)",
     "상완골 대결절·소결절"),
    ("극상근",    "Supraspinatus",       "회전근개",
     "상완 외전 초기 0~15°; 관절낭 압박 안정화",
     "견갑골 극상와",
     "상완골 대결절 상면"),
    ("극하근",    "Infraspinatus",       "회전근개",
     "상완 외회전; 관절낭 후방 안정화",
     "견갑골 극하와",
     "상완골 대결절 중면"),
    ("소원근",    "Teres minor",         "회전근개",
     "상완 외회전",
     "견갑골 외측연 상부",
     "상완골 대결절 하면"),
    ("견갑하근",  "Subscapularis",       "회전근개",
     "상완 내회전; 관절낭 전방 안정화",
     "견갑골 견갑하와",
     "상완골 소결절"),
    # ── 상완/전완 ────────────────────────────────────────────────────────────
    ("이두근",    "Biceps brachii",      "상완",
     "주관절 굴곡; 전완 회외; 상완 굴곡 보조",
     "오훼돌기(단두), 관절상결절(장두)",
     "요골 조면"),
    ("삼두근",    "Triceps brachii",     "상완",
     "주관절 신전; 상완 신전·내전 보조(장두)",
     "오훼하결절(장두), 상완골 후면(내측·외측두)",
     "척골 주두"),
    ("전완근",    "Brachioradialis",     "전완",
     "주관절 굴곡; 전완 중립 위치 유지",
     "상완골 외측 상과릉 근위 2/3",
     "요골 경상돌기"),
    # ── 코어 ────────────────────────────────────────────────────────────────
    ("코어",      "Core muscles",        "코어",
     "척추 안정화; 복압 증가; 골반 제어 (복합 근육군)",
     "척추·골반 복합",
     "흉골·골반 복합"),
    ("복직근",    "Rectus abdominis",    "코어",
     "척추 굴곡; 복압 증가; 골반 후방 경사",
     "치골 결합·치골릉",
     "흉골 검상돌기, 늑연골 5~7"),
    ("복사근",    "Obliques",            "코어",
     "척추 측굴·회전; 복압 증가",
     "하부 늑골(외복사근), 흉요근막·장골능(내복사근)",
     "장골능, 백선"),
    ("하복부",    "Lower rectus abdominis","코어",
     "골반 후방 경사; 하지 거상 시 요추 안정화",
     "치골 상부",
     "복직근 하부 섬유"),
    ("복횡근",    "Transverse abdominis","코어",
     "복벽 조임; 복압 증가; 요추 심부 안정화",
     "흉요근막, 장골능, 서혜인대",
     "백선, 치골릉"),
    # ── 하체 ────────────────────────────────────────────────────────────────
    ("대퇴사두근","Quadriceps femoris",  "하체",
     "슬관절 신전; 고관절 굴곡(대퇴직근)",
     "장골 전하장골극·대퇴골 근위부(광근 3개)",
     "슬개골을 통해 경골 조면"),
    ("대퇴직근",  "Rectus femoris",      "하체",
     "슬관절 신전; 고관절 굴곡",
     "전하장골극, 관골구 상방",
     "슬개골 상단→경골 조면"),
    ("외측광근",  "Vastus lateralis",    "하체",
     "슬관절 신전",
     "대퇴골 대전자·외측 조선",
     "슬개골 외측→경골 조면"),
    ("내측광근",  "Vastus medialis",     "하체",
     "슬관절 신전; 슬개골 내측 안정화",
     "대퇴골 내측 조선",
     "슬개골 내측→경골 조면"),
    ("햄스트링",  "Hamstrings",          "하체",
     "슬관절 굴곡; 고관절 신전",
     "좌골결절",
     "경골·비골 근위부"),
    ("대퇴이두근","Biceps femoris",      "하체",
     "슬관절 굴곡·외회전; 고관절 신전(장두)",
     "좌골결절(장두), 대퇴골 중부(단두)",
     "비골두"),
    ("반건양근",  "Semitendinosus",      "하체",
     "슬관절 굴곡·내회전; 고관절 신전",
     "좌골결절",
     "경골 내측면(거위발)"),
    ("둔근",      "Gluteus maximus",     "하체",
     "고관절 신전·외회전; 대퇴 외전 보조",
     "장골 후면, 천골·미골 외측",
     "장경인대, 대퇴골 둔근조면"),
    ("중둔근",    "Gluteus medius",      "하체",
     "고관절 외전; 보행 시 골반 안정화",
     "장골 외측면",
     "대퇴골 대전자"),
    # ── 종아리 ──────────────────────────────────────────────────────────────
    ("비복근",    "Gastrocnemius",       "종아리",
     "족저굴곡; 슬관절 굴곡 보조",
     "대퇴골 내·외측 과",
     "종골(아킬레스건)"),
    ("가자미근",  "Soleus",              "종아리",
     "족저굴곡",
     "비골두·비골 후면 상부, 경골 가자미근선",
     "종골(아킬레스건)"),
    # ── 전신 ────────────────────────────────────────────────────────────────
    ("전신",      "Full body",           "전신",
     "복합 다관절 전신 동원",
     "-", "-"),
]

# ── 근육 관계성 원본 ──────────────────────────────────────────────────────────
# part_of  : 단방향 (하위 근육 → 상위 근육군)
# synergist: 코드에서 양방향 자동 확장
# antagonist: 코드에서 양방향 자동 확장
RELATIONS_RAW = [
    # === Part-of (하위 → 상위) ===
    ("대퇴직근",   "대퇴사두근", "part_of"),
    ("외측광근",   "대퇴사두근", "part_of"),
    ("내측광근",   "대퇴사두근", "part_of"),
    ("대퇴이두근", "햄스트링",   "part_of"),
    ("반건양근",   "햄스트링",   "part_of"),
    ("전면 삼각근","삼각근",     "part_of"),
    ("측면 삼각근","삼각근",     "part_of"),
    ("후면 삼각근","삼각근",     "part_of"),
    ("극상근",     "회전근개",   "part_of"),
    ("극하근",     "회전근개",   "part_of"),
    ("소원근",     "회전근개",   "part_of"),
    ("견갑하근",   "회전근개",   "part_of"),
    ("상부 승모근","승모근",     "part_of"),
    ("중부 승모근","승모근",     "part_of"),
    ("하부 승모근","승모근",     "part_of"),
    ("복직근",     "코어",       "part_of"),
    ("복사근",     "코어",       "part_of"),
    ("복횡근",     "코어",       "part_of"),
    ("하복부",     "코어",       "part_of"),
    ("척추기립근", "코어",       "part_of"),
    # === Synergist — Pull 패턴 ===
    ("광배근",     "이두근",      "synergist"),
    ("광배근",     "능형근",      "synergist"),
    ("광배근",     "중부 승모근", "synergist"),
    ("광배근",     "하부 승모근", "synergist"),
    ("광배근",     "후면 삼각근", "synergist"),
    ("능형근",     "중부 승모근", "synergist"),
    ("후면 삼각근","능형근",      "synergist"),
    ("이두근",     "전완근",      "synergist"),
    # === Synergist — Push 패턴 ===
    ("대흉근",     "전면 삼각근", "synergist"),
    ("대흉근",     "삼두근",      "synergist"),
    ("전면 삼각근","삼두근",      "synergist"),
    ("측면 삼각근","극상근",      "synergist"),
    # === Synergist — 하체 패턴 ===
    ("대퇴사두근", "둔근",        "synergist"),
    ("햄스트링",   "둔근",        "synergist"),
    ("대퇴이두근", "반건양근",    "synergist"),
    ("비복근",     "가자미근",    "synergist"),
    ("둔근",       "척추기립근",  "synergist"),
    ("중둔근",     "둔근",        "synergist"),
    # === Synergist — 코어 ===
    ("복직근",     "복사근",      "synergist"),
    ("복직근",     "복횡근",      "synergist"),
    # === Antagonist (길항근) ===
    ("대흉근",     "광배근",      "antagonist"),
    ("이두근",     "삼두근",      "antagonist"),
    ("전면 삼각근","후면 삼각근", "antagonist"),
    ("대퇴사두근", "햄스트링",    "antagonist"),
    ("복직근",     "척추기립근",  "antagonist"),
]


def expand_relations(raw: list) -> list:
    """
    synergist/antagonist 양방향 확장 후 중복 제거
    - (A→B, synergist) 입력 시 (B→A, synergist)도 자동 생성
    - (A→B)와 (B→A)는 논리적으로 다른 방향의 관계이므로 둘 다 유지
    - part_of는 방향성이 있으므로 단방향 유지
    - dict.fromkeys(): 튜플 단위 완전 중복만 제거 (순서 보존)
    """
    result = list(raw)
    for src, tgt, rtype in raw:
        if rtype in ("synergist", "antagonist"):
            result.append((tgt, src, rtype))
    return list(dict.fromkeys(result))


def load_postgres() -> None:
    # [보완 2] psycopg2의 with conn: 은 트랜잭션 자동 커밋/롤백만 처리
    # 커넥션 종료는 finally에서 명시적으로 수행 (with conn: 이 conn.close()를 호출하지 않음)
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)

        with conn:
            cur = conn.cursor()

            # ── Step 1: muscles 마스터 적재 ───────────────────────────────
            execute_values(cur, """
                INSERT INTO muscles (name_kor, name_eng, muscle_group, action_text, origin, insertion)
                VALUES %s
                ON CONFLICT (name_kor) DO UPDATE SET
                    name_eng     = EXCLUDED.name_eng,
                    muscle_group = EXCLUDED.muscle_group,
                    action_text  = EXCLUDED.action_text,
                    origin       = EXCLUDED.origin,
                    insertion    = EXCLUDED.insertion
            """, MUSCLES)
            print(f"[INFO] muscles 적재: {len(MUSCLES)}개")

            # muscle_id 룩업 캐시
            cur.execute("SELECT name_kor, muscle_id FROM muscles")
            id_map: dict[str, int] = dict(cur.fetchall())

            # ── Step 2: muscle_relations 적재 ────────────────────────────
            relations = expand_relations(RELATIONS_RAW)
            rel_rows = []
            for src, tgt, rtype in relations:
                if src in id_map and tgt in id_map:
                    rel_rows.append((id_map[src], id_map[tgt], rtype))
                else:
                    missing = src if src not in id_map else tgt
                    print(f"[WARNING] id_map에서 근육을 찾을 수 없음: '{missing}' — 해당 관계 건너뜀")

            execute_values(cur, """
                INSERT INTO muscle_relations (source_muscle, target_muscle, relation_type)
                VALUES %s
                ON CONFLICT (source_muscle, target_muscle, relation_type) DO NOTHING
            """, rel_rows)
            print(f"[INFO] muscle_relations 적재: {len(rel_rows)}개")

            # ── Step 3: exercise_muscles 브릿지 적재 ─────────────────────
            # [보완 5] exercises 테이블이 비어있으면 브릿지가 조용히 0건 적재되는 문제 방어
            cur.execute("SELECT COUNT(*) FROM exercises")
            ex_count = cur.fetchone()[0]
            if ex_count == 0:
                raise RuntimeError(
                    "exercises 테이블이 비어있습니다. "
                    "load_exercises.py를 먼저 실행한 뒤 이 스크립트를 실행하세요."
                )

            cur.execute("SELECT exercise_id, target_primary, target_secondary FROM exercises")
            ex_rows = cur.fetchall()

            bridge_rows = []
            for ex_id, primary, secondaries in ex_rows:
                if primary and primary in id_map:
                    bridge_rows.append((ex_id, id_map[primary], "primary"))
                for sec in (secondaries or []):
                    if sec in id_map:
                        bridge_rows.append((ex_id, id_map[sec], "secondary"))

            # (exercise_id, muscle_id) 기준 중복 제거
            # 동일 근육이 primary/secondary 양쪽에 있으면 먼저 들어온 역할(primary 우선) 유지
            seen: set[tuple] = set()
            unique_bridge = []
            for row in bridge_rows:
                key = (row[0], row[1])
                if key not in seen:
                    seen.add(key)
                    unique_bridge.append(row)

            # [보완 4] ON CONFLICT DO UPDATE: 재실행 시 role 값도 최신 상태로 갱신
            execute_values(cur, """
                INSERT INTO exercise_muscles (exercise_id, muscle_id, role)
                VALUES %s
                ON CONFLICT (exercise_id, muscle_id) DO UPDATE SET
                    role = EXCLUDED.role
            """, unique_bridge)
            print(f"[INFO] exercise_muscles 적재: {len(unique_bridge)}개")

    except RuntimeError as e:
        print(f"\n[CRITICAL] {e}")
        if conn:
            conn.rollback()
    except psycopg2.DatabaseError as e:
        print(f"\n[ERROR] 데이터베이스 처리 중 예외 발생: {e}")
        if conn:
            print("[ROLLBACK] 트랜잭션을 롤백합니다.")
            conn.rollback()
    except Exception as e:
        print(f"\n[UNKNOWN ERROR] 예기치 못한 에러: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()
            print("[CLOSE] DB 커넥션이 안전하게 해제되었습니다.")


def main() -> None:
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")

    print("============================================================")
    print("START: RoutineGraph Muscle Knowledge Graph Pipeline")
    print("============================================================")
    load_postgres()
    print("\nSUCCESS: Muscle data pipeline completed.")
    print("============================================================")


if __name__ == "__main__":
    main()