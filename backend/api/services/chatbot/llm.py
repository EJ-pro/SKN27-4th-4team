from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from .constants import OPENAI_LLM_MODEL, OPENAI_EMBEDDING_MODEL, LLM_TEMPERATURE, LLM_TEMPERATURE_CLASSIFY
from .constants import LLM_PROVIDER, EMBEDDING_PROVIDER, REMOTE_LLM_BASE_URL, REMOTE_LLM_MODEL, REMOTE_EMBEDDING_MODEL, REMOTE_API_KEY


# 환경변수에 따라 채팅 모델 및 api 호출 주소 교체하는 지역 함수 
def _chat_model(temperature: float) -> ChatOpenAI:
    if LLM_PROVIDER == "remote":
        return ChatOpenAI(
            model=REMOTE_LLM_MODEL,
            temperature=temperature,
            base_url=REMOTE_LLM_BASE_URL,
            api_key=REMOTE_API_KEY,
        )
    return ChatOpenAI(model=OPENAI_LLM_MODEL, temperature=temperature)

# 환경변수에 따라 임베딩 모델 및 api 호출 주소 교체하는 지역 함수 
def _embedding_model() -> OpenAIEmbeddings:
    if EMBEDDING_PROVIDER == "remote":
        return OpenAIEmbeddings(
            model=REMOTE_EMBEDDING_MODEL,
            base_url=REMOTE_LLM_BASE_URL,
            api_key=REMOTE_API_KEY,
        )
    return OpenAIEmbeddings(model=OPENAI_EMBEDDING_MODEL)


# 채팅 / 임베딩 모델 결정에서 중간 라우팅을 위해 함수 호출형으로 교체 
def get_llm() -> ChatOpenAI:
    """ChatOpenAI 모델 반환 (답변 생성용)"""
    return _chat_model(LLM_TEMPERATURE)

def get_classify_llm() -> ChatOpenAI:
    """ChatOpenAI 모델 반환 (분류 전용 - 결정론적)"""
    return _chat_model(LLM_TEMPERATURE_CLASSIFY)

def get_embedding_model() -> OpenAIEmbeddings:
    """OpenAI 임베딩 모델 반환"""
    return _embedding_model()
