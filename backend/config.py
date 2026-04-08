from os import environ
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY     = environ.get("SECRET_KEY", "your_secret_key")
    DATABASE_URI   = environ.get(
        "DATABASE_URI",
        "postgresql://neondb_owner:npg_2eoMqxQAn7Yf@ep-dark-bar-a15df3n8-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    )
    JWT_SECRET_KEY = environ.get("JWT_SECRET_KEY", "change_this_in_env")
    ALGORITHM      = environ.get("ALGORITHM", "HS256")
    AI_BASE_URL    = environ.get("AI_BASE_URL", "http://127.0.0.1:8001")