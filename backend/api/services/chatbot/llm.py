"""챗봇 호환 re-export — 구현은 api.services.llm.router."""
from api.services.llm.router import get_classify_llm, get_embedding_model, get_llm

__all__ = ["get_llm", "get_classify_llm", "get_embedding_model"]