from dataclasses import dataclass
import os

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    neo4j_uri: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    neo4j_user: str = os.getenv("NEO4J_USER", "neo4j")
    neo4j_password: str = os.getenv("NEO4J_PASSWORD", "test1234")
    llm_provider: str = os.getenv("LLM_PROVIDER", "groq").lower()
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", os.getenv("LLM_MODEL", "gemma4:e2b"))
    groq_api_key: str | None = os.getenv("GROQ_API_KEY") or os.getenv("GROQ")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    max_supervisor_steps: int = int(os.getenv("MAX_SUPERVISOR_STEPS", "24"))


settings = Settings()
