import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from RAG.loader import load_exercises_as_documents
from RAG.splitter import split_documents

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
    embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")

    texts = [doc.page_content for doc in splits]
    vectors = embedding_model.embed_documents(texts)

    return texts, vectors


if __name__ == "__main__":
    docs = load_exercises_as_documents()
    splits = split_documents(docs)

    texts, vectors = embed_documents(splits)

