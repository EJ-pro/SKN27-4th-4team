import os
import psycopg2
from dotenv import load_dotenv
from langchain_core.documents import Document

# .env 환경 변수 로드
load_dotenv()

DB_CONFIG = dict(
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT")),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
)


def load_exercises_as_documents() -> list[Document]:
    """
    exercises 테이블에서 운동 데이터를 로드하여 List[Document]로 반환
    page_content: 운동 정보를 자연어 텍스트로 변환
    metadata: 검색/필터링에 활용할 구조화 정보
    """
    query = """
        SELECT
            exercise_id,
            name_kor,
            name_eng,
            category,
            target_primary,
            target_secondary,
            equipment,
            difficulty,
            default_duration_min,
            description,
            starting_position,
            movement,
            breathing,
            related_exercises,
            guide,
            caution
        FROM exercises
        ORDER BY exercise_id;
    """

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute(query)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"데이터 로드 중 오류 발생: {e}")
        return []

    documents = []
    for row in rows:
        (
            exercise_id, name_kor, name_eng, category,
            target_primary, target_secondary, equipment,
            difficulty, default_duration_min,
            description, starting_position, movement, breathing, related_exercises,
            guide, caution
        ) = row

        # 자연어 텍스트로 변환 (Splitter/Embedding 입력용)
        content_parts = [
            f"운동명: {name_kor}" + (f" ({name_eng})" if name_eng else ""),
            f"카테고리: {category}",
            f"주요 타겟 근육: {target_primary or '정보 없음'}",
            f"보조 타겟 근육: {', '.join(target_secondary) if target_secondary else '없음'}",
            f"장비: {equipment or '맨몸'}",
            f"난이도: {difficulty}",
            f"기본 운동 시간: {default_duration_min}분",
        ]
        if description:
            content_parts.append(f"운동 설명: {description}")
        if starting_position:
            content_parts.append(f"시작 자세: {starting_position}")
        if movement:
            content_parts.append(f"동작 방법: {movement}")
        if breathing:
            content_parts.append(f"호흡법: {breathing}")
        if related_exercises:
            content_parts.append(f"관련 운동: {related_exercises}")
        if guide:
            content_parts.append(f"운동 방법: {guide}")
        if caution:
            content_parts.append(f"주의사항: {caution}")

        page_content = "\n".join(content_parts)

        metadata = {
            "exercise_id": exercise_id,
            "name_kor": name_kor,
            "category": category,
            "target_primary": target_primary,
            "difficulty": difficulty,
            "equipment": equipment or "맨몸",
            "target_secondary": target_secondary,
            "description": description,
            "starting_position": starting_position,
            "movement": movement,
            "breathing": breathing,
            "related_exercises": related_exercises,
            "guide": guide,
            "caution": caution,
        }

        documents.append(Document(page_content=page_content, metadata=metadata))

    return documents


