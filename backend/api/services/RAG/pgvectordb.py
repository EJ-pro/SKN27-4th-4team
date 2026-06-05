import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from dotenv import load_dotenv
from RAG.loader import load_exercises_as_documents
from RAG.splitter import split_documents
from RAG.embedding import embed_documents

load_dotenv()

DB_CONFIG = dict(
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT")),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
)


def save_embeddings_to_db(splits, texts, vectors):
    """
    embedding된 벡터를 exercises 테이블의 embedding 컬럼에 UPDATE
    - splits: splitter 결과 (metadata에 exercise_id 포함)
    - texts: 청크 텍스트 리스트
    - vectors: 벡터 리스트 (1536차원)
    """
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    updated = 0
    for doc, vector in zip(splits, vectors):
        exercise_id = doc.metadata.get("exercise_id")
        if exercise_id is None:
            continue

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



if __name__ == "__main__":
    docs = load_exercises_as_documents()
    splits = split_documents(docs)
    texts, vectors = embed_documents(splits)

    save_embeddings_to_db(splits, texts, vectors)
