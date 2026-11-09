import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt

from .config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, SECRET_KEY

try:
    import bcrypt

    HAS_BCRYPT = True
except ImportError:  # pragma: no cover - fallback only
    HAS_BCRYPT = False

PBKDF2_ROUNDS = 480_000


def _pbkdf2_hash(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${PBKDF2_ROUNDS}${salt.hex()}${digest.hex()}"


def _pbkdf2_verify(password: str, stored: str) -> bool:
    try:
        algorithm, rounds, salt_hex, digest_hex = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds)
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def hash_password(password: str) -> str:
    if HAS_BCRYPT:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
    return _pbkdf2_hash(password)


def verify_password(password: str, stored: str) -> bool:
    if stored.startswith("pbkdf2_sha256$"):
        return _pbkdf2_verify(password, stored)
    if HAS_BCRYPT:
        try:
            return bcrypt.checkpw(password.encode(), stored.encode())
        except (ValueError, TypeError):
            return False
    return False


def create_access_token(
    user_id: int, role: str, remember: bool = False, token_version: int = 1
) -> str:
    # Remember me grants a 14-day token vs standard session token
    minutes = (ACCESS_TOKEN_EXPIRE_MINUTES * 14) if remember else ACCESS_TOKEN_EXPIRE_MINUTES
    payload = {
        "sub": str(user_id),
        "role": role,
        "ver": token_version,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
