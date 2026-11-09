import json
import logging
from datetime import datetime
from typing import Any
from sqlalchemy.orm import Session
from .models import AuditLog

logger = logging.getLogger("stackzyro.audit")

SENSITIVE_KEYS = {"password", "password_hash", "token", "access_token", "secret", "credentials", "current_password", "new_password"}

def sanitize_state(data: Any) -> Any:
    if isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            if any(s in k.lower() for s in SENSITIVE_KEYS):
                cleaned[k] = "[REDACTED]"
            elif isinstance(v, (dict, list)):
                cleaned[k] = sanitize_state(v)
            else:
                cleaned[k] = v
        return cleaned
    elif isinstance(data, list):
        return [sanitize_state(item) for item in data]
    return data

def log_audit(
    db: Session,
    *,
    action: str,
    category: str,
    description: str,
    actor_id: int | None = None,
    actor: Any = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    entity_ref: str | None = None,
    previous_state: dict | None = None,
    new_state: dict | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """
    Records an immutable audit trail entry in the database.
    Ensures passwords, hashes, and secrets are strictly excluded.
    Supports either actor_id or actor object (e.g. user).
    """
    if actor_id is None and actor is not None:
        actor_id = getattr(actor, "id", None)

    prev_str = json.dumps(sanitize_state(previous_state)) if previous_state else None
    new_str = json.dumps(sanitize_state(new_state)) if new_state else None

    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        category=category,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_ref=entity_ref,
        previous_state=prev_str,
        new_state=new_str,
        ip_address=ip_address,
        created_at=datetime.now(),
    )
    db.add(entry)
    try:
        db.flush()
    except Exception as e:
        logger.warning("Failed to record audit log: %s", e)
    return entry
