from typing import List, Any
from typing_extensions import TypedDict, Annotated
from langchain_core.documents import Document
from langgraph.graph.message import add_messages


class RAGChatState(TypedDict):
    messages: Annotated[list, add_messages]  # 대화 히스토리 (MemorySaver가 자동 관리)
    question: str                            # 현재 사용자 질문
    query_type: str                          # general / specific / injury / out_of_scope
    retrieved_docs: List[Document]           # 검색된 운동 문서들
    context: str                             # 검색된 문서들을 결합한 컨텍스트
    answer: str                              # 최종 답변
    sources: List[str]                       # 참고 운동명 리스트
