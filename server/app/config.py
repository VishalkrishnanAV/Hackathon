from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    llm_provider: str = "ollama"
    ollama_model: str = "llama3.1:8b"
    ollama_base_url: str = "http://localhost:11434"
    groq_api_key: str | None = None
    groq_model: str = "llama-3.1-8b-instant"
    client_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
