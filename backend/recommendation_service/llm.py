import re
import time
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama
from langchain_groq import ChatGroq

from .config import settings
from .json_utils import extract_json_object


def create_llm():
    if settings.llm_provider == "openai":
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY must be set when LLM_PROVIDER=openai.")
        if not settings.openai_model:
            raise RuntimeError("OPENAI_MODEL or LLM_MODEL must be set when LLM_PROVIDER=openai.")
        return ChatOpenAI(
            model=settings.openai_model,
            api_key=settings.openai_api_key,
            temperature=0.1,
        )

    if settings.llm_provider == "groq":
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY or GROQ must be set when LLM_PROVIDER=groq.")
        if not settings.groq_model:
            raise RuntimeError("GROQ_MODEL or LLM_MODEL must be set when LLM_PROVIDER=groq.")
        return ChatGroq(
            model=settings.groq_model,
            api_key=settings.groq_api_key,
            temperature=0.1,
        )

    if settings.llm_provider == "ollama":
        if not settings.ollama_model:
            raise RuntimeError("OLLAMA_MODEL or LLM_MODEL must be set when LLM_PROVIDER=ollama.")
        return ChatOllama(
            model=settings.ollama_model,
            base_url=settings.ollama_base_url,
            temperature=0.2,
        )

    raise RuntimeError(f"Unsupported LLM_PROVIDER: {settings.llm_provider}")


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


def _invoke_with_retry(messages: list[Any], max_attempts: int = 3) -> Any:
    last_error: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return create_llm().invoke(messages)
        except Exception as exc:
            last_error = exc
            message = str(exc)
            if "rate_limit" not in message.lower() and "rate limit" not in message.lower():
                raise
            if attempt == max_attempts - 1:
                raise
            wait_seconds = _retry_after_seconds(message)
            time.sleep(wait_seconds)
    raise last_error or RuntimeError("LLM invocation failed.")


def _retry_after_seconds(error_message: str) -> float:
    match = re.search(r"try again in ([0-9.]+)s", error_message, flags=re.IGNORECASE)
    if match:
        return min(float(match.group(1)) + 1.0, 30.0)
    return 8.0
