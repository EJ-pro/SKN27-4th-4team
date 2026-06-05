import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import psycopg2
from typing import List, Any
from typing_extensions import TypedDict, Annotated

from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
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
    query_type: str                                 # 질문 유형: general / specific / injury
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
# 노드 1: classify
# 질문 유형을 LLM으로 분류
# ────────────────────────────────────────────
def classify(state: RAGState) -> RAGState:
    """사용자 질문을 3가지 유형으로 분류"""
    question = state["question"]

    prompt = ChatPromptTemplate.from_template("""
사용자의 운동 관련 질문을 아래 3가지 유형 중 하나로 분류하세요.

- general: 운동 추천, 루틴 구성 등 일반적인 추천 질문
  예) "가슴 운동 추천해줘", "초급자용 하체 운동 알려줘"
- specific: 특정 운동의 자세, 호흡법, 방법 등 세부 정보 질문
  예) "덤벨 풀오버 호흡법", "스쿼트 시작 자세 알려줘"
- injury: 통증, 부상, 재활 관련 질문
  예) "무릎이 아픈데 할 수 있는 운동", "허리 통증 있을 때 운동"

반드시 general, specific, injury 중 하나만 답하세요.

질문: {question}
유형:
""")

    chain = prompt | llm | StrOutputParser()
    query_type = chain.invoke({"question": question}).strip().lower()

    if query_type not in ("general", "specific", "injury"):
        query_type = "general"

    print(f"[classify] 질문 유형: {query_type}")
    return {**state, "query_type": query_type}


# ────────────────────────────────────────────
# 노드 2-1: retrieve_general
# 일반 추천 질문 — 벡터 유사도 검색
# ────────────────────────────────────────────
def retrieve_general(state: RAGState) -> RAGState:
    """일반 추천 질문: 벡터 유사도로 상위 5개 운동 검색"""
    query_vector = embedding_model.embed_query(state["question"])

    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT exercise_id, name_kor, category, target_primary, target_secondary,
               difficulty, equipment, default_duration_min,
               description, starting_position, movement, breathing,
               related_exercises, guide, caution
        FROM exercises
        ORDER BY embedding <-> %s::vector
        LIMIT 5
        """,
        (query_vector,)
    )
    rows = cursor.fetchall()
    cursor.close()

    docs, sources = rows_to_documents(rows)
    print(f"[retrieve_general] 검색된 운동 수: {len(docs)}")
    return {**state, "retrieved_docs": docs, "sources": sources}


# ────────────────────────────────────────────
# 노드 2-2: retrieve_specific
# 특정 운동 세부 질문 — 운동명 기반 정확 검색
# ────────────────────────────────────────────
def retrieve_specific(state: RAGState) -> RAGState:
    """특정 운동 질문: 운동명을 추출해서 정확한 데이터 검색"""
    question = state["question"]

    # LLM으로 질문에서 운동명 추출
    extract_prompt = ChatPromptTemplate.from_template("""
다음 질문에서 운동 이름만 추출하세요. 운동 이름만 답하세요.
질문: {question}
운동 이름:
""")
    chain = extract_prompt | llm | StrOutputParser()
    exercise_name = chain.invoke({"question": question}).strip()

    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT exercise_id, name_kor, category, target_primary, target_secondary,
               difficulty, equipment, default_duration_min,
               description, starting_position, movement, breathing,
               related_exercises, guide, caution
        FROM exercises
        WHERE name_kor ILIKE %s
        LIMIT 3
        """,
        (f"%{exercise_name}%",)
    )
    rows = cursor.fetchall()
    cursor.close()

    # 운동명으로 못 찾으면 벡터 검색으로 폴백
    if not rows:
        query_vector = embedding_model.embed_query(question)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT exercise_id, name_kor, category, target_primary, target_secondary,
                   difficulty, equipment, default_duration_min,
                   description, starting_position, movement, breathing,
                   related_exercises, guide, caution
            FROM exercises
            ORDER BY embedding <-> %s::vector
            LIMIT 3
            """,
            (query_vector,)
        )
        rows = cursor.fetchall()
        cursor.close()

    docs, sources = rows_to_documents(rows)
    print(f"[retrieve_specific] 검색된 운동 수: {len(docs)}")
    return {**state, "retrieved_docs": docs, "sources": sources}


# ────────────────────────────────────────────
# 노드 2-3: retrieve_injury
# 통증/부상 질문 — 통증 부위 관련 운동 제외하고 대체 운동 검색
# ────────────────────────────────────────────
def retrieve_injury(state: RAGState) -> RAGState:
    """통증/부상 질문: 부상 부위를 자극하지 않는 대체 운동 검색"""
    question = state["question"]
    query_vector = embedding_model.embed_query(question)

    # LLM으로 통증 부위 추출
    extract_prompt = ChatPromptTemplate.from_template("""
다음 질문에서 아픈 부위나 부상 부위만 추출하세요. 부위만 답하세요.
질문: {question}
부위:
""")
    chain = extract_prompt | llm | StrOutputParser()
    injury_part = chain.invoke({"question": question}).strip()

    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT exercise_id, name_kor, category, target_primary, target_secondary,
               difficulty, equipment, default_duration_min,
               description, starting_position, movement, breathing,
               related_exercises, guide, caution
        FROM exercises
        WHERE target_primary NOT ILIKE %s
        ORDER BY embedding <-> %s::vector
        LIMIT 5
        """,
        (f"%{injury_part}%", query_vector)
    )
    rows = cursor.fetchall()
    cursor.close()

    docs, sources = rows_to_documents(rows)
    print(f"[retrieve_injury] 검색된 운동 수: {len(docs)} (부상 부위: {injury_part} 제외)")
    return {**state, "retrieved_docs": docs, "sources": sources}


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
    }.get(state["query_type"], "retrieve_general")


# ────────────────────────────────────────────
# 그래프 구성
# ────────────────────────────────────────────
def create_rag_graph():
    workflow = StateGraph(RAGState)

    workflow.add_node("classify", classify)
    workflow.add_node("retrieve_general", retrieve_general)
    workflow.add_node("retrieve_specific", retrieve_specific)
    workflow.add_node("retrieve_injury", retrieve_injury)
    workflow.add_node("generate", generate)

    workflow.add_edge(START, "classify")
    workflow.add_conditional_edges(
        "classify",
        route_by_query_type,
        {
            "retrieve_general": "retrieve_general",
            "retrieve_specific": "retrieve_specific",
            "retrieve_injury": "retrieve_injury",
        }
    )
    workflow.add_edge("retrieve_general", "generate")
    workflow.add_edge("retrieve_specific", "generate")
    workflow.add_edge("retrieve_injury", "generate")
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
    run_rag("덤벨 풀오버의 호흡법은 무엇인가요?")
