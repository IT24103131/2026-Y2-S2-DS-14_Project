import os
from dotenv import load_dotenv

load_dotenv()

class AIConfig:
    DATABASE_URI = os.getenv(
        "DATABASE_URI",
        "postgresql://neondb_owner:npg_2eoMqxQAn7Yf@ep-dark-bar-a15df3n8-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    )
    POLICY_PATH = os.getenv("POLICY_PATH", "artifacts/policy.json")