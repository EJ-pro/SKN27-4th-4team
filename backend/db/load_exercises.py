# -*- coding: utf-8 -*-
"""
PostgreSQL 초기화 + 운동 데이터 적재 파이프라인
실행: python db/load_exercises.py

[필수 환경] Python >= 3.10 (타입 힌트 및 표준 인코딩 제어 보장)
"""

import sys
import os

# 팀원 환경 세팅 삽질 방지: Python 버전 최소 조건(3.10+) 강제 가드라인 구축
if sys.version_info < (3, 10):
    sys.exit("[CRITICAL ERROR] RoutineGraph 파이프라인은 Python 3.10 이상 환경이 필수입니다.")

import json
import psycopg2
from psycopg2.extras import execute_values
from pathlib import Path
from dotenv import load_dotenv

# [보완] .env 환경 변수 로드 (하드코딩 제거 및 팀 컨벤션 확립)
load_dotenv()

DB_CONFIG = dict(
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT")),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
)

DB_DIR   = Path(__file__).parent
DATA_DIR = DB_DIR.parent / "data"

SCHEMA_SQL         = DB_DIR / "schema.sql"
SCHEMA_MUSCLES_SQL = DB_DIR / "schema_muscles.sql"
ENRICHED_JSON      = DATA_DIR / "planfit_exercises_enriched.json"

LABEL_TO_ENUM = {
    "beginner":     "초급",
    "intermediate": "중급",
    "advanced":     "고급"
}


def clean_text(text: str | None) -> str | None:
    """JSON 파싱 후 파이썬 메모리에 남는 실제 이스케이프/리터럴 문자열 클리닝"""
    if not text:
        return None
    
    text = text.replace("\\r\n", "\n").replace("\\n", "\n")
    return text.replace("\r\n", "\n").strip()


def apply_schema(conn) -> None:
    """정의된 스키마 SQL 파일들을 데이터베이스에 적용 (실패 시 즉시 중단)"""
    with conn.cursor() as cur:
        for path in (SCHEMA_SQL, SCHEMA_MUSCLES_SQL):
            if not path.exists():
                raise FileNotFoundError(f"[크리티컬 에러] 필수 스키마 파일이 누락되었습니다: {path.name}")
            sql = path.read_text(encoding="utf-8")
            cur.execute(sql)
    conn.commit()
    print("[INFO] 스키마(DDL) 및 해부학 인프라 구축 완료")


def load_exercises(conn) -> None:
    """정제된 JSON 데이터를 파싱하여 PostgreSQL 마스터 테이블에 벌크 인서트(Upsert)"""
    if not ENRICHED_JSON.exists():
        raise FileNotFoundError(f"[크리티컬 에러] 적재 대상 JSON 파일이 없습니다: {ENRICHED_JSON.name}")

    with open(ENRICHED_JSON, encoding="utf-8-sig") as f:
        raw: list[dict] = json.load(f)

    # 원본 데이터 중복 id 제거 (첫 번째 항목 유지)
    seen_ids: set[int] = set()
    exercises = []
    for ex in raw:
        eid = ex.get("id")
        if eid not in seen_ids:
            seen_ids.add(eid)
            exercises.append(ex)
    if len(exercises) < len(raw):
        print(f"[WARN] 중복 id 제거: {len(raw) - len(exercises)}개")

    rows = []
    for ex in exercises:
        # [버그 수정 및 예외 전환] id 누락 시 KeyError 대신 문맥에 맞는 ValueError 발생
        if "id" not in ex or ex["id"] is None:
            name_context = ex.get("name_kor", "이름 무명")
            raise ValueError(f"[데이터 오염] 고유 ID가 없는 운동 레코드가 감지되어 적재를 중단합니다: ({name_context})")

        difficulty_label = ex.get("difficulty_label", "")
        # [버그 수정] 전역 변수를 오염시키던 중복 대입문(DIFFICULTY_MAP =) 제거
        difficulty = LABEL_TO_ENUM.get(difficulty_label, "초급")

        rows.append((
            ex["id"],
            ex.get("name_kor", ""),
            ex.get("name_eng") or None,
            ex.get("category", ""),
            ex.get("target_primary") or None,
            json.dumps(ex.get("target_secondary") or [], ensure_ascii=False),
            ex.get("equipment") or None,
            difficulty,
            ex.get("default_duration_min", 10),
            ex.get("video_url") or None,
            clean_text(ex.get("guide")),
            clean_text(ex.get("caution")),
        ))

    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO exercises (
                exercise_id, name_kor, name_eng, category,
                target_primary, target_secondary, equipment, difficulty,
                default_duration_min, video_url, guide, caution
            ) VALUES %s
            ON CONFLICT (exercise_id) DO UPDATE SET
                name_kor             = EXCLUDED.name_kor,
                name_eng             = EXCLUDED.name_eng,
                category             = EXCLUDED.category,
                target_primary       = EXCLUDED.target_primary,
                target_secondary     = EXCLUDED.target_secondary,
                equipment            = EXCLUDED.equipment,
                difficulty           = EXCLUDED.difficulty,
                default_duration_min = EXCLUDED.default_duration_min,
                video_url            = EXCLUDED.video_url,
                guide                = EXCLUDED.guide,
                caution              = EXCLUDED.caution
        """, rows)
    conn.commit()
    print(f"[INFO] exercises 테이블 마스터 데이터 적재 완료: 총 {len(rows)}개")


def main() -> None:
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")

    conn = None
    try:
        print("============================================================")
        print("START: RoutineGraph Backend Data Pipeline")
        print("============================================================")
        
        conn = psycopg2.connect(**DB_CONFIG)
        
        print("[Step 1] 데이터베이스 스키마 및 확장팩(pgvector) 빌드")
        apply_schema(conn)

        print("\n[Step 2] 운동 마스터 시드 데이터(JSON) 파싱 및 클리닝")
        load_exercises(conn)

        print("\nSUCCESS: All data pipelines have completed successfully!")
        print("============================================================")
        
    except psycopg2.DatabaseError as e:
        print(f"\n[ERROR] 데이터베이스 처리 중 예외 발생: {e}")
        if conn:
            print("[ROLLBACK] 현재 진행 중인 데이터 적재 트랜잭션을 롤백합니다.")
            conn.rollback()
    # [보완] KeyError 대신 데이터 유효성 검증 예외인 ValueError를 캐치하도록 수정
    except (FileNotFoundError, ValueError) as e:
        print(f"\n[CRITICAL] 유효성 검증 실패로 파이프라인 즉시 중단: {e}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"\n[UNKNOWN ERROR] 예기치 못한 시스템 에러 발생: {e}")
    finally:
        if conn:
            conn.close()
            print("[CLOSE] DB 커넥션이 안전하게 해제되었습니다.")


if __name__ == "__main__":
    main()