from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from .constants import OPENAI_LLM_MODEL, OPENAI_EMBEDDING_MODEL, LLM_TEMPERATURE, LLM_TEMPERATURE_CLASSIFY


def get_llm() -> ChatOpenAI:
    """ChatOpenAI 모델 반환 (답변 생성용 / streaming 활성화)"""
    return ChatOpenAI(
        model=OPENAI_LLM_MODEL,
        temperature=LLM_TEMPERATURE,
        streaming=True,
    )


def get_classify_llm() -> ChatOpenAI:
    """ChatOpenAI 모델 반환 (분류 전용 - 결정론적)"""
    return ChatOpenAI(
        model=OPENAI_LLM_MODEL,
        temperature=LLM_TEMPERATURE_CLASSIFY,
    )


def get_embedding_model() -> OpenAIEmbeddings:
    """OpenAI 임베딩 모델 반환"""
    return OpenAIEmbeddings(model=OPENAI_EMBEDDING_MODEL)
