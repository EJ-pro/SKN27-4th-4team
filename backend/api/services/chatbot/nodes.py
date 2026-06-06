from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import AIMessage

from .state import RAGChatState
from .llm import get_llm, get_classify_llm
from .db import vector_search, keyword_search, rows_to_documents
from .constants import ENABLE_RERANK, RETRIEVE_LIMIT, RETRIEVE_SPECIFIC_LIMIT, MAX_HISTORY_TURNS, QUERY_TYPES, OUT_OF_SCOPE_MESSAGE, RERANK_MODEL, RERANK_MAX_LENGTH, RERANK_DEVICE, RERANK_CACHE_FOLDER, RERANK_TOP_N

llm = get_llm()
classify_llm = get_classify_llm()
cross_encoder = None

# CrossEncoder 전역 1회 로드 (모델은 RERANK_CACHE_FOLDER에 캐싱됨)


def _get_cross_encoder():
    global cross_encoder
    if cross_encoder is None:
        from sentence_transformers import CrossEncoder

        cross_encoder = CrossEncoder(
            model_name_or_path=RERANK_MODEL,
            max_length=RERANK_MAX_LENGTH,
            device=RERANK_DEVICE,
            cache_folder=RERANK_CACHE_FOLDER,
        )
    return cross_encoder


def _rerank_docs(query: str, docs: list) -> list:
    """CrossEncoder로 쿼리-문서 쌍 관련성 점수 계산 후 재정렬"""
    if not ENABLE_RERANK or not docs:
        return docs
    pairs = [[query, doc.page_content] for doc in docs]
    scores = _get_cross_encoder().predict(pairs, batch_size=1)
    doc_score_pairs = sorted(zip(docs, scores), key=lambda x: x[1], reverse=True)
    return [doc for doc, _ in doc_score_pairs[:RERANK_TOP_N]]


def _get_history_text(state: RAGChatState) -> str:
    """state의 messages에서 최근 히스토리를 텍스트로 변환"""
    past_messages = state.get("messages", [])
    recent = past_messages[-(MAX_HISTORY_TURNS * 2):]
    if not recent:
        return ""
    lines = []
    for msg in recent:
        role = "사용자" if msg.type == "human" else "AI"
        lines.append(f"{role}: {msg.content}")
    return "\n".join(lines)


# ────────────────────────────────────────────
# 노드 1: classify
# 이전 대화 히스토리를 포함해서 분류 → 맥락 의존 질문도 처리
# 카테고리 추가/수정은 constants.py의 QUERY_TYPES만 변경하면 됨
# ────────────────────────────────────────────
def classify(state: RAGChatState) -> RAGChatState:
    """사용자 질문을 QUERY_TYPES 유형으로 분류 (히스토리 포함)"""
    question = state["question"]
    history_text = _get_history_text(state)

    categories_text = "\n".join(f"- {k}: {v}" for k, v in QUERY_TYPES.items())
    valid_keys = ", ".join(QUERY_TYPES.keys())
    history_block = f"[이전 대화]\n{history_text}\n\n" if history_text else ""

    prompt = ChatPromptTemplate.from_template(
        "당신은 사용자 질문을 분류하는 전문가입니다.\n"
        "{history_block}"
        "아래 유형 중 하나로 분류하세요:\n\n"
        "{categories}\n\n"
        "이전 대화가 있으면 맥락을 고려하세요. 판단이 애매하면 general로 분류하세요.\n"
        "반드시 {valid_keys} 중 하나만 답하세요.\n\n"
        "현재 질문: {question}\n"
        "유형:"
    )

    query_type = (prompt | classify_llm | StrOutputParser()).invoke({
        "history_block": history_block,
        "categories": categories_text,
        "valid_keys": valid_keys,
        "question": question,
    }).strip().lower()

    if query_type not in QUERY_TYPES:
        query_type = "general"

    print(f"[classify] 질문 유형: {query_type}")
    return {**state, "query_type": query_type}


# ────────────────────────────────────────────
# 노드 1-1: out_of_scope
# 운동 무관 질문 → 검색/생성 없이 즉시 종료
# ────────────────────────────────────────────
def out_of_scope(state: RAGChatState) -> RAGChatState:
    """비운동 질문: 검색·생성 없이 즉시 거부 메시지 반환"""
    return {
        **state,
        "answer": OUT_OF_SCOPE_MESSAGE,
        "messages": [AIMessage(content=OUT_OF_SCOPE_MESSAGE)],
    }


# ────────────────────────────────────────────
# 노드 2-1: retrieve_general
# ────────────────────────────────────────────
def retrieve_general(state: RAGChatState) -> RAGChatState:
    """일반 추천 질문: 벡터 유사도 검색"""
    rows = vector_search(state["question"], limit=RETRIEVE_LIMIT)
    docs, sources = rows_to_documents(rows)

    print(f"[retrieve_general] 검색된 운동 수: {len(docs)}")
    return {**state, "retrieved_docs": docs, "sources": sources}


# ────────────────────────────────────────────
# 노드 2-2: retrieve_specific
# ────────────────────────────────────────────
def retrieve_specific(state: RAGChatState) -> RAGChatState:
    """특정 운동 질문: 운동명 추출 후 정확 검색"""
    question = state["question"]

    extract_prompt = ChatPromptTemplate.from_template("""
다음 질문에서 운동 이름만 추출하세요. 운동 이름만 답하세요.
질문: {question}
운동 이름:
""")
    chain = extract_prompt | llm | StrOutputParser()
    exercise_name = chain.invoke({"question": question}).strip()

    rows = keyword_search(exercise_name, limit=RETRIEVE_SPECIFIC_LIMIT)

    if not rows:
        print(f"[retrieve_specific] '{exercise_name}' 미발견 → 벡터 검색 폴백")
        rows = vector_search(question, limit=RETRIEVE_SPECIFIC_LIMIT)

    docs, sources = rows_to_documents(rows)
    print(f"[retrieve_specific] 검색된 운동 수: {len(docs)}")
    return {**state, "retrieved_docs": docs, "sources": sources}


# ────────────────────────────────────────────
# 노드 2-3: retrieve_injury
# ────────────────────────────────────────────
def retrieve_injury(state: RAGChatState) -> RAGChatState:
    """통증/부상 질문: 부상 부위 제외 후 벡터 검색"""
    question = state["question"]

    extract_prompt = ChatPromptTemplate.from_template("""
다음 질문에서 아픈 부위나 부상 부위만 추출하세요. 부위만 답하세요.
질문: {question}
부위:
""")
    chain = extract_prompt | llm | StrOutputParser()
    injury_part = chain.invoke({"question": question}).strip()

    rows = vector_search(
        question,
        limit=RETRIEVE_LIMIT,
        where_clause="target_primary NOT ILIKE %s",
        params=[f"%{injury_part}%"]
    )
    docs, sources = rows_to_documents(rows)

    if docs:
        docs = _rerank_docs(question, docs)
        sources = [doc.metadata["name_kor"] for doc in docs]

    print(f"[retrieve_injury] 검색된 운동 수: {len(docs)} (부상 부위: {injury_part} 제외, rerank 적용)")
    return {**state, "retrieved_docs": docs, "sources": sources}


# ────────────────────────────────────────────
# 노드 3: generate
# ────────────────────────────────────────────
def generate(state: RAGChatState) -> RAGChatState:
    """검색된 운동 데이터 + 대화 히스토리로 답변 생성"""
    question = state["question"]
    docs = state["retrieved_docs"]
    context = "\n\n".join([doc.page_content for doc in docs])
    history_text = _get_history_text(state)

    history_block = f"[이전 대화]\n{history_text}\n\n" if history_text else ""

    prompt = ChatPromptTemplate.from_template(
        "당신은 AI 운동 전문가 챗봇입니다.\n"
        "제공된 운동 데이터를 우선 참고하여 답변하고, 데이터가 부족하면 운동 전문가 지식으로 보완하세요.\n\n"
        "{history_block}"
        "[운동 데이터]\n"
        "{context}\n\n"
        "질문: {question}"
    )
    answer = (prompt | llm | StrOutputParser()).invoke({
        "history_block": history_block,
        "context": context,
        "question": question,
    })

    print("[generate] 답변 생성 완료")
    return {
        **state,
        "context": context,
        "answer": answer,
        "messages": [AIMessage(content=answer)],
    }
