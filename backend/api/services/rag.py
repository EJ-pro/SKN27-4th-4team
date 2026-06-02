"""
RAG 서비스 — 벡터 유사도 검색 + LLM 컨텍스트 주입
"""
import os
from django.db import connection


def search_similar_exercises(query_embedding: list[float], top_k: int = 5) -> list[dict]:
    """pgvector cosine similarity로 유사 운동 검색"""
    sql = """
        SELECT exercise_id, name_kor, category, target_primary, difficulty, guide
        FROM exercises
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """
    with connection.cursor() as cur:
        cur.execute(sql, [query_embedding, top_k])
        cols = [col[0] for col in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def build_context(exercises: list[dict]) -> str:
    """검색된 운동 목록을 LLM 프롬프트용 텍스트로 변환"""
    lines = []
    for ex in exercises:
        lines.append(
            f"- {ex['name_kor']} ({ex['category']}, {ex['difficulty']}): {ex.get('guide', '')[:100]}"
        )
    return "\n".join(lines)
