from __future__ import annotations
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from ti.api import chamados_router, unidades_router, problemas_router, notifications_router, alerts_router, email_debug_router
from ti.api.usuarios import router as usuarios_router
from core.realtime import mount_socketio
import json
from typing import Any, List, Dict
import uuid

# Create the FastAPI application (HTTP)
_http = FastAPI(title="Evoque API - TI", version="1.0.0")
# Static uploads mount
_base_dir = Path(__file__).resolve().parent
_uploads = _base_dir / "uploads"
_uploads.mkdir(parents=True, exist_ok=True)
_http.mount("/uploads", StaticFiles(directory=str(_uploads), html=False), name="uploads")

_http.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@_http.get("/api/ping")
def ping():
    return {"message": "pong"}

@_http.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        print(f"Database health check failed: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "database": str(e)}, 500

from sqlalchemy.orm import Session
from core.db import get_db, engine
from ti.models.media import Media


@_http.get("/api/login-media")
def login_media(db: Session = Depends(get_db)):
    try:
        try:
            Media.__table__.create(bind=engine, checkfirst=True)
        except Exception as create_err:
            print(f"Erro ao criar tabela: {create_err}")
        q = db.query(Media).filter(Media.status == "ativo").order_by(Media.id.desc()).all()
        out = []
        for m in q:
            media_type = "image" if m.tipo == "foto" else "video" if m.tipo == "video" else "image"
            out.append(
                {
                    "id": m.id,
                    "type": media_type,
                    "url": f"/api/login-media/{m.id}/download",
                    "title": m.titulo,
                    "description": m.descricao,
                    "mime": m.mime_type,
                }
            )
        return out
    except Exception as e:
        print(f"Erro ao listar mídias: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao listar mídias: {str(e)}")


@_http.get("/api/login-media/{item_id}/download")
def download_login_media(item_id: int, db: Session = Depends(get_db)):
    try:
        m = db.query(Media).filter(Media.id == int(item_id), Media.status == "ativo").first()
        if not m or not m.arquivo_blob:
            raise HTTPException(status_code=404, detail="Mídia não encontrada")
        filename = m.titulo or "media"
        return StreamingResponse(
            iter([m.arquivo_blob]),
            media_type=m.mime_type or "application/octet-stream",
            headers={"Content-Disposition": f"inline; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao baixar mídia: {e}")


@_http.post("/api/login-media/upload")
async def upload_login_media(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file:
        raise HTTPException(status_code=400, detail="Arquivo ausente")
    content_type = (file.content_type or "").lower()
    if content_type.startswith("image/"):
        kind = "foto"
    elif content_type.startswith("video/"):
        kind = "video"
    else:
        raise HTTPException(status_code=400, detail="Tipo de arquivo não suportado")

    original_name = Path(file.filename or "arquivo").name
    titulo = Path(original_name).stem or "mídia"

    data = await file.read()

    try:
        m = Media(
            tipo=kind,
            titulo=titulo,
            descricao=None,
            url=f"/api/login-media/{uuid.uuid4().hex[:8]}/download",
            arquivo_blob=data,
            mime_type=content_type,
            tamanho_bytes=len(data),
            status="ativo",
        )
        db.add(m)
        db.commit()
        db.refresh(m)
        media_type = "image" if kind == "foto" else "video"
        return {
            "id": m.id,
            "type": media_type,
            "url": f"/api/login-media/{m.id}/download",
            "mime": m.mime_type,
        }
    except Exception as e:
        print(f"Falha ao salvar registro: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Falha ao salvar registro: {str(e)}")


@_http.delete("/api/login-media/{item_id}")
async def delete_login_media(item_id: int, db: Session = Depends(get_db)):
    try:
        m = db.query(Media).filter(Media.id == int(item_id)).first()
        if not m:
            raise HTTPException(status_code=404, detail="Item não encontrado")
        m.status = "inativo"
        db.add(m)
        db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao remover mídia: {e}")

# Primary mount under /api
_http.include_router(chamados_router, prefix="/api")
_http.include_router(usuarios_router, prefix="/api")
_http.include_router(unidades_router, prefix="/api")
_http.include_router(problemas_router, prefix="/api")
_http.include_router(notifications_router, prefix="/api")
_http.include_router(alerts_router, prefix="/api")
_http.include_router(email_debug_router, prefix="/api")

# Compatibility mount without prefix, in case the server is run without proxy
_http.include_router(chamados_router)
_http.include_router(usuarios_router)
_http.include_router(unidades_router)
_http.include_router(problemas_router)
_http.include_router(notifications_router)
_http.include_router(alerts_router)
_http.include_router(email_debug_router)

# Wrap with Socket.IO ASGI app (exports as 'app')
app = mount_socketio(_http)
