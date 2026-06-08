import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from dotenv import load_dotenv
from RAG.loader import load_exercises_as_documents
from RAG.embedding import embed_documents

load_dotenv()

DB_CONFIG = dict(
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT")),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
)


def save_embeddings_to_db(docs, texts, vectors):
    """
    embedding된 벡터를 exercises 테이블의 embedding 컬럼에 UPDATE
    - docs: 운동 문서 리스트 (운동 1개당 1개, metadata에 exercise_id 포함)
    - texts: 문서 텍스트 리스트
    - vectors: 벡터 리스트 (1536차원)

    주의: exercises.embedding은 운동당 단일 벡터(vector(1536)) 스키마이므로
    한 운동을 여러 청크로 분할하면 같은 exercise_id에 여러 번 UPDATE가 발생해
    마지막 청크 벡터만 남는다(앞부분 정보 손실). 따라서 청킹 없이 운동 문서
    전체를 하나의 벡터로 임베딩한다.
    """
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    seen = set()
    updated = 0
    for doc, vector in zip(docs, vectors):
        exercise_id = doc.metadata.get("exercise_id")
        if exercise_id is None:
            continue
        # 동일 exercise_id 중복 방지 (덮어쓰기로 인한 정보 손실 차단)
        if exercise_id in seen:
            print(f"[WARN] exercise_id {exercise_id} 중복 → 첫 벡터만 유지하고 건너뜀")
            continue
        seen.add(exercise_id)

        cursor.execute(
            """
            UPDATE exercises
            SET embedding = %s::vector
            WHERE exercise_id = %s
            """,
            (vector, exercise_id)
        )
        updated += 1

    conn.commit()
    cursor.close()
    conn.close()
    print(f"[INFO] 임베딩 저장 완료: {updated}개 운동")



if __name__ == "__main__":
    # 청킹하지 않고 운동 문서 전체를 임베딩 (운동당 벡터 1개)
    docs = load_exercises_as_documents()
    texts, vectors = embed_documents(docs)

    save_embeddings_to_db(docs, texts, vectors)
