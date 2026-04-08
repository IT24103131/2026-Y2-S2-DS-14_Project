from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey,
    Text, Numeric, Date, Time, create_engine
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from config import Config

Base = declarative_base()


# ── 1. Users ──────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    user_id        = Column(Integer, primary_key=True, index=True)
    username       = Column(String(100), unique=True, nullable=False)
    email          = Column(String(150), unique=True, nullable=False)
    password_hash  = Column(String(255), nullable=False)
    contact_number = Column(String(20), nullable=True)
    cluster_label  = Column(String(50), nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)


# ── 2. Quiz Result ────────────────────────────────────────────────────────────
class QuizResult(Base):
    __tablename__ = "quiz_result"
    result_id               = Column(Integer, primary_key=True, index=True)
    user_id                 = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    openness_score          = Column(Numeric(4, 2))
    conscientiousness_score = Column(Numeric(4, 2))
    extraversion_score      = Column(Numeric(4, 2))
    agreeableness_score     = Column(Numeric(4, 2))
    neuroticism_score       = Column(Numeric(4, 2))
    personality_type        = Column(String(100))
    # ✅ FIXED: was Column(Integer) — SQL schema defines this as VARCHAR(100)
    # Stores values like "Short (1-5 days)", "Medium (6-10 days)", "Long (11+ days)"
    duration                = Column(String(100))
    created_at              = Column(DateTime, default=datetime.utcnow)


# ── 3. Destinations ───────────────────────────────────────────────────────────
class Destination(Base):
    __tablename__ = "destinations"
    destination_id = Column(Integer, primary_key=True, index=True)
    location       = Column(String(150), nullable=False)
    personality_type     = Column(String(50), nullable=False)


# ── 4. Itineraries ────────────────────────────────────────────────────────────
class Itinerary(Base):
    __tablename__ = "itineraries"
    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    result_id      = Column(Integer, ForeignKey("quiz_result.result_id"), nullable=True)
    title          = Column(String(255))
    itinerary_plan = Column(Text)
    itinerary_type = Column(String(50))
    created_at     = Column(DateTime, default=datetime.utcnow)
    # ✅ FIXED: added onupdate so it auto-refreshes on every UPDATE
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── 5. Optimized Routes ───────────────────────────────────────────────────────
class OptimizedRoute(Base):
    __tablename__ = "optimized_routes"
    route_id     = Column(Integer, primary_key=True, index=True)
    itinerary_id = Column(Integer, ForeignKey("itineraries.id"), nullable=False)
    location     = Column(String(150))
    stop_order   = Column(Integer, nullable=False)


# ── 6. Daily Plan ─────────────────────────────────────────────────────────────
class DailyPlan(Base):
    __tablename__ = "daily_plan"
    day_id       = Column(Integer, primary_key=True, index=True)
    itinerary_id = Column(Integer, ForeignKey("itineraries.id"), nullable=False)
    day_number   = Column(Integer, nullable=False)


# ── 7. Scheduled Activity ─────────────────────────────────────────────────────
class ScheduledActivity(Base):
    __tablename__ = "scheduled_activity"
    schedule_id = Column(Integer, primary_key=True, index=True)
    day_id      = Column(Integer, ForeignKey("daily_plan.day_id"), nullable=False)
    location    = Column(String(150))
    start_time  = Column(Time)


# ── 8. Feedback ───────────────────────────────────────────────────────────────
class Feedback(Base):
    __tablename__ = "feedback"
    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.user_id"))
    itinerary_id = Column(Integer, ForeignKey("itineraries.id"))
    rating       = Column(Integer)
    comment      = Column(Text)
    reward       = Column(Numeric(5, 2))
    created_at   = Column(DateTime, default=datetime.utcnow)


# ── 9. RL Feedback Log ────────────────────────────────────────────────────────
class RLFeedbackLog(Base):
    __tablename__ = "rl_feedback_log"
    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.user_id"))
    itinerary_id   = Column(Integer, ForeignKey("itineraries.id"))
    feedback_id    = Column(Integer, ForeignKey("feedback.id"))
    cluster_label  = Column(String(50))
    itinerary_type = Column(String(50))
    reward         = Column(Numeric(5, 2))
    created_at     = Column(DateTime, default=datetime.utcnow)


# ── DB session ────────────────────────────────────────────────────────────────
engine       = create_engine(Config.DATABASE_URI)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)