import os
from dotenv import load_dotenv
from langchain_core.messages import SystemMessage

load_dotenv()

# ────────────────────────────────────────────
# DB 설정
# ────────────────────────────────────────────
DB_CONFIG = dict(
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT", 5432)),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
)

# ────────────────────────────────────────────
# OpenAI 모델 설정
# ────────────────────────────────────────────
OPENAI_LLM_MODEL = "gpt-4o-mini"
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
LLM_TEMPERATURE = 0.7
LLM_TEMPERATURE_CLASSIFY = 0  # 분류 작업: 일관성을 위해 결정론적으로

# ────────────────────────────────────────────
# 시스템 프롬프트
# ────────────────────────────────────────────
SYSTEM_PROMPT = SystemMessage(content=(
    "당신은 AI 운동 전문가 챗봇입니다. "
    "운동 관련 질문에만 답변하며, 제공된 운동 데이터를 기반으로 정확하게 답변합니다. "
    "운동 데이터에 없는 내용은 답변하지 않습니다."
))

# ────────────────────────────────────────────
# RAG 설정
# ────────────────────────────────────────────
RETRIEVE_LIMIT = 8          # 기본 벡터 검색 결과 수 (general, injury)
RETRIEVE_SPECIFIC_LIMIT = 3 # 특정 운동 검색 결과 수 (keyword 검색이라 3으로 충분)

# ────────────────────────────────────────────
# Rerank 설정 (retrieve_injury 전용)
# ────────────────────────────────────────────
RERANK_MODEL = "Qwen/Qwen3-Reranker-0.6B"  # 한국어 지원 CrossEncoder 모델
ENABLE_RERANK = os.getenv("CHATBOT_ENABLE_RERANK", "False") == "True"
RERANK_MAX_LENGTH = 512                    # 입력 텍스트 최대 토큰 길이
RERANK_DEVICE = "cpu"                      # GPU 사용 시 "cuda"로 변경
RERANK_CACHE_FOLDER = os.getenv("RERANK_CACHE_FOLDER", "/tmp/routinegraph-models")
RERANK_TOP_N = 5                           # rerank 후 최종 사용할 문서 수
MAX_HISTORY_TURNS = 5       # 대화 히스토리 최대 유지 턴 수

# ────────────────────────────────────────────
# 질문 분류 설정
# ────────────────────────────────────────────
# 카테고리 추가/수정 시 이 딕셔너리만 변경하면 classify 프롬프트에 자동 반영됨
QUERY_TYPES: dict[str, str] = {
    "specific": "특정 운동 이름이 포함된 질문 (뭐야, 방법, 자세, 호흡법 등 모두 포함)",
    "general":  "특정 운동명 없이 추천·루틴·식단 등을 묻는 일반 운동 질문, 또는 이전 대화에서 언급된 운동을 참조하는 질문 (예: '내가 물어본 운동이 뭐야?', '방금 그 운동 다시 설명해줘')",
    "injury":   "통증·부상·재활 관련 질문 또는 특정 부위를 못 쓸 때 대체 운동 질문",
    "out_of_scope": "운동과 전혀 무관한 질문 (날씨·요리·일상 대화 등)",
}

OUT_OF_SCOPE_MESSAGE = "운동 관련 질문만 답변할 수 있습니다."

# 카테고리 → 노드 매핑 (QUERY_TYPES와 함께 관리)
# 새 카테고리 추가 시 QUERY_TYPES와 이 딕셔너리만 수정하면 됨
QUERY_TYPE_ROUTES: dict[str, str] = {
    "specific":     "retrieve_specific",
    "general":      "retrieve_general",
    "injury":       "retrieve_injury",
    "out_of_scope": "out_of_scope",
}

# ────────────────────────────────────────────
# LLM 인증 게이트 (에픽 03)
# ────────────────────────────────────────────
# False(기본): JWT 검사 없이 LLM 실행 — 개발·게스트 테스트용
# True: 세션 access_token JWT가 유효할 때만 LLM 실행
CHATBOT_REQUIRE_AUTH = os.getenv("CHATBOT_REQUIRE_AUTH", "False") == "True"

AUTH_REQUIRED_MESSAGE = (
    "AI 답변을 이용하려면 로그인이 필요합니다. "
    "로그인 후 다시 질문해 주세요."
)

LLM_ERROR_MESSAGE = "답변을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."