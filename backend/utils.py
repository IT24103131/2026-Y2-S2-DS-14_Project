from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from flask import request, jsonify
from functools import wraps
from config import Config
from models import SessionLocal, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Password helpers ───────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# ── JWT helpers ────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: timedelta = timedelta(minutes=30)) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, Config.JWT_SECRET_KEY, algorithm=Config.ALGORITHM)

def decode_token(token: str):
    try:
        payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=[Config.ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

# ── DB session helper ──────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise

# ── Auth decorator (replaces FastAPI Depends(get_current_user)) ────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"detail": "Not authenticated"}), 401

        token = auth_header.split(" ", 1)[1]
        user_id_str = decode_token(token)
        if user_id_str is None:
            return jsonify({"detail": "Invalid token"}), 401

        try:
            uid = int(user_id_str)
        except ValueError:
            return jsonify({"detail": "Invalid token subject"}), 401

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.user_id == uid).first()
            if user is None:
                return jsonify({"detail": "User not found"}), 401
            return f(current_user=user, db=db, *args, **kwargs)
        finally:
            db.close()

    return decorated