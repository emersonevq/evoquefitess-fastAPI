from __future__ import annotations
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from io import BytesIO
from ti.api import chamados_router, unidades_router, problemas_router, notifications_router, alerts_router, email_debug_router, sla_router, powerbi_router
from ti.api.usuarios import router as usuarios_router
from ti.api.dashboard_permissions import router as dashboard_permissions_router
from core.realtime import mount_socketio
import json
from typing import Any, List, Dict
import uuid
from sqlalchemy.orm import Session
from core.db import get_db, engine
from ti.models.media import Media

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


@_http.get("/api/test-backend")
def test_backend():
    """Simples teste para confirmar que o backend foi reiniciado"""
    return {"status": "Backend está rodando com o código atualizado!", "timestamp": "OK"}


@_http.get("/api/debug/routes")
def debug_routes():
    """Debug - listar todas as rotas registradas"""
    routes = []
    for route in _http.routes:
        if hasattr(route, 'path'):
            routes.append({
                "path": route.path,
                "methods": getattr(route, 'methods', []) or ['GET'],
            })
    return {
        "total_routes": len(routes),
        "routes": sorted(routes, key=lambda x: x['path']),
        "powerbi_embed_token_registered": any("/powerbi/embed-token" in r['path'] for r in routes),
    }


@_http.post("/api/login-media/upload")
async def upload_login_media(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file:
        raise HTTPException(status_code=400, detail="Arquivo ausente")

    content_type = (file.content_type or "").lower()
    print(f"[UPLOAD] Arquivo: {file.filename}, Content-Type: {content_type}")

    if content_type.startswith("image/"):
        kind = "foto"
    elif content_type.startswith("video/"):
        kind = "video"
    else:
        raise HTTPException(status_code=400, detail="Tipo de arquivo não suportado")

    original_name = Path(file.filename or "arquivo").name
    titulo = Path(original_name).stem or "mídia"

    data = await file.read()
    print(f"[UPLOAD] Tamanho do arquivo: {len(data)} bytes")

    try:
        m = Media(
            tipo=kind,
            titulo=titulo,
            descricao=None,
            arquivo_blob=data,
            mime_type=content_type,
            tamanho_bytes=len(data),
            status="ativo",
        )
        db.add(m)
        db.commit()
        db.refresh(m)

        print(f"[UPLOAD] Salvo com ID: {m.id}")

        m.url = f"/api/login-media/{m.id}/download"
        db.add(m)
        db.commit()

        media_type = "image" if kind == "foto" else "video"
        result = {
            "id": m.id,
            "type": media_type,
            "url": f"/api/login-media/{m.id}/download",
            "mime": m.mime_type,
        }
        print(f"[UPLOAD] Resposta: {result}")
        return result
    except Exception as e:
        print(f"[UPLOAD] Falha ao salvar registro: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Falha ao salvar registro: {str(e)}")


@_http.get("/api/login-media/debug/all")
def login_media_debug_all(db: Session = Depends(get_db)):
    """Lista TODOS os vídeos (ativo e inativo) para debug"""
    try:
        all_media = db.query(Media).all()
        return {
            "total": len(all_media),
            "items": [
                {
                    "id": m.id,
                    "tipo": m.tipo,
                    "titulo": m.titulo,
                    "mime_type": m.mime_type,
                    "tamanho_bytes": m.tamanho_bytes,
                    "arquivo_blob_size": len(m.arquivo_blob) if m.arquivo_blob else 0,
                    "status": m.status,
                }
                for m in all_media
            ]
        }
    except Exception as e:
        print(f"[DEBUG_ALL] Erro: {e}")
        import traceback
        traceback.print_exc()
        return {"erro": str(e)}


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
def download_login_media(item_id: int, request: Request, db: Session = Depends(get_db)):
    print(f"\n[DL] ==== START ID:{item_id} ====")
    try:
        m = db.query(Media).filter(Media.id == int(item_id)).first()
        print(f"[DL] Query result: {m is not None}")

        if not m:
            print(f"[DL] Not found")
            raise HTTPException(status_code=404, detail="Not found")

        print(f"[DL] Type:{m.tipo} Status:{m.status} Title:{m.titulo}")

        blob = m.arquivo_blob
        print(f"[DL] Blob type: {type(blob).__name__} Size: {len(blob) if blob else 0}")

        if not blob:
            raise HTTPException(status_code=404, detail="No data")

        mime = m.mime_type or "application/octet-stream"
        # Sanitize filename: remove emojis and non-ASCII characters for HTTP headers
        title_clean = (m.titulo or "media").encode("ascii", errors="ignore").decode("ascii")
        name = title_clean.replace(" ", "_").replace("/", "_").replace("\\", "_")
        if not name or name.strip() == "":
            name = "media"
        file_size = len(blob)

        # Check for Range header (HTTP 206 Partial Content)
        range_header = request.headers.get("range")

        if range_header:
            # Parse range header (e.g., "bytes=0-1023")
            try:
                range_value = range_header.replace("bytes=", "")
                if "-" in range_value:
                    start_str, end_str = range_value.split("-")
                    start = int(start_str) if start_str else 0
                    end = int(end_str) if end_str else file_size - 1

                    # Validate range
                    if start < 0 or end >= file_size or start > end:
                        raise ValueError("Invalid range")

                    chunk_size = end - start + 1
                    print(f"[DL] Range request: bytes {start}-{end}/{file_size}")

                    return Response(
                        content=blob[start:end + 1],
                        status_code=206,
                        media_type=mime,
                        headers={
                            "Content-Disposition": f"inline; filename={name}",
                            "Content-Range": f"bytes {start}-{end}/{file_size}",
                            "Accept-Ranges": "bytes",
                            "Content-Length": str(chunk_size),
                        }
                    )
            except (ValueError, AttributeError) as e:
                print(f"[DL] Invalid range header: {e}")
                # Fall through to normal response if range is invalid

        print(f"[DL] Returning: {len(blob)} bytes as {mime}")
        print(f"[DL] ==== END ====\n")

        return Response(
            content=blob,
            media_type=mime,
            headers={
                "Content-Disposition": f"inline; filename={name}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DL] EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@_http.get("/api/login-media/{item_id}/debug")
def login_media_debug(item_id: int, db: Session = Depends(get_db)):
    """Debug de um vídeo específico"""
    try:
        m = db.query(Media).filter(Media.id == int(item_id)).first()
        if not m:
            return {"erro": "Não encontrada", "id": item_id}
        return {
            "id": m.id,
            "tipo": m.tipo,
            "titulo": m.titulo,
            "mime_type": m.mime_type,
            "tamanho_bytes": m.tamanho_bytes,
            "arquivo_blob_size": len(m.arquivo_blob) if m.arquivo_blob else 0,
            "arquivo_blob_type": type(m.arquivo_blob).__name__,
            "status": m.status,
        }
    except Exception as e:
        print(f"[DEBUG_{item_id}] Erro: {e}")
        import traceback
        traceback.print_exc()
        return {"erro": str(e)}


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
_http.include_router(sla_router, prefix="/api")
_http.include_router(powerbi_router, prefix="/api")
_http.include_router(dashboard_permissions_router, prefix="")

# Compatibility mount without prefix, in case the server is run without proxy
_http.include_router(chamados_router)
_http.include_router(usuarios_router)
_http.include_router(unidades_router)
_http.include_router(problemas_router)
_http.include_router(notifications_router)
_http.include_router(alerts_router)
_http.include_router(email_debug_router)
_http.include_router(sla_router)
_http.include_router(powerbi_router)
_http.include_router(dashboard_permissions_router)

# Wrap with Socket.IO ASGI app (exports as 'app')
app = mount_socketio(_http)
