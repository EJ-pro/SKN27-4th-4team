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
    question: str                           # 사용자 질문
    retrieved_docs: List[Document]          # 검색된 운동 문서들
    context: str                            # 검색된 문서들을 결합한 컨텍스트
    answer: str                             # 최종 답변
    sources: List[str]                      # 출처 정보 (운동명)
    messages: Annotated[List[Any], add_messages]  # 대화 히스토리


# ────────────────────────────────────────────
# 노드 1: retrieve
# ────────────────────────────────────────────
def retrieve(state: RAGState) -> RAGState:
    """사용자 질문을 벡터로 변환 후 pgvector에서 유사한 운동 검색"""
    question = state["question"]

    # 질문을 벡터로 변환
    query_vector = embedding_model.embed_query(question)

    # pgvector 유사도 검색
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

    # Document 형태로 변환
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

    return {**state, "retrieved_docs": docs, "sources": sources}


# ────────────────────────────────────────────
# 노드 2: generate
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
# 그래프 구성
# ────────────────────────────────────────────
def create_rag_graph():
    workflow = StateGraph(RAGState)

    workflow.add_node("retrieve", retrieve)
    workflow.add_node("generate", generate)

    workflow.add_edge(START, "retrieve")
    workflow.add_edge("retrieve", "generate")
    workflow.add_edge("generate", END)

    return workflow.compile()



