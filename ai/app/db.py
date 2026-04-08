from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config import AIConfig

engine = create_engine(
    AIConfig.DATABASE_URI,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db_session():
    """Return a plain DB session — Flask does not use generators like FastAPI."""
    return SessionLocal()