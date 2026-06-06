from langgraph.graph import StateGraph, START, END

from .state import RAGChatState
from .constants import QUERY_TYPE_ROUTES
from .nodes import (
    classify,
    out_of_scope,
    retrieve_general,
    retrieve_specific,
    retrieve_injury,
    generate,
)


def route_by_query_type(state: RAGChatState) -> str:
    """query_type에 따라 노드 분기 (constants.QUERY_TYPE_ROUTES 기반)"""
    return QUERY_TYPE_ROUTES.get(state["query_type"], "retrieve_general")


def create_rag_graph():
    """
    RAG 챗봇 그래프 생성
    - 히스토리는 chat_messages 테이블에서 직접 관리
    - classify → out_of_scope / retrieve_* → generate 순으로 흐름
    - 카테고리 변경은 constants.py의 QUERY_TYPES만 수정하면 됨
    """
    workflow = StateGraph(RAGChatState)

    workflow.add_node("classify", classify)
    workflow.add_node("out_of_scope", out_of_scope)
    workflow.add_node("retrieve_general", retrieve_general)
    workflow.add_node("retrieve_specific", retrieve_specific)
    workflow.add_node("retrieve_injury", retrieve_injury)
    workflow.add_node("generate", generate)

    workflow.add_edge(START, "classify")
    workflow.add_conditional_edges(
        "classify",
        route_by_query_type,
        {node: node for node in QUERY_TYPE_ROUTES.values()},
    )
    workflow.add_edge("out_of_scope", END)
    workflow.add_edge("retrieve_general", "generate")
    workflow.add_edge("retrieve_specific", "generate")
    workflow.add_edge("retrieve_injury", "generate")
    workflow.add_edge("generate", END)

    return workflow.compile()
