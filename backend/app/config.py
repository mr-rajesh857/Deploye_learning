import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Search for .env in backend/ or root
env_path = Path(__file__).resolve().parent.parent / ".env"
root_env_path = Path(__file__).resolve().parent.parent.parent / ".env"

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
elif root_env_path.exists():
    load_dotenv(dotenv_path=root_env_path)
else:
    load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Employee Leave Management System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # Database configuration
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "postgres")
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "5433")
    DB_NAME: str = os.getenv("DB_NAME", "Leave_management")
    
    # User-requested Adminer URL
    DB_ADMINER_URL: str = os.getenv(
        "DB_ADMINER_URL", 
        "http://localhost:8080/?pgsql=postgres&username=postgres&db=Leave_management&ns=public"
    )

    # Database connection URL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', 'postgres')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5433')}/{os.getenv('DB_NAME', 'Leave_management')}"
    )

    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "supersecret-employee-leave-management-key-2026")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # Server & CORS
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080")

    @property
    def cors_origins_list(self) -> list[str]:
        return [orig.strip() for orig in self.CORS_ORIGINS.split(",") if orig.strip()]

    class Config:
        extra = "ignore"

settings = Settings()
