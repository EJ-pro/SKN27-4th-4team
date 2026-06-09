"""Django 전역 LLM·Embedding 발신 라우터 (에픽09)."""

import re
import time
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama

from api.services.chatbot.constants import (
    LLM_PROVIDER, EMBEDDING_PROVIDER,
    OPENAI_LLM_MODEL, OPENAI_EMBEDDING_MODEL,
    LLM_TEMPERATURE, LLM_TEMPERATURE_CLASSIFY,
    REMOTE_LLM_BASE_URL, REMOTE_LLM_MODEL, REMOTE_EMBEDDING_MODEL, REMOTE_API_KEY,
    GROQ_API_KEY, GROQ_MODEL, OLLAMA_BASE_URL, OLLAMA_MODEL,
)
# JSON 파싱 — recommendation_service에 의존해도 됨 (api → recommendation_service는 이미 존재)
from recommendation_service.json_utils import extract_json_object

# 입력 받을 수 있는 타입 고정 (ollama / openai/ groq / 외부 url)
_ALLOWED = frozenset(("openai", "groq", "ollama", "remote"))

def _require_provider(name: str) -> str:
    prov = (name or "").strip().lower()

    # 입력 받은 타입이 고정된 타입에 없으면 에러 발생
    if prov not in _ALLOWED:
        raise RuntimeError(f"invalid provider: {name!r}. Allowed: {sorted(_ALLOWED)}")

    # 입력 받은 타입 리턴
    return prov


def _chat_model(*, temperature: float, streaming: bool = False) -> None:
    provider = _require_provider(LLM_PROVIDER)

    # provider 종류에 따라 분기 
    if provider == "remote":
        return ChatOpenAI(
            model=REMOTE_LLM_MODEL,
            temperature=temperature,
            base_url=REMOTE_LLM_BASE_URL,
            api_key=REMOTE_API_KEY,
            streaming=streaming,
        )

    elif provider == "groq":
        return ChatGroq(
            model=GROQ_MODEL,
            api_key=GROQ_API_KEY,
            temperature=temperature,
            streaming=streaming,
        )

    elif provider == "ollama":
        return ChatOllama(
            model=OLLAMA_MODEL,
            base_url=OLLAMA_BASE_URL,
            temperature=temperature,
            streaming=streaming,
        )
    
    return ChatOpenAI(model=OPENAI_LLM_MODEL, temperature=temperature, streaming=streaming)


def get_llm() -> ChatOpenAI:
    return _chat_model(temperature=LLM_TEMPERATURE, streaming=True)

def get_classify_llm() -> ChatOpenAI:
    return _chat_model(temperature=LLM_TEMPERATURE_CLASSIFY, streaming=False)

def get_embedding_model() -> OpenAIEmbeddings:
    embedding_provider = _require_provider(EMBEDDING_PROVIDER)
    if embedding_provider == "remote":
        return OpenAIEmbeddings(model=REMOTE_EMBEDDING_MODEL, base_url=REMOTE_LLM_BASE_URL, api_key=REMOTE_API_KEY)
    
    return OpenAIEmbeddings(model=OPENAI_EMBEDDING_MODEL)


# ----------------------------------------------
# 추천 LangGraph 호환
# ----------------------------------------------
def _invoke_temperature() -> float:
    """기존 추천: groq 0.1, ollama 0.2"""
    provider = _require_provider(LLM_PROVIDER)
    return 0.2 if provider == "ollama" else 0.1
def _invoke_with_retry(messages: list, max_attempts: int = 3) -> Any:
    last_error: Exception | None = None
    llm = _chat_model(temperature=_invoke_temperature(), streaming=False)
    for attempt in range(max_attempts):
        try:
            return llm.invoke(messages)
        except Exception as exc:
            last_error = exc
            message = str(exc)
            if "rate_limit" not in message.lower() and "rate limit" not in message.lower():
                raise
            if attempt == max_attempts - 1:
                raise
            time.sleep(_retry_after_seconds(message))
    raise last_error or RuntimeError("LLM invocation failed.")
def _retry_after_seconds(error_message: str) -> float:
    match = re.search(r"try again in ([0-9.]+)s", error_message, flags=re.IGNORECASE)
    if match:
        return min(float(match.group(1)) + 1.0, 30.0)
    return 8.0
def invoke_json(system: str, user: str) -> dict[str, Any]:
    response = _invoke_with_retry([
        SystemMessage(content=system),
        HumanMessage(content=user),
    ])
    return extract_json_object(str(response.content))
def invoke_text(system: str, user: str) -> str:
    response = _invoke_with_retry([
        SystemMessage(content=system),
        HumanMessage(content=user),
    ])
    return str(response.content).strip()
