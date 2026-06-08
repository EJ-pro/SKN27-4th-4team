from django.db import connection
from langchain_core.documents import Document

from .llm import get_embedding_model

_embedding_model = None

SELECT_COLUMNS = """
    SELECT exercise_id, name_kor, category, target_primary, target_secondary,
           difficulty, equipment, default_duration_min,
           description, starting_position, movement, breathing,
           related_exercises, guide, caution
    FROM exercises
"""


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = get_embedding_model()
    return _embedding_model


def rows_to_documents(rows) -> tuple[list[Document], list[str]]:
    docs = []
    for row in rows:
        (
            exercise_id,
            name_kor,
            category,
            target_primary,
            target_secondary,
            difficulty,
            equipment,
            default_duration_min,
            description,
            starting_position,
            movement,
            breathing,
            related_exercises,
            guide,
            caution,
        ) = row

        content = (
            f"운동명: {name_kor}\n"
            f"카테고리: {category}\n"
            f"주 타겟 근육: {target_primary or ''}\n"
            f"보조 타겟 근육: {target_secondary or []}\n"
            f"난이도: {difficulty}\n"
            f"장비: {equipment or '맨몸'}\n"
            f"기본 운동 시간: {default_duration_min}분"
        )
        if description:
            content += f"\n설명: {description}"
        if starting_position:
            content += f"\n시작 자세: {starting_position}"
        if movement:
            content += f"\n동작 방법: {movement}"
        if breathing:
            content += f"\n호흡법: {breathing}"
        if related_exercises:
            content += f"\n관련 운동: {related_exercises}"
        if guide:
            content += f"\n운동 가이드: {guide}"
        if caution:
            content += f"\n주의사항: {caution}"

        docs.append(
            Document(
                page_content=content,
                metadata={"exercise_id": exercise_id, "name_kor": name_kor},
            )
        )

    return docs, [doc.metadata["name_kor"] for doc in docs]


def vector_search(query: str, limit: int = 5, where_clause: str = "", params: list | None = None) -> list:
    query_vector = _get_embedding_model().embed_query(query)
    all_params = (params or []) + [query_vector, limit]

    sql = SELECT_COLUMNS
    if where_clause:
        sql += f" WHERE {where_clause}"
    # HNSW 인덱스가 vector_cosine_ops로 생성되어 있으므로 cosine 연산자(<=>)를 사용해야
    # 인덱스를 탄다. (L2 연산자 <-> 사용 시 인덱스 미적용 → full scan)
    sql += " ORDER BY embedding <=> %s::vector LIMIT %s"

    with connection.cursor() as cursor:
        cursor.execute(sql, all_params)
        return cursor.fetchall()


def keyword_search(exercise_name: str, limit: int = 3) -> list:
    # 양쪽 공백 제거 후 비교 (예: "벤치프레스" == "벤치 프레스")
    with connection.cursor() as cursor:
        cursor.execute(
            SELECT_COLUMNS + " WHERE REPLACE(name_kor, ' ', '') ILIKE REPLACE(%s, ' ', '') LIMIT %s",
            (f"%{exercise_name}%", limit),
        )
        return cursor.fetchall()


def get_muscles_by_body_part(injury_part: str) -> list[str]:
    """
    부상 부위(신체 표현)에 해당하는 근육명 목록 반환
    muscles 테이블의 muscle_group 또는 name_kor 기준으로 조회
    예: "어깨" → ["삼각근", "전면 삼각근", "측면 삼각근", "후면 삼각근", "상부 승모근"]
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT name_kor FROM muscles WHERE muscle_group ILIKE %s OR name_kor ILIKE %s",
            (f"%{injury_part}%", f"%{injury_part}%"),
        )
        return [row[0] for row in cursor.fetchall()]


def load_history(session_id: int) -> list[dict]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT sender, content
            FROM chat_messages
            WHERE session_id = %s
            ORDER BY created_at ASC
            """,
            (session_id,),
        )
        rows = cursor.fetchall()
    return [{"sender": row[0], "content": row[1]} for row in rows]
