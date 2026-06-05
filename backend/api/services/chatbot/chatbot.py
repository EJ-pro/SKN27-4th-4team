from langchain_core.messages import HumanMessage, AIMessage
from .graphs import create_rag_graph
from .db import load_history
from .constants import MAX_HISTORY_TURNS

# 그래프 전역 1회 생성
graph = create_rag_graph()


def get_answer(user_msg: str, session_id: int) -> str:
    """
    사용자 질문을 받아 RAG 그래프 실행 후 답변 반환
    1. DB에서 이전 대화 히스토리 로드
    2. 그래프 실행
    3. 사용자 질문 + AI 답변 DB 저장
    """
    # 1. DB에서 히스토리 로드 → LangChain 메시지 형식으로 변환
    history = load_history(session_id)
    past_messages = []
    for h in history[-(MAX_HISTORY_TURNS * 2):]:
        if h["sender"] == "user":
            past_messages.append(HumanMessage(content=h["content"]))
        else:
            past_messages.append(AIMessage(content=h["content"]))

    # 2. 그래프 실행 (현재 질문은 question 필드로만 전달, messages는 과거 히스토리만)
    result = graph.invoke({
        "messages": past_messages,
        "question": user_msg,
    })

    answer = result.get("answer", "답변을 생성할 수 없습니다.")

    return answer
