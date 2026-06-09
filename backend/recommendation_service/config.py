from dataclasses import dataclass
import os
from pathlib import Path

# 환경변수 파일 경로 지정해서 로드하도록 수정 
from dotenv import load_dotenv
_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env")


def require_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"{name} environment variable must be set.")
    return value


@dataclass(frozen=True)
class Settings:
    neo4j_uri: str = require_env("NEO4J_URI")
    neo4j_user: str = require_env("NEO4J_USER")
    neo4j_password: str = require_env("NEO4J_PASSWORD")
    llm_provider: str = os.getenv("LLM_PROVIDER", "openai").lower()
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str | None = os.getenv("OLLAMA_MODEL") or os.getenv("LLM_MODEL")
    groq_api_key: str | None = os.getenv("GROQ_API_KEY") or os.getenv("GROQ")
    groq_model: str | None = os.getenv("GROQ_MODEL") or os.getenv("LLM_MODEL")
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    openai_model: str | None = os.getenv("OPENAI_MODEL") or os.getenv("LLM_MODEL")
    max_supervisor_steps: int = int(os.getenv("MAX_SUPERVISOR_STEPS", "24"))


settings = Settings()
