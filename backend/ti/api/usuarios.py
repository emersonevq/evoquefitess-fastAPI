from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.db import get_db, engine
from ti.schemas.user import UserCreate, UserCreatedOut, UserAvailability, UserOut
from ti.services.users import (
    criar_usuario as service_criar,
    check_user_availability,
    generate_password,
    update_user,
    regenerate_password,
    set_block_status,
    delete_user,
    list_blocked_users,
)

router = APIRouter(prefix="/usuarios", tags=["TI - Usuarios"])

@router.get("", response_model=list[UserOut])
def listar_usuarios(db: Session = Depends(get_db)):
    try:
        from ..models import User
        import json
        # helper to compute setores list
        def compute_setores(u) -> list[str]:
            try:
                if getattr(u, "_setores", None):
                    raw = json.loads(getattr(u, "_setores"))
                    return [str(x).encode('utf-8', 'ignore').decode('utf-8') if x is not None else "" for x in raw]
                if getattr(u, "setor", None):
                    return [str(getattr(u, "setor"))]
            except Exception:
                pass
            return []

        # cria tabela se não existir
        try:
            User.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        # pega todos os usuários
        try:
            users = db.query(User).order_by(User.id.desc()).all()
            rows = []
            for u in users:
                if u.bloqueado is None:
                    u.bloqueado = False
                setores_list = compute_setores(u)
                rows.append({
                    "id": u.id,
                    "nome": u.nome,
                    "sobrenome": u.sobrenome,
                    "usuario": u.usuario,
                    "email": u.email,
                    "nivel_acesso": u.nivel_acesso,
                    "setor": setores_list[0] if setores_list else None,
                    "setores": setores_list,
                    "bloqueado": bool(u.bloqueado),
                    "session_revoked_at": u.session_revoked_at.isoformat() if getattr(u, 'session_revoked_at', None) else None,
                })
            return rows
        except Exception:
            pass

        # fallback tabela legada "usuarios"
        from sqlalchemy import text
        try:
            res = db.execute(text(
                "SELECT id, nome, sobrenome, usuario, email, nivel_acesso, setor FROM usuarios ORDER BY id DESC"
            ))
            rows = []
            for r in res.fetchall():
                s = r[6]
                setores_list = [str(s)] if s else []
                rows.append({
                    "id": r[0],
                    "nome": r[1],
                    "sobrenome": r[2],
                    "usuario": r[3],
                    "email": r[4],
                    "nivel_acesso": r[5],
                    "setor": s,
                    "setores": setores_list,
                    "bloqueado": False,
                })
            return rows
        except Exception:
            return []

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar usuários: {e}")

@router.post("", response_model=UserCreatedOut)
def criar_usuario(payload: UserCreate, db: Session = Depends(get_db)):
    try:
        from ..models import User
        try:
            User.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass
        return service_criar(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar usuário: {e}")

@router.get("/check-availability", response_model=UserAvailability)
def check_availability(email: str | None = None, username: str | None = None, db: Session = Depends(get_db)):
    if email is None and username is None:
        raise HTTPException(status_code=400, detail="Informe email ou username para verificar")
    return check_user_availability(db, email, username)

@router.get("/generate-password")
def generate_password_endpoint(length: int = 6):
    if length < 6:
        length = 6
    if length > 64:
        length = 64
    return {"senha": generate_password(length)}


@router.get("/blocked", response_model=list[UserOut])
def listar_bloqueados(db: Session = Depends(get_db)):
    try:
        import json
        from ..models import User
        users = list_blocked_users(db)
        rows = []
        for u in users:
            try:
                if u.bloqueado is None:
                    u.bloqueado = True
            except Exception:
                pass
            try:
                if getattr(u, "_setores", None):
                    raw = json.loads(getattr(u, "_setores"))
                    setores_list = [str(x) for x in raw if x is not None]
                elif getattr(u, "setor", None):
                    setores_list = [str(getattr(u, "setor"))]
                else:
                    setores_list = []
            except Exception:
                setores_list = [str(getattr(u, "setor"))] if getattr(u, "setor", None) else []
            rows.append({
                "id": u.id,
                "nome": u.nome,
                "sobrenome": u.sobrenome,
                "usuario": u.usuario,
                "email": u.email,
                "nivel_acesso": u.nivel_acesso,
                "setor": setores_list[0] if setores_list else None,
                "setores": setores_list,
                "bloqueado": bool(u.bloqueado),
                "session_revoked_at": u.session_revoked_at.isoformat() if getattr(u, 'session_revoked_at', None) else None,
            })
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar bloqueados: {e}")


@router.put("/{user_id}", response_model=UserOut)
def atualizar_usuario(user_id: int, payload: dict, db: Session = Depends(get_db)):
    try:
        print(f"[API] atualizar_usuario called for user_id={user_id}, payload keys={list(payload.keys())}")
        updated = update_user(db, user_id, payload)
        print(f"[API] User updated successfully, new setores={getattr(updated, '_setores', 'N/A')}")

        # Notify the specific user their permissions/profile changed
        try:
            from core.realtime import emit_refresh_sync
            import threading
            import time

            print(f"[API] Starting threads to emit auth:refresh for user_id={updated.id}")

            # Send immediately
            print(f"[API] Sending refresh event immediately...")
            emit_refresh_sync(updated.id)

            # Also send after a short delay to ensure client is ready
            def delayed_emit():
                time.sleep(0.2)
                print(f"[API] Sending delayed refresh event for user_id={updated.id}")
                emit_refresh_sync(updated.id)

            t = threading.Thread(target=delayed_emit, daemon=True)
            t.start()

            print(f"[API] Refresh events queued for user_id={updated.id}")
        except Exception as ex:
            print(f"[API] failed to emit auth:refresh: {ex}")
            import traceback
            traceback.print_exc()

        return updated
    except ValueError as e:
        print(f"[API] ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[API] Exception: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar: {e}")


@router.get("/{user_id}", response_model=UserOut)
def get_usuario(user_id: int, db: Session = Depends(get_db)):
    try:
        from ..models import User
        import json
        User.__table__.create(bind=engine, checkfirst=True)

        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        try:
            if user._setores:
                raw = json.loads(user._setores)
                setores_list = [str(x) for x in raw if x is not None]
            elif user.setor:
                setores_list = [str(user.setor)]
            else:
                setores_list = []
        except Exception:
            setores_list = [str(user.setor)] if user.setor else []

        return {
            "id": user.id,
            "nome": user.nome,
            "sobrenome": user.sobrenome,
            "usuario": user.usuario,
            "email": user.email,
            "nivel_acesso": user.nivel_acesso,
            "setor": setores_list[0] if setores_list else None,
            "setores": setores_list,
            "bloqueado": bool(user.bloqueado),
            "session_revoked_at": user.session_revoked_at.isoformat() if getattr(user, 'session_revoked_at', None) else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] get_usuario error for user_id={user_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao obter usuário: {e}")


@router.post("/{user_id}/generate-password")
def gerar_nova_senha(user_id: int, length: int = 6, db: Session = Depends(get_db)):
    try:
        pwd = regenerate_password(db, user_id, length)
        return {"senha": pwd}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar senha: {e}")


@router.post("/{user_id}/logout")
def force_logout(user_id: int, db: Session = Depends(get_db)):
    """Force logout by setting session_revoked_at to now."""
    try:
        print(f"[API] force_logout called for user_id={user_id}")
        from ..models import User
        import traceback
        User.__table__.create(bind=engine, checkfirst=True)
        user = db.query(User).filter(User.id == user_id).first()
        print(f"[API] queried user -> {bool(user)}")
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        from core.utils import now_brazil_naive
        ts = now_brazil_naive()
        print(f"[API] setting session_revoked_at={ts.isoformat()}")
        user.session_revoked_at = ts
        db.commit()
        db.refresh(user)
        print(f"[API] committed session_revoked_at for user {user.id}")
        try:
            # verify value directly from DB using raw SQL to ensure commit persisted
            from sqlalchemy import text
            try:
                row = db.execute(text("SELECT session_revoked_at FROM `user` WHERE id = :id"), {"id": user.id}).fetchone()
                print(f"[API] raw select after commit -> {row}")
            except Exception as rex:
                print(f"[API] raw select failed: {rex}")
        except Exception:
            pass
        try:
            # Emit using a background thread to run the synchronous wrapper safely
            from core.realtime import emit_logout_sync
            import threading
            try:
                t = threading.Thread(target=emit_logout_sync, args=(user.id,), daemon=True)
                t.start()
                print(f"[API] started thread to emit socket logout for user={user.id}")
            except Exception as ex:
                print(f"[API] threading emit failed: {ex}")
        except Exception as e:
            print(f"[API] failed to emit socket logout: {e}")
        # return user minimal
        try:
            setores_list = []
            import json
            if getattr(user, "_setores", None):
                setores_list = [str(x) for x in json.loads(user._setores) if x is not None]
            elif getattr(user, "setor", None):
                setores_list = [str(user.setor)]
        except Exception:
            setores_list = [str(user.setor)] if user.setor else []
        return {
            "id": user.id,
            "nome": user.nome,
            "sobrenome": user.sobrenome,
            "usuario": user.usuario,
            "email": user.email,
            "nivel_acesso": user.nivel_acesso,
            "setor": setores_list[0] if setores_list else None,
            "setores": setores_list,
            "bloqueado": bool(user.bloqueado),
            "session_revoked_at": user.session_revoked_at.isoformat() if getattr(user, 'session_revoked_at', None) else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        print("[API] force_logout error:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao deslogar usuário: {e}")


@router.post("/login")
def login(payload: dict, db: Session = Depends(get_db)):
    try:
        identifier = payload.get("identifier") or payload.get("email") or payload.get("usuario")
        senha = payload.get("senha") or payload.get("password")
        if not identifier or not senha:
            raise HTTPException(status_code=400, detail="Informe identifier e senha")
        from ti.services.users import authenticate_user
        user = authenticate_user(db, identifier, senha)
        return user
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao autenticar: {e}")


@router.post("/{user_id}/block", response_model=UserOut)
def bloquear_usuario(user_id: int, db: Session = Depends(get_db)):
    try:
        return set_block_status(db, user_id, True)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao bloquear: {e}")


@router.post("/{user_id}/unblock", response_model=UserOut)
def desbloquear_usuario(user_id: int, db: Session = Depends(get_db)):
    try:
        return set_block_status(db, user_id, False)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao desbloquear: {e}")


@router.post("/{user_id}/change-password")
def change_password(user_id: int, payload: dict, db: Session = Depends(get_db)):
    try:
        senha = payload.get('senha') or payload.get('password')
        if not senha:
            raise HTTPException(status_code=400, detail='Informe a nova senha')
        from ti.services.users import change_user_password
        change_user_password(db, user_id, senha, require_change=False)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao alterar senha: {e}")


@router.delete("/{user_id}")
def excluir_usuario(user_id: int, db: Session = Depends(get_db)):
    try:
        delete_user(db, user_id)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao excluir: {e}")


@router.post("/normalize-setores")
def normalize_setores(db: Session = Depends(get_db)):
    """Normalize setor/_setores for all users. Use with caution (admin only)."""
    try:
        from ti.services.users import normalize_user_setores
        updated = normalize_user_setores(db)
        return {"updated": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao normalizar setores: {e}")


@router.post("/{user_id}/test-refresh")
def test_refresh_socket(user_id: int):
    """Test endpoint: manually trigger a refresh event for a user via Socket.IO"""
    try:
        print(f"[TEST] test_refresh_socket called for user_id={user_id}")
        from core.realtime import emit_refresh_sync
        import threading
        import time

        print(f"[TEST] Triggering refresh for user {user_id}")
        t = threading.Thread(target=emit_refresh_sync, args=(user_id,), daemon=True)
        t.start()

        # Wait a bit for thread to execute
        time.sleep(0.5)

        return {
            "ok": True,
            "message": f"Refresh event triggered for user {user_id}",
            "user_id": user_id,
            "timestamp": time.time()
        }
    except Exception as e:
        print(f"[TEST] Error in test_refresh_socket: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao testar refresh: {e}")
