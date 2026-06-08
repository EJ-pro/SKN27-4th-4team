import sys
import os

# RAG 스크립트(pgvectordb 등)는 Django 없이 실행되므로 backend 루트를 path에 추가
_BACKEND_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)
# RAG 패키지 import용 (api/services)
_RAG_PARENT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _RAG_PARENT not in sys.path:
    sys.path.insert(0, _RAG_PARENT)
    
from dotenv import load_dotenv
from langchain_core.documents import Document
from RAG.loader import load_exercises_as_documents
from api.services.chatbot.llm import get_embedding_model

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
    # 모델 연결을 중간 라우팅 함수로 교체 
    embedding_model = get_embedding_model()

    texts = [doc.page_content for doc in docs]
    vectors = embedding_model.embed_documents(texts)

    return texts, vectors


if __name__ == "__main__":
    docs = load_exercises_as_documents()

    texts, vectors = embed_documents(docs)

