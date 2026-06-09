from typing import Generator
from langchain_core.messages import HumanMessage, AIMessage, AIMessageChunk
from .graphs import create_rag_graph
from .db import load_history
from .constants import MAX_HISTORY_TURNS, OUT_OF_SCOPE_MESSAGE

# 그래프 전역 1회 생성
graph = create_rag_graph()


def _build_past_messages(session_id: int) -> list:
    """DB 히스토리 → LangChain 메시지 리스트 변환"""
    history = load_history(session_id)
    past_messages = []
    for h in history[-(MAX_HISTORY_TURNS * 2):]:
        if h["sender"] == "user":
            past_messages.append(HumanMessage(content=h["content"]))
        else:
            past_messages.append(AIMessage(content=h["content"]))
    return past_messages


def get_answer(user_msg: str, session_id: int) -> str:
    """RAG 그래프 실행 후 완성된 답변 반환 (비스트리밍)"""
    result = graph.invoke({
        "messages": _build_past_messages(session_id),
        "session_id": session_id,
        "question": user_msg,
    })
    return result.get("answer", "답변을 생성할 수 없습니다.")


def stream_answer(user_msg: str, session_id: int) -> Generator:
    """
    RAG 그래프 스트리밍 실행
    Yields:
        ("token", str)  - generate 노드의 LLM 토큰 단위 출력
        ("done",  str)  - 스트리밍 완료 + 전체 누적 답변 (DB 저장용)
    """
    full_answer = ""

    try:
        for chunk, metadata in graph.stream(
            {"messages": _build_past_messages(session_id), "session_id": session_id, "question": user_msg},
            stream_mode="messages",
        ):
            # generate·recall 노드의 청크 토큰만 전달 (AIMessage 완성본 중복 방지)
            if metadata.get("langgraph_node") in ("generate", "recall") and isinstance(chunk, AIMessageChunk):
                content = chunk.content
                if content:
                    full_answer += content
                    yield ("token", content)

        # generate·recall이 실행되지 않은 경우 → out_of_scope 분기
        if not full_answer:
            yield ("token", OUT_OF_SCOPE_MESSAGE)
            full_answer = OUT_OF_SCOPE_MESSAGE

    except Exception as e:
        print(f"[stream_answer] 오류: {e}")
        error_msg = "답변을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        if not full_answer:
            yield ("token", error_msg)
            full_answer = error_msg

    yield ("done", full_answer)
