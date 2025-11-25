from __future__ import annotations
import json
import os
import secrets
import string
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash
from ti.models import User
from core.db import engine
from core.utils import now_brazil_naive
from ti.schemas.user import UserCreate, UserCreatedOut, UserAvailability


def _generate_password(length: int = 6) -> str:
    # Ensure at least one lowercase, one uppercase, and one digit
    if length < 3:
        length = 3
    parts = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
    ]
    remaining = length - 3
    pool = string.ascii_letters + string.digits
    parts += [secrets.choice(pool) for _ in range(remaining)]
    # Shuffle deterministically with secrets by reordering via random indices
    for i in range(len(parts) - 1, 0, -1):
        j = ord(secrets.token_bytes(1)) % (i + 1)
        parts[i], parts[j] = parts[j], parts[i]
    return "".join(parts)


def check_user_availability(db: Session, email: str | None = None, username: str | None = None) -> UserAvailability:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    availability = UserAvailability()
    if email is not None:
        availability.email_exists = db.query(User).filter(User.email == email).first() is not None
    if username is not None:
        availability.usuario_exists = db.query(User).filter(User.usuario == username).first() is not None
    return availability


def generate_password(length: int = 6) -> str:
    return _generate_password(length)


def criar_usuario(db: Session, payload: UserCreate) -> UserCreatedOut:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    # Uniqueness checks
    if payload.email and db.query(User).filter(User.email == str(payload.email)).first():
        raise ValueError("E-mail já cadastrado")
    if payload.usuario and db.query(User).filter(User.usuario == payload.usuario).first():
        raise ValueError("Nome de usuário já cadastrado")

    # Password generation in backend if not provided
    generated_password = payload.senha or _generate_password(6)

    setores_json = None
    setor = None
    if payload.setores and len(payload.setores) > 0:
        normalized = [_normalize_str(str(s)) for s in payload.setores]
        setores_json = json.dumps(normalized)
        setor = normalized[0]

    novo = User(
        nome=payload.nome,
        sobrenome=payload.sobrenome,
        usuario=payload.usuario,
        email=str(payload.email),
        senha_hash=generate_password_hash(generated_password),
        alterar_senha_primeiro_acesso=payload.alterar_senha_primeiro_acesso,
        nivel_acesso=payload.nivel_acesso,
        setor=setor,
        _setores=setores_json,
        bloqueado=payload.bloqueado,
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)

    return UserCreatedOut(
        id=novo.id,
        nome=novo.nome,
        sobrenome=novo.sobrenome,
        usuario=novo.usuario,
        email=novo.email,
        nivel_acesso=novo.nivel_acesso,
        setor=novo.setor,
        senha=generated_password,
    )


import unicodedata

def _normalize_str(s: str) -> str:
    if not s:
        return s
    # Remove accents and normalize whitespace
    nfkd = unicodedata.normalize('NFKD', s)
    only_ascii = ''.join([c for c in nfkd if not unicodedata.combining(c)])
    return only_ascii.replace('\u00a0', ' ').strip()


def _set_setores(user: User, setores):
    if setores and isinstance(setores, list) and len(setores) > 0:
        normalized = [_normalize_str(str(s)) for s in setores]
        user._setores = json.dumps(normalized)
        user.setor = normalized[0] if normalized else None
    elif setores and isinstance(setores, str):
        normalized = _normalize_str(str(setores))
        user._setores = json.dumps([normalized])
        user.setor = normalized
    else:
        user._setores = None
        user.setor = None




def update_user(db: Session, user_id: int, data: dict) -> User:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("Usuário não encontrado")

    if "email" in data and data["email"] and data["email"] != user.email:
        if db.query(User).filter(User.email == str(data["email"])) .first():
            raise ValueError("E-mail já cadastrado")
        user.email = str(data["email"])  # type: ignore
    if "usuario" in data and data["usuario"] and data["usuario"] != user.usuario:
        if db.query(User).filter(User.usuario == data["usuario"]).first():
            raise ValueError("Nome de usuário já cadastrado")
        user.usuario = data["usuario"]  # type: ignore

    if "nome" in data and data["nome"] is not None:
        user.nome = data["nome"]  # type: ignore
    if "sobrenome" in data and data["sobrenome"] is not None:
        user.sobrenome = data["sobrenome"]  # type: ignore
    if "nivel_acesso" in data and data["nivel_acesso"] is not None:
        user.nivel_acesso = data["nivel_acesso"]  # type: ignore
    if "alterar_senha_primeiro_acesso" in data and data["alterar_senha_primeiro_acesso"] is not None:
        user.alterar_senha_primeiro_acesso = bool(data["alterar_senha_primeiro_acesso"])  # type: ignore
    if "bloqueado" in data and data["bloqueado"] is not None:
        user.bloqueado = bool(data["bloqueado"])  # type: ignore
    if "setores" in data:
        _set_setores(user, data["setores"])  # type: ignore

    db.commit()
    db.refresh(user)
    return user


def regenerate_password(db: Session, user_id: int, length: int = 6) -> str:
    if length < 6:
        length = 6
    if length > 64:
        length = 64
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("Usuário não encontrado")
    new_pwd = _generate_password(length)
    user.senha_hash = generate_password_hash(new_pwd)
    user.alterar_senha_primeiro_acesso = True
    db.commit()
    return new_pwd


def set_block_status(db: Session, user_id: int, blocked: bool) -> User:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("Usuário não encontrado")
    user.bloqueado = bool(blocked)
    if not blocked:
        user.tentativas_login = 0
        user.bloqueado_ate = None
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> None:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return
    db.delete(user)
    db.commit()


def list_blocked_users(db: Session) -> list[User]:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    return db.query(User).filter(User.bloqueado == True).order_by(User.id.desc()).all()


def authenticate_user(db: Session, identifier: str, senha: str) -> dict:
    """Authenticate by email or usuario. Returns dict with user info on success."""
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    user = db.query(User).filter((User.email == identifier) | (User.usuario == identifier)).first()
    from werkzeug.security import check_password_hash
    if not user:
        raise ValueError("Usuário não encontrado")
    if user.bloqueado:
        raise PermissionError("Usuário bloqueado")

    if not check_password_hash(user.senha_hash, senha):
        # increment attempts
        try:
            user.tentativas_login = (user.tentativas_login or 0) + 1
            max_attempts = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
            if user.tentativas_login >= max_attempts:
                user.bloqueado = True
            db.commit()
        except Exception:
            db.rollback()
        raise ValueError("Senha inválida")

    # Successful login: reset attempts and update ultimo_acesso
    try:
        user.tentativas_login = 0
        user.bloqueado = False
        user.ultimo_acesso = now_brazil_naive()
        db.commit()
    except Exception:
        db.rollback()

    # prepare setores list and normalize strings (remove accents)
    setores_list: list[str] = []
    try:
        if user._setores:
            raw = json.loads(user._setores)
            setores_list = [ _normalize_str(str(s)) for s in raw if s is not None ]
        elif user.setor:
            setores_list = [ _normalize_str(str(user.setor)) ]
    except Exception:
        setores_list = [ _normalize_str(str(user.setor))] if user.setor else []

    # Debug log to help trace login+alterar_senha flow
    try:
        print(f"[AUTH] user={user.usuario} id={user.id} alterar_senha={bool(user.alterar_senha_primeiro_acesso)} setores={setores_list}")
    except Exception:
        pass

    return {
        "id": user.id,
        "nome": user.nome,
        "sobrenome": user.sobrenome,
        "usuario": user.usuario,
        "email": user.email,
        "nivel_acesso": user.nivel_acesso,
        "setores": setores_list,
        "alterar_senha_primeiro_acesso": bool(user.alterar_senha_primeiro_acesso),
        "session_revoked_at": user.session_revoked_at.isoformat() if getattr(user, 'session_revoked_at', None) else None,
    }

# Migration script to normalize setores in DB
def normalize_user_setores(db: Session) -> int:
    """Normalize setor and _setores for all users. Returns number of updated users."""
    updated = 0
    try:
        users = db.query(User).all()
        for u in users:
            changed = False
            # normalize single setor
            if u.setor:
                norm = _normalize_str(u.setor)
                if norm != (u.setor or ""):
                    u.setor = norm
                    changed = True
            # normalize _setores JSON
            if u._setores:
                try:
                    arr = json.loads(u._setores)
                    norm_arr = [ _normalize_str(str(s)) for s in arr ]
                    if json.dumps(norm_arr, ensure_ascii=False) != u._setores:
                        u._setores = json.dumps(norm_arr, ensure_ascii=False)
                        changed = True
                except Exception:
                    # try to coerce single string
                    try:
                        norm = _normalize_str(str(u._setores))
                        u._setores = json.dumps([norm], ensure_ascii=False)
                        changed = True
                    except Exception:
                        pass
            if changed:
                db.add(u)
                updated += 1
        if updated:
            db.commit()
    except Exception as e:
        try:
            db.rollback()
        except:
            pass
        raise
    return updated


def change_user_password(db: Session, user_id: int, new_password: str, require_change: bool = False) -> None:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("Usuário não encontrado")
    user.senha_hash = generate_password_hash(new_password)
    user.alterar_senha_primeiro_acesso = bool(require_change)
    db.commit()
