"""
챗봇 오케스트레이션 — LLM 1(조건 파싱) + LLM 2(루틴 생성)
"""
import os
from openai import OpenAI
from .rag import search_similar_exercises, build_context

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


def get_embedding(text: str) -> list[float]:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


def parse_user_conditions(user_message: str) -> dict:
    """LLM 1 — 사용자 메시지에서 운동 조건 파싱"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "사용자의 운동 요청에서 조건을 JSON으로 추출하세요.\n"
                    "형식: {\"time\": 분, \"parts\": [부위], \"pain\": [통증부위], \"level\": 레벨}"
                ),
            },
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
    )
    import json
    return json.loads(response.choices[0].message.content)


def generate_routine(conditions: dict, session_history: list[dict]) -> str:
    """LLM 2 — 파싱된 조건 + RAG 컨텍스트로 루틴 생성"""
    query_text = f"{conditions.get('parts', [])} {conditions.get('level', '')} 운동"
    embedding = get_embedding(query_text)
    exercises = search_similar_exercises(embedding, top_k=10)
    context = build_context(exercises)

    messages = [
        {
            "role": "system",
            "content": (
                f"당신은 전문 피트니스 트레이너입니다.\n"
                f"아래 운동 목록을 참고해 사용자 조건에 맞는 주간 루틴을 추천하세요.\n\n"
                f"[참고 운동]\n{context}"
            ),
        },
        *session_history,
    ]

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
    )
    return response.choices[0].message.content
