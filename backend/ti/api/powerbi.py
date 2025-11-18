from __future__ import annotations
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from core.db import get_db
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/powerbi", tags=["Power BI"])

# Power BI Configuration - ler do .env
POWERBI_CLIENT_ID = os.getenv("POWERBI_CLIENT_ID", "7cc65d27-294f-47a4-a525-d5efb61871f5")
POWERBI_CLIENT_SECRET = os.getenv("POWERBI_CLIENT_SECRET", "").strip()
POWERBI_OBJECT_ID = os.getenv("POWERBI_OBJECT_ID", "ed04a53f-153b-4a99-8104-47e88c0a5476")
POWERBI_TENANT_ID = os.getenv("POWERBI_TENANT_ID", "9f45f492-87a3-4214-862d-4c0d080aa136")
POWERBI_DISPLAY_NAME = os.getenv("POWERBI_DISPLAY_NAME", "PORTAL BI")

AUTHORITY_URL = f"https://login.microsoftonline.com/{POWERBI_TENANT_ID}"
TOKEN_ENDPOINT = f"{AUTHORITY_URL}/oauth2/v2.0/token"
POWERBI_API_URL = "https://api.powerbi.com/v1.0/myorg"

print(f"[POWERBI] Configuração carregada:")
print(f"  CLIENT_ID: {POWERBI_CLIENT_ID[:20]}...")
print(f"  CLIENT_SECRET: {'✅ Configurado' if POWERBI_CLIENT_SECRET else '❌ Não configurado'}")
print(f"  TENANT_ID: {POWERBI_TENANT_ID}")


async def get_service_principal_token() -> str:
    """Get access token using service principal credentials (Client Credentials Flow)"""
    print(f"[POWERBI] ===== INICIANDO AUTENTICAÇÃO =====")
    print(f"[POWERBI] CLIENT_ID: {POWERBI_CLIENT_ID[:20]}...")
    print(f"[POWERBI] CLIENT_SECRET: {'✅ Configurado' if POWERBI_CLIENT_SECRET else '❌ Não configurado'}")
    print(f"[POWERBI] TOKEN_ENDPOINT: {TOKEN_ENDPOINT}")

    if not POWERBI_CLIENT_SECRET:
        print(f"[POWERBI] ❌ CLIENT_SECRET não está configurado!")
        raise HTTPException(
            status_code=400,
            detail="Power BI client secret not configured"
        )

    try:
        print(f"[POWERBI] 🔄 Enviando requisição para Azure...")
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                TOKEN_ENDPOINT,
                data={
                    "grant_type": "client_credentials",
                    "client_id": POWERBI_CLIENT_ID,
                    "client_secret": POWERBI_CLIENT_SECRET,
                    "scope": "https://analysis.windows.net/powerbi/api/.default",
                },
            )

            print(f"[POWERBI] Status Code: {response.status_code}")

            if response.status_code != 200:
                error_text = response.text
                print(f"[POWERBI] ❌ Erro da Azure: {error_text}")
                raise HTTPException(status_code=400, detail=f"Azure error: {error_text[:100]}")

            token_data = response.json()
            access_token = token_data.get("access_token")
            if not access_token:
                print(f"[POWERBI] ❌ Nenhum token na resposta!")
                raise HTTPException(status_code=400, detail="No access token in response")

            print(f"[POWERBI] ✅ Token obtido com sucesso!")
            return access_token

    except httpx.RequestError as e:
        print(f"[POWERBI] ❌ Erro de rede: {e}")
        raise HTTPException(status_code=400, detail=f"Network error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[POWERBI] ❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.get("/token")
async def get_powerbi_token(db: Session = Depends(get_db)):
    """Get Power BI access token for embedded authentication"""
    try:
        token = await get_service_principal_token()
        return {
            "access_token": token,
            "token_type": "Bearer",
            "display_name": POWERBI_DISPLAY_NAME,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[POWERBI] Error in get_powerbi_token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/embed-token/{report_id}")
async def get_embed_token(report_id: str, db: Session = Depends(get_db)):
    """Generate an embed token for a specific Power BI report"""
    print(f"[POWERBI] [EMBED-TOKEN] Requisição para report_id: {report_id}")
    try:
        service_token = await get_service_principal_token()
        print(f"[POWERBI] [EMBED-TOKEN] Token de serviço obtido ✅")
        headers = {"Authorization": f"Bearer {service_token}"}

        payload = {
            "accessLevel": "View",
            "identities": [
                {
                    "username": "service-principal",
                    "roles": [],
                    "datasets": [report_id]
                }
            ]
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{POWERBI_API_URL}/reports/{report_id}/GenerateToken",
                json=payload,
                headers=headers,
            )

            print(f"[POWERBI] [EMBED-TOKEN] Status da resposta: {response.status_code}")

            if response.status_code != 200:
                error_detail = response.text
                print(f"[POWERBI] [EMBED-TOKEN] ❌ Erro: {error_detail}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Power BI API error: {error_detail}"
                )

            token_data = response.json()
            token = token_data.get("token")
            if not token:
                print(f"[POWERBI] [EMBED-TOKEN] ❌ Nenhum token na resposta")
                raise HTTPException(
                    status_code=400,
                    detail="No embed token received from Power BI"
                )

            print(f"[POWERBI] [EMBED-TOKEN] ✅ Token obtido com sucesso!")
            return {
                "token": token,
                "expiration": token_data.get("expiration"),
                "report_id": report_id,
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[POWERBI] [EMBED-TOKEN] ❌ Erro: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate embed token: {str(e)}"
        )


@router.get("/dashboards")
async def get_powerbi_dashboards(db: Session = Depends(get_db)):
    """Get list of Power BI dashboards"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{POWERBI_API_URL}/dashboards",
                headers=headers,
            )
            
            if response.status_code != 200:
                print(f"[POWERBI] Dashboards error: {response.text}")
                return {"value": []}
            
            return response.json()
    except Exception as e:
        print(f"[POWERBI] Error fetching dashboards: {e}")
        return {"value": []}


@router.get("/reports")
async def get_powerbi_reports(db: Session = Depends(get_db)):
    """Get list of Power BI reports"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{POWERBI_API_URL}/reports",
                headers=headers,
            )
            
            if response.status_code != 200:
                print(f"[POWERBI] Reports error: {response.text}")
                return {"value": []}
            
            return response.json()
    except Exception as e:
        print(f"[POWERBI] Error fetching reports: {e}")
        return {"value": []}


@router.get("/status")
async def check_powerbi_status(db: Session = Depends(get_db)):
    """Check Power BI connection status"""
    try:
        token = await get_service_principal_token()
        return {
            "status": "connected",
            "display_name": POWERBI_DISPLAY_NAME,
            "tenant_id": POWERBI_TENANT_ID,
        }
    except Exception as e:
        print(f"[POWERBI] Error checking status: {e}")
        return {
            "status": "disconnected",
            "error": str(e),
        }


@router.get("/debug/config")
def debug_powerbi_config():
    """Debug endpoint to check current Power BI configuration"""
    return {
        "client_id": POWERBI_CLIENT_ID[:20] + "..." if POWERBI_CLIENT_ID else "(not configured)",
        "client_secret": "✅ Configurado" if POWERBI_CLIENT_SECRET else "❌ Não configurado",
        "client_secret_length": len(POWERBI_CLIENT_SECRET) if POWERBI_CLIENT_SECRET else 0,
        "object_id": POWERBI_OBJECT_ID[:20] + "..." if POWERBI_OBJECT_ID else "(not configured)",
        "tenant_id": POWERBI_TENANT_ID,
        "display_name": POWERBI_DISPLAY_NAME,
        "authority_url": AUTHORITY_URL,
        "token_endpoint": TOKEN_ENDPOINT,
    }
