import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import psycopg2
from typing import List, Any
from typing_extensions import TypedDict, Annotated

from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages


# ────────────────────────────────────────────
# DB 연결 (전역 1회)
# ────────────────────────────────────────────
conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT")),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
)


# ────────────────────────────────────────────
# 모델 설정
# ────────────────────────────────────────────
embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")

llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.7,
)


# ────────────────────────────────────────────
# State 정의
# ────────────────────────────────────────────
class RAGState(TypedDict):
    question: str                                   # 사용자 질문
    query_type: str                                 # 도메인 유형: general / specific / injury / out_of_scope
    complexity: str                                 # 복잡도: simple / complex
    retrieved_docs: List[Document]                  # 검색된 운동 문서들
    context: str                                    # 검색된 문서들을 결합한 컨텍스트
    answer: str                                     # 최종 답변
    sources: List[str]                              # 출처 정보 (운동명)
    messages: Annotated[List[Any], add_messages]    # 대화 히스토리


# ────────────────────────────────────────────
# 공통 함수: DB rows → List[Document]
# ────────────────────────────────────────────
def rows_to_documents(rows) -> tuple[list[Document], list[str]]:
    docs = []
    for row in rows:
        (exercise_id, name_kor, category, target_primary, target_secondary,
         difficulty, equipment, default_duration_min,
         description, starting_position, movement, breathing,
         related_exercises, guide, caution) = row

        content = f"운동명: {name_kor}\n카테고리: {category}\n타겟 근육: {target_primary}\n난이도: {difficulty}\n장비: {equipment or '맨몸'}\n기본 운동 시간: {default_duration_min}분"
        if description:
            content += f"\n설명: {description}"
        if starting_position:
            content += f"\n시작 자세: {starting_position}"
        if movement:
            content += f"\n동작 방법: {movement}"
        if breathing:
            content += f"\n호흡법: {breathing}"
        if related_exercises:
            content += f"\n관련 운동: {related_exercises}"
        if guide:
            content += f"\n운동 방법: {guide}"
        if caution:
            content += f"\n주의사항: {caution}"

        docs.append(Document(
            page_content=content,
            metadata={"exercise_id": exercise_id, "name_kor": name_kor}
        ))

    sources = [doc.metadata["name_kor"] for doc in docs]
    return docs, sources


# ────────────────────────────────────────────
# 공통 함수: pgvector 유사도 검색
# ────────────────────────────────────────────
SELECT_COLUMNS = """
    SELECT exercise_id, name_kor, category, target_primary, target_secondary,
           difficulty, equipment, default_duration_min,
           description, starting_position, movement, breathing,
           related_exercises, guide, caution
    FROM exercises
"""

def vector_search(query: str, limit: int = 5, where_clause: str = "", params: list = None) -> list:
    """벡터 유사도 검색 공통 함수"""
    query_vector = embedding_model.embed_query(query)
    all_params = (params or []) + [query_vector, limit]

    sql = SELECT_COLUMNS
    if where_clause:
        sql += f" WHERE {where_clause}"
    sql += " ORDER BY embedding <-> %s::vector LIMIT %s"

    cursor = conn.cursor()
    cursor.execute(sql, all_params)
    rows = cursor.fetchall()
    cursor.close()
    return rows


# ────────────────────────────────────────────
# Multi-Query 생성 함수 (강의 자료 참고)
# 복잡한 질문을 3가지 다른 버전으로 생성
# ────────────────────────────────────────────
query_generation_prompt = PromptTemplate(
    input_variables=["question"],
    template="""
당신은 AI 운동 전문가 어시스턴트입니다.
벡터 데이터베이스에서 관련 운동 데이터를 검색하기 위해
주어진 사용자 질문을 3가지 다른 버전으로 생성하세요.
여러 관점을 생성하여 검색의 한계를 극복하는 것이 목표입니다.
줄바꿈으로 구분하여 제공하세요.

원본 질문: {question}

대안 질문들:"""
)

query_generation_chain = query_generation_prompt | llm | StrOutputParser()


def multi_query_search(question: str, where_clause: str = "", params: list = None) -> tuple[list[Document], list[str]]:
    """
    Multi-Query 검색: 원본 질문 + 3개 변형 질문으로 검색 후 중복 제거
    복잡한 질문에 사용
    """
    # 3가지 변형 질문 생성
    generated = query_generation_chain.invoke({"question": question})
    sub_queries = [q.strip() for q in generated.strip().split('\n') if q.strip()]

    # 원본 질문 포함
    all_queries = [question] + sub_queries[:3]

    all_rows = []
    seen_ids = set()

    for i, query in enumerate(all_queries, 1):
        print(f"  [Multi-Query {i}/{len(all_queries)}] {query[:50]}...")
        rows = vector_search(query, limit=3, where_clause=where_clause, params=params)
        for row in rows:
            exercise_id = row[0]
            if exercise_id not in seen_ids:
                seen_ids.add(exercise_id)
                all_rows.append(row)

    return rows_to_documents(all_rows)


# ────────────────────────────────────────────
# 노드 1: classify
# 도메인 유형 + 복잡도 동시 분류
# ────────────────────────────────────────────
def classify(state: RAGState) -> RAGState:
    """질문의 도메인 유형과 복잡도를 분류"""
    question = state["question"]

    prompt = ChatPromptTemplate.from_template("""
사용자의 운동 관련 질문을 분석하여 두 가지를 분류하세요.

[도메인 유형]
- general: 운동 추천, 루틴 구성 등 일반적인 추천 질문
- specific: 특정 운동의 자세, 호흡법, 방법 등 세부 정보 질문
- injury: 통증, 부상, 재활 관련 질문
- out_of_scope: 운동과 전혀 관련 없는 질문

[복잡도]
- simple: 단순하고 직접적인 질문 (예: "스쿼트 호흡법", "가슴 운동 추천")
- complex: 다면적이거나 복합적인 질문 (예: "초급자가 집에서 할 수 있는 전신 루틴 짜줘", "무릎 부상 있는데 하체 운동 어떻게 해야 해")

반드시 아래 형식으로만 답하세요:
도메인: [general/specific/injury/out_of_scope]
복잡도: [simple/complex]

질문: {question}
""")

    chain = prompt | llm | StrOutputParser()
    result = chain.invoke({"question": question}).strip()

    # 결과 파싱
    query_type = "general"
    complexity = "simple"

    for line in result.split('\n'):
        if line.startswith("도메인:"):
            val = line.replace("도메인:", "").strip().lower()
            if val in ("general", "specific", "injury", "out_of_scope"):
                query_type = val
        elif line.startswith("복잡도:"):
            val = line.replace("복잡도:", "").strip().lower()
            if val in ("simple", "complex"):
                complexity = val

    print(f"[classify] 도메인: {query_type} / 복잡도: {complexity}")
    return {**state, "query_type": query_type, "complexity": complexity}


# ────────────────────────────────────────────
# 노드 2-1: retrieve_general
# simple → 기본 벡터 검색
# complex → Multi-Query 검색
# ────────────────────────────────────────────
def retrieve_general(state: RAGState) -> RAGState:
    """일반 추천 질문 검색"""
    question = state["question"]
    complexity = state["complexity"]

    if complexity == "complex":
        print("[retrieve_general] 전략: Multi-Query 검색")
        docs, sources = multi_query_search(question)
    else:
        print("[retrieve_general] 전략: 기본 벡터 검색")
        rows = vector_search(question, limit=5)
        docs, sources = rows_to_documents(rows)

    print(f"[retrieve_general] 검색된 운동 수: {len(docs)}")
    return {**state, "retrieved_docs": docs, "sources": sources}


# ────────────────────────────────────────────
# 노드 2-2: retrieve_specific
# 운동명 기반 정확 검색 (복잡도 무관)
# ────────────────────────────────────────────
def retrieve_specific(state: RAGState) -> RAGState:
    """특정 운동 질문: 운동명 추출 후 정확 검색"""
    question = state["question"]

    extract_prompt = ChatPromptTemplate.from_template("""
다음 질문에서 운동 이름만 추출하세요. 운동 이름만 답하세요.
질문: {question}
운동 이름:
""")
    chain = extract_prompt | llm | StrOutputParser()
    exercise_name = chain.invoke({"question": question}).strip()

    cursor = conn.cursor()
    cursor.execute(
        SELECT_COLUMNS + " WHERE name_kor ILIKE %s LIMIT 3",
        (f"%{exercise_name}%",)
    )
    rows = cursor.fetchall()
    cursor.close()

    # 못 찾으면 벡터 검색으로 폴백
    if not rows:
        print(f"[retrieve_specific] '{exercise_name}' 미발견 → 벡터 검색 폴백")
        rows = vector_search(question, limit=3)

    docs, sources = rows_to_documents(rows)
    print(f"[retrieve_specific] 검색된 운동 수: {len(docs)}")
    return {**state, "retrieved_docs": docs, "sources": sources}


# ────────────────────────────────────────────
# 노드 2-3: retrieve_injury
# simple → 기본 벡터 검색 (부상 부위 제외)
# complex → Multi-Query 검색 (부상 부위 제외)
# ────────────────────────────────────────────
def retrieve_injury(state: RAGState) -> RAGState:
    """통증/부상 질문: 부상 부위 제외 후 검색"""
    question = state["question"]
    complexity = state["complexity"]
    # embed_query는 vector_search / multi_query_search 내부에서 처리

    extract_prompt = ChatPromptTemplate.from_template("""
다음 질문에서 아픈 부위나 부상 부위만 추출하세요. 부위만 답하세요.
질문: {question}
부위:
""")
    chain = extract_prompt | llm | StrOutputParser()
    injury_part = chain.invoke({"question": question}).strip()

    where_clause = "target_primary NOT ILIKE %s"
    params = [f"%{injury_part}%"]

    if complexity == "complex":
        print(f"[retrieve_injury] 전략: Multi-Query 검색 (부상 부위: {injury_part} 제외)")
        docs, sources = multi_query_search(question, where_clause=where_clause, params=params)
    else:
        print(f"[retrieve_injury] 전략: 기본 벡터 검색 (부상 부위: {injury_part} 제외)")
        rows = vector_search(question, limit=5, where_clause=where_clause, params=params)
        docs, sources = rows_to_documents(rows)

    print(f"[retrieve_injury] 검색된 운동 수: {len(docs)}")
    return {**state, "retrieved_docs": docs, "sources": sources}


# ────────────────────────────────────────────
# 노드 2-4: handle_out_of_scope
# 운동과 무관한 질문 처리
# ────────────────────────────────────────────
def handle_out_of_scope(state: RAGState) -> RAGState:
    """운동 범위 밖 질문 처리"""
    print("[handle_out_of_scope] 범위 밖 질문")
    answer = "죄송합니다. 저는 운동 관련 질문만 답변할 수 있습니다."
    return {
        **state,
        "retrieved_docs": [],
        "sources": [],
        "context": "",
        "answer": answer,
        "messages": [
            {"role": "user", "content": state["question"]},
            {"role": "assistant", "content": answer},
        ]
    }


# ────────────────────────────────────────────
# 노드 3: generate
# ────────────────────────────────────────────
def generate(state: RAGState) -> RAGState:
    """검색된 운동 데이터를 컨텍스트로 답변 생성"""
    question = state["question"]
    docs = state["retrieved_docs"]
    sources = state.get("sources", [])

    context = "\n\n".join([doc.page_content for doc in docs])
    sources_text = ", ".join(sources) if sources else "출처 정보 없음"

    prompt = ChatPromptTemplate.from_template("""
당신은 AI 운동 루틴 추천 전문가입니다.
아래 운동 데이터를 참고하여 사용자 질문에 답변해주세요.
운동 데이터에 없는 내용은 답변하지 마세요.

운동 데이터:
{context}

질문: {question}

답변 형식:
[답변 내용]

**참고 운동:** {sources}
""")

    chain = prompt | llm | StrOutputParser()
    answer = chain.invoke({
        "context": context,
        "question": question,
        "sources": sources_text
    })

    print(f"[generate] 답변 생성 완료")
    return {
        **state,
        "context": context,
        "answer": answer,
        "messages": [
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ]
    }


# ────────────────────────────────────────────
# Conditional Edge 라우터
# ────────────────────────────────────────────
def route_by_query_type(state: RAGState) -> str:
    """query_type에 따라 retrieve 노드 분기"""
    return {
        "general": "retrieve_general",
        "specific": "retrieve_specific",
        "injury": "retrieve_injury",
        "out_of_scope": "handle_out_of_scope",
    }.get(state["query_type"], "retrieve_general")


def route_after_retrieve(state: RAGState) -> str:
    """out_of_scope는 generate 스킵"""
    if state["query_type"] == "out_of_scope":
        return END
    return "generate"


# ────────────────────────────────────────────
# 그래프 구성
# ────────────────────────────────────────────
def create_rag_graph():
    workflow = StateGraph(RAGState)

    workflow.add_node("classify", classify)
    workflow.add_node("retrieve_general", retrieve_general)
    workflow.add_node("retrieve_specific", retrieve_specific)
    workflow.add_node("retrieve_injury", retrieve_injury)
    workflow.add_node("handle_out_of_scope", handle_out_of_scope)
    workflow.add_node("generate", generate)

    workflow.add_edge(START, "classify")
    workflow.add_conditional_edges(
        "classify",
        route_by_query_type,
        {
            "retrieve_general": "retrieve_general",
            "retrieve_specific": "retrieve_specific",
            "retrieve_injury": "retrieve_injury",
            "handle_out_of_scope": "handle_out_of_scope",
        }
    )
    workflow.add_edge("retrieve_general", "generate")
    workflow.add_edge("retrieve_specific", "generate")
    workflow.add_edge("retrieve_injury", "generate")
    workflow.add_edge("handle_out_of_scope", END)
    workflow.add_edge("generate", END)

    return workflow.compile()


rag_app = create_rag_graph()


# ────────────────────────────────────────────
# 실행 함수
# ────────────────────────────────────────────
def run_rag(question: str):
    print("=" * 60)
    print(f"질문: {question}")
    print("=" * 60)

    result = rag_app.invoke({"question": question})

    print(f"\n답변:\n{result['answer']}")
    return result


if __name__ == "__main__":
    # 단순 질문 테스트
    run_rag("덤벨 풀오버의 호흡법은 무엇인가요?")

    print("\n\n")

    # 복잡한 질문 테스트
    run_rag("초급자가 집에서 할 수 있는 전신 운동 루틴을 짜줘")

    print("\n\n")

    # 범위 밖 질문 테스트
    run_rag("오늘 저녁 메뉴 추천해줘")
