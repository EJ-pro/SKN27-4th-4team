import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from RAG.loader import load_exercises_as_documents


def split_documents(documents: list[Document]) -> list[Document]:
    """
    load_exercises_as_documents()의 결과를 청크로 분할
    - chunk_size: 700 (운동 설명 필드 문맥 보존)
    - chunk_overlap: 50 (청크 경계 문맥 이어받기)
    - separators: 한국어 운동 데이터에 최적화된 구분자 계층
    """

    # page_content가 너무 짧은 문서 필터링 (50자 미만)
    filtered = [doc for doc in documents if len(doc.page_content) >= 50]
    removed = len(documents) - len(filtered)
    if removed > 0:
        print(f"[INFO] 짧은 문서 {removed}개 제거")

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=400,
        chunk_overlap=50,
        length_function=len,
        is_separator_regex=True,
        separators=[
            "\n\n",                                  # 문단
            "\n",                                    # 줄바꿈
            r"(?<=[.?!])\s+",                       # 영어 문장
            r"(?<=[다요죠음함임니다])[\.\?!]?\s+",      # 한국어 종결 표현
            " ",                                     # 단어
            "",                                      # 최후의 수단: 글자 단위
        ]
    )

    splits = text_splitter.split_documents(filtered)

    return splits
