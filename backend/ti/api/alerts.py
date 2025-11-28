from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from io import BytesIO
from core.db import get_db, engine
from ..models.alert import Alert
from ..schemas.alert import AlertOut, AlertCreate

router = APIRouter(prefix="/alerts", tags=["TI - Alerts"]) 

@router.get("", response_model=List[AlertOut])
def list_alerts(db: Session = Depends(get_db)):
    try:
        try:
            Alert.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass
        q = db.query(Alert).filter(Alert.ativo == True).order_by(Alert.id.desc()).all()
        return q
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar alertas: {e}")

@router.post("", response_model=AlertOut)
async def create_alert(
    title: Optional[str] = Form(None),
    message: Optional[str] = Form(None),
    severity: str = Form("info"),
    link: Optional[str] = Form(None),
    media_id: Optional[int] = Form(None),
    start_at: Optional[str] = Form(None),
    end_at: Optional[str] = Form(None),
    ativo: bool = Form(True),
    imagem: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    try:
        import traceback
        from datetime import datetime as dt

        print(f"[ALERTS] Criando alerta: title={title}, severity={severity}")

        imagem_blob = None
        imagem_mime_type = None

        if imagem:
            try:
                imagem_blob = await imagem.read()
                imagem_mime_type = imagem.content_type
                print(f"[ALERTS] Imagem recebida: {imagem.filename}, tamanho={len(imagem_blob)} bytes, mime={imagem_mime_type}")
            except Exception as e:
                print(f"[ALERTS] Erro ao processar imagem: {e}")

        start_at_dt = None
        end_at_dt = None

        if start_at:
            try:
                start_at_dt = dt.fromisoformat(start_at.replace('Z', '+00:00'))
            except:
                pass

        if end_at:
            try:
                end_at_dt = dt.fromisoformat(end_at.replace('Z', '+00:00'))
            except:
                pass

        a = Alert(
            title=title,
            message=message,
            severity=severity,
            start_at=start_at_dt,
            end_at=end_at_dt,
            link=link,
            media_id=media_id,
            imagem_blob=imagem_blob,
            imagem_mime_type=imagem_mime_type,
            ativo=ativo if ativo is not None else True,
        )
        print(f"[ALERTS] Objeto Alert criado")
        db.add(a)
        db.commit()
        db.refresh(a)
        print(f"[ALERTS] Alerta salvo com ID: {a.id}")
        return a
    except Exception as e:
        import traceback
        print(f"[ALERTS] ERRO ao criar alerta: {str(e)}")
        print(f"[ALERTS] Traceback completo:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar alerta: {str(e)}")

@router.get("/{alert_id}/imagem")
def get_alert_image(alert_id: int, db: Session = Depends(get_db)):
    try:
        a = db.query(Alert).filter(Alert.id == int(alert_id)).first()
        if not a or not a.imagem_blob:
            raise HTTPException(status_code=404, detail="Imagem não encontrada")

        mime_type = a.imagem_mime_type or "image/jpeg"
        return StreamingResponse(
            BytesIO(a.imagem_blob),
            media_type=mime_type,
            headers={"Content-Disposition": f"inline; filename=alerta_{alert_id}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao baixar imagem: {e}")

@router.delete("/{alert_id}")
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    try:
        a = db.query(Alert).filter(Alert.id == int(alert_id)).first()
        if not a:
            raise HTTPException(status_code=404, detail="Alerta não encontrado")
        a.ativo = False
        db.add(a)
        db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao remover alerta: {e}")
