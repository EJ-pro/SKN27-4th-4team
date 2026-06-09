from typing import Generator

from langchain_core.messages import AIMessage, HumanMessage

from .constants import MAX_HISTORY_TURNS, OUT_OF_SCOPE_MESSAGE
from .db import load_history
from .graphs import create_rag_graph
from .nodes import (
    classify,
    retrieve_general,
    retrieve_injury,
    retrieve_specific,
    stream_generate_answer,
    stream_recall_answer,
)

graph = create_rag_graph()


def _build_past_messages(session_id: int) -> list:
    history = load_history(session_id)
    past_messages = []
    for h in history[-(MAX_HISTORY_TURNS * 2):]:
        if h["sender"] == "user":
            past_messages.append(HumanMessage(content=h["content"]))
        else:
            past_messages.append(AIMessage(content=h["content"]))
    return past_messages


def get_answer(user_msg: str, session_id: int) -> str:
    result = graph.invoke({
        "messages": _build_past_messages(session_id),
        "session_id": session_id,
        "question": user_msg,
    })
    return result.get("answer", "답변을 생성하지 못했습니다.")


def stream_answer(user_msg: str, session_id: int) -> Generator:
    full_answer = ""

    try:
        state = {
            "messages": _build_past_messages(session_id),
            "session_id": session_id,
            "question": user_msg,
        }
        state = classify(state)
        query_type = state.get("query_type", "general")

        if query_type == "out_of_scope":
            yield ("token", OUT_OF_SCOPE_MESSAGE)
            full_answer = OUT_OF_SCOPE_MESSAGE
        elif query_type == "recall":
            for content in stream_recall_answer(state):
                if content:
                    full_answer += content
                    yield ("token", content)
        else:
            if query_type == "specific":
                state = retrieve_specific(state)
            elif query_type == "injury":
                state = retrieve_injury(state)
            else:
                state = retrieve_general(state)

            for content in stream_generate_answer(state):
                if content:
                    full_answer += content
                    yield ("token", content)

        if not full_answer:
            yield ("token", OUT_OF_SCOPE_MESSAGE)
            full_answer = OUT_OF_SCOPE_MESSAGE

    except Exception as exc:
        print(f"[stream_answer] error: {exc}")
        error_msg = "답변을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        if not full_answer:
            yield ("token", error_msg)
            full_answer = error_msg

    yield ("done", full_answer)
