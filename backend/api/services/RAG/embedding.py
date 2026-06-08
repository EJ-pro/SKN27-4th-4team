import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from RAG.loader import load_exercises_as_documents

load_dotenv()


"""
OpenAI text-embedding-3-small 모델 반환
- 차원: 1536 (pgvector 스키마 vector(1536)과 일치)
- API 키: .env의 OPENAI_API_KEY 자동 참조
"""


def embed_documents(docs: list[Document]) -> tuple[list[str], list[list[float]]]:
    """
    운동 문서 리스트를 받아 텍스트와 벡터 반환
    - embed_documents: 다수 문서를 배치로 벡터 변환
    - 반환값: (텍스트 리스트, 벡터 리스트)
    - text-embedding-3-small은 최대 8191 토큰을 지원하므로 운동 문서 단위로
      청킹 없이 임베딩한다 (스키마가 운동당 단일 벡터이기 때문).
    """
    embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")

    texts = [doc.page_content for doc in docs]
    vectors = embedding_model.embed_documents(texts)

    return texts, vectors


if __name__ == "__main__":
    docs = load_exercises_as_documents()

    texts, vectors = embed_documents(docs)

