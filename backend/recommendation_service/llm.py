"""추천 LangGraph 호환 re-export — 구현은 api.services.llm.router."""
from api.services.llm.router import invoke_json, invoke_text

__all__ = ["invoke_json", "invoke_text"]
