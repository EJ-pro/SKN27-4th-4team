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
from RAG.splitter import split_documents
from api.services.chatbot.llm import get_embedding_model

load_dotenv()


"""
OpenAI text-embedding-3-small 모델 반환
- 차원: 1536 (pgvector 스키마 vector(1536)과 일치)
- API 키: .env의 OPENAI_API_KEY 자동 참조
"""


def embed_documents(splits: list[Document]) -> tuple[list[str], list[list[float]]]:
    """
    청크 리스트를 받아 텍스트와 벡터 반환
    - embed_documents: 다수 청크를 배치로 벡터 변환
    - 반환값: (텍스트 리스트, 벡터 리스트)
    """
    # 모델 연결을 중간 라우팅 함수로 교체 
    embedding_model = get_embedding_model()

    texts = [doc.page_content for doc in splits]
    vectors = embedding_model.embed_documents(texts)

    return texts, vectors


if __name__ == "__main__":
    docs = load_exercises_as_documents()
    splits = split_documents(docs)

    texts, vectors = embed_documents(splits)

