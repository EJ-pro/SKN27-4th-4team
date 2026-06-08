from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import AIMessage

from .state import RAGChatState
from .llm import get_llm, get_classify_llm
from .db import vector_search, keyword_search, rows_to_documents, get_muscles_by_body_part
from .constants import ENABLE_RERANK, RETRIEVE_LIMIT, RETRIEVE_SPECIFIC_LIMIT, MAX_HISTORY_TURNS, QUERY_TYPES, OUT_OF_SCOPE_MESSAGE, RERANK_MODEL, RERANK_MAX_LENGTH, RERANK_DEVICE, RERANK_CACHE_FOLDER, RERANK_TOP_N

llm = get_llm()
classify_llm = get_classify_llm()
cross_encoder = None

# muscles 테이블에 직접 없는 관절·부위 → 대표 근육 키워드 매핑
# (get_muscles_by_body_part가 빈 결과일 때 정밀 제외(브릿지 테이블)를 쓰기 위함)
JOINT_TO_MUSCLE_HINTS: dict[str, list[str]] = {
    "무릎": ["대퇴사두근", "햄스트링", "종아리"],
    "발목": ["종아리", "비복근"],
    "손목": ["전완"],
    "팔꿈치": ["이두근", "삼두근", "전완"],
    "허리": ["척추기립근", "기립근"],
    "고관절": ["둔근"],
}

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


def _rewrite_query(state: RAGChatState) -> str:
    """멀티턴 대응: 대화 히스토리를 반영해 '검색용 질문'을 재작성.

    예) 이전에 '벤치프레스'를 설명한 뒤 "그거 호흡법은?" → "벤치프레스 호흡법"
    - 히스토리가 없으면 원문 그대로 반환(불필요한 LLM 호출·오버헤드 방지)
    - 결정론적 결과를 위해 분류용(temperature=0) LLM 사용
    """
    question = state["question"]
    history_text = _get_history_text(state)
    if not history_text:
        return question

    prompt = ChatPromptTemplate.from_template(
        "이전 대화를 참고해 현재 질문을 그 자체로 이해 가능한 '검색용 질문'으로 다시 쓰세요.\n"
        "- '그거', '방금 그 운동', '아까 그것' 같은 지시 표현을 이전 대화가 가리키는 실제 운동/대상으로 바꾸세요.\n"
        "- 이미 명확하거나 이전 대화와 무관하면 현재 질문을 그대로 두세요.\n"
        "- 다시 쓴 질문 한 문장만 출력하세요. 설명·따옴표 금지.\n\n"
        "[이전 대화]\n{history}\n\n"
        "현재 질문: {question}\n"
        "다시 쓴 질문:"
    )
    rewritten = (prompt | classify_llm | StrOutputParser()).invoke({
        "history": history_text,
        "question": question,
    }).strip()
    rewritten = rewritten or question
    if rewritten != question:
        print(f"[rewrite_query] '{question}' → '{rewritten}'")
    return rewritten


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
    """일반 추천 질문: 카테고리·장비 힌트 추출 후 벡터 유사도 검색"""
    question = state["question"]
    search_query = _rewrite_query(state)  # 멀티턴: 히스토리 반영한 검색어

    # LLM으로 카테고리/장비 힌트 동적 추출
    # 카테고리 목록은 실제 DB 값과 일치해야 함:
    #   하체 / 코어 / 등 / 어깨 / 가슴 / 스트레칭 / 유산소 / 이두 / 삼두 / 전완근
    # ('팔'·'전신' 같은 DB에 없는 값을 쓰면 필터가 0건→무필터 폴백으로 카테고리가 섞임)
    filter_prompt = ChatPromptTemplate.from_template(
        "다음 질문에서 운동 카테고리와 장비 힌트를 추출하세요.\n"
        "카테고리는 다음 중에서만 고르세요: 가슴, 등, 어깨, 하체, 코어, 스트레칭, 유산소, 이두, 삼두, 전완근.\n"
        "- '팔' 운동은 이두/삼두/전완근에 해당하니 관련 카테고리를 쉼표로 모두 적으세요 (예: 이두,삼두,전완근).\n"
        "- 여러 부위가 해당하면 쉼표로 나열하세요. 해당 없으면 빈 값.\n"
        "장비가 '맨몸' 또는 '장비 없음'인 경우 equipment=body 로 답하세요.\n\n"
        "질문: {question}\n\n"
        "아래 형식으로만 답하세요 (값이 없으면 빈 칸):\n"
        "category: (카테고리)\n"
        "equipment: (장비)"
    )
    hint_text = (filter_prompt | llm | StrOutputParser()).invoke({"question": search_query}).strip()

    # 힌트 파싱
    where_parts, params = [], []
    for line in hint_text.splitlines():
        if line.startswith("category:"):
            val = line.split(":", 1)[1].strip()
            # 쉼표로 여러 카테고리가 오면 OR로 묶음 (예: '팔' → 이두 OR 삼두 OR 전완근)
            cats = [c.strip() for c in val.split(",") if c.strip()]
            if cats:
                ors = " OR ".join(["category ILIKE %s"] * len(cats))
                where_parts.append(f"({ors})")
                params.extend(f"%{c}%" for c in cats)
        elif line.startswith("equipment:"):
            val = line.split(":", 1)[1].strip()
            if val:
                where_parts.append("equipment ILIKE %s")
                params.append(f"%{val}%")

    where_clause = " AND ".join(where_parts) if where_parts else ""
    rows = vector_search(search_query, limit=RETRIEVE_LIMIT, where_clause=where_clause, params=params if params else None)

    # 필터 적용 결과가 없으면 필터 없이 재검색
    if not rows and where_clause:
        print(f"[retrieve_general] 필터 결과 없음 → 필터 제거 후 재검색")
        rows = vector_search(search_query, limit=RETRIEVE_LIMIT)

    docs, sources = rows_to_documents(rows)
    print(f"[retrieve_general] 검색된 운동 수: {len(docs)} (힌트: {hint_text.replace(chr(10), ' | ')})")
    return {**state, "search_query": search_query, "retrieved_docs": docs, "sources": sources}


# ────────────────────────────────────────────
# 노드 2-2: retrieve_specific
# ────────────────────────────────────────────
def retrieve_specific(state: RAGChatState) -> RAGChatState:
    """특정 운동 질문: 운동명 추출 후 정확 검색"""
    question = state["question"]
    search_query = _rewrite_query(state)  # 멀티턴: 히스토리 반영한 검색어

    extract_prompt = ChatPromptTemplate.from_template("""
다음 질문에서 운동 이름만 추출하세요. 운동 이름만 답하세요.
질문: {question}
운동 이름:
""")
    chain = extract_prompt | llm | StrOutputParser()
    exercise_name = chain.invoke({"question": search_query}).strip()

    rows = keyword_search(exercise_name, limit=RETRIEVE_SPECIFIC_LIMIT)

    if not rows:
        print(f"[retrieve_specific] '{exercise_name}' 미발견 → 벡터 검색 폴백")
        rows = vector_search(search_query, limit=RETRIEVE_SPECIFIC_LIMIT)

    docs, sources = rows_to_documents(rows)
    print(f"[retrieve_specific] 검색된 운동 수: {len(docs)}")
    return {**state, "search_query": search_query, "retrieved_docs": docs, "sources": sources}


# ────────────────────────────────────────────
# 노드 2-3: retrieve_injury
# ────────────────────────────────────────────
def retrieve_injury(state: RAGChatState) -> RAGChatState:
    """통증/부상 질문: 부상 부위 제외 후 벡터 검색"""
    question = state["question"]
    search_query = _rewrite_query(state)  # 멀티턴: 히스토리 반영한 검색어

    extract_prompt = ChatPromptTemplate.from_template("""
다음 질문에서 아픈 부위나 부상 부위만 추출하세요. 부위만 답하세요.
질문: {question}
부위:
""")
    chain = extract_prompt | llm | StrOutputParser()
    injury_part = chain.invoke({"question": search_query}).strip()

    # DB에서 부상 부위에 해당하는 근육명 목록 조회
    muscle_names = get_muscles_by_body_part(injury_part)

    # 근육 테이블에 직접 없는 관절·부위(무릎·손목 등)는 대표 근육으로 매핑해 재조회
    if not muscle_names:
        for hint in JOINT_TO_MUSCLE_HINTS.get(injury_part, []):
            muscle_names.extend(get_muscles_by_body_part(hint))
        muscle_names = list(dict.fromkeys(muscle_names))  # 중복 제거

    # 부상자에게 고급 난이도 운동은 위험 → injury 분기에서는 항상 제외
    safety_clause = "difficulty <> '고급'"

    if muscle_names:
        # exercise_muscles 브릿지 테이블로 정확하게 해당 근육 사용 운동 제외
        placeholders = ",".join(["%s"] * len(muscle_names))
        where_clause = f"""
            {safety_clause}
            AND exercise_id NOT IN (
                SELECT em.exercise_id FROM exercise_muscles em
                JOIN muscles m ON em.muscle_id = m.muscle_id
                WHERE m.name_kor IN ({placeholders})
            )
        """
        params = list(muscle_names)
        print(f"[retrieve_injury] DB 근육 필터: {muscle_names}")
    else:
        # 매핑도 실패한 부위는 텍스트 매칭으로 폴백 (고급 제외는 유지)
        where_clause = (
            f"{safety_clause} "
            "AND target_primary NOT ILIKE %s AND target_secondary::text NOT ILIKE %s"
        )
        params = [f"%{injury_part}%", f"%{injury_part}%"]
        print(f"[retrieve_injury] 텍스트 폴백 필터: {injury_part}")

    rows = vector_search(
        search_query,
        limit=RETRIEVE_LIMIT,
        where_clause=where_clause,
        params=params
    )
    docs, sources = rows_to_documents(rows)

    if docs:
        docs = _rerank_docs(search_query, docs)
        sources = [doc.metadata["name_kor"] for doc in docs]

    print(f"[retrieve_injury] 검색된 운동 수: {len(docs)} (부상 부위: {injury_part} 제외, rerank 적용)")
    return {**state, "search_query": search_query, "retrieved_docs": docs, "sources": sources}


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

    # 부상 질문이면 안전 가이드를 프롬프트에 추가 (환각 방지)
    query_type = state.get("query_type", "")
    injury_block = ""
    if query_type == "injury":
        injury_block = (
            "[부상 주의]\n"
            "- 사용자가 통증·부상을 언급했습니다. [운동 데이터]에 있는 운동만 추천하세요.\n"
            "- 특정 운동이 특정 부위에 '안전하다/부담이 적다'는 판단은 데이터에 명시된 근거가 "
            "있을 때만 하고, 없으면 단정하지 마세요.\n\n"
        )

    prompt = ChatPromptTemplate.from_template(
        "당신은 AI 운동 전문가 챗봇입니다.\n\n"
        "[답변 규칙]\n"
        "1. 운동 동작·자세·호흡법·주의사항은 반드시 아래 [운동 데이터]를 기반으로 답변하세요.\n"
        "2. 훈련 방법론(세트 수, 반복 수, 주기화 등)은 전문 지식으로 보완할 수 있습니다.\n"
        "3. 영양·수면·멘탈 등 운동과 직접 관련 없는 주제는 다루지 마세요.\n"
        "4. 설명이 필요한 경우 항목별로 구분해서 작성하고, 불필요한 내용은 생략하세요.\n"
        "5. [운동 데이터]의 필드(카테고리:, 주 타겟 근육: 등)를 그대로 출력하지 말고 자연스러운 문장으로 변환하세요.\n"
        "6. [운동 데이터]에 없는 운동(예: 수영·자전거)이나 데이터로 확인되지 않는 안전성·효과는 단정하지 마세요.\n"
        "7. 질문의 핵심에 먼저 간결하게 답하고, 묻지 않은 부수 설명은 최소화하세요.\n\n"
        "{injury_block}"
        "{history_block}"
        "[운동 데이터]\n"
        "{context}\n\n"
        "질문: {question}"
    )
    answer = (prompt | llm | StrOutputParser()).invoke({
        "injury_block": injury_block,
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
