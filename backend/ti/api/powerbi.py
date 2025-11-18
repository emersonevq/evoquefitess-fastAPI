from __future__ import annotations
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from core.db import get_db
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/powerbi", tags=["Power BI"])

# ============================================
# POWER BI CONFIGURATION
# ============================================

POWERBI_CLIENT_ID = os.getenv("POWERBI_CLIENT_ID", "").strip()
POWERBI_CLIENT_SECRET = os.getenv("POWERBI_CLIENT_SECRET", "").strip()
POWERBI_TENANT_ID = os.getenv("POWERBI_TENANT_ID", "").strip()
POWERBI_WORKSPACE_ID = os.getenv("POWERBI_WORKSPACE_ID", "").strip()
POWERBI_OBJECT_ID = os.getenv("POWERBI_OBJECT_ID", "").strip()
POWERBI_DISPLAY_NAME = os.getenv("POWERBI_DISPLAY_NAME", "Portal de BI 2")

# Validação
if not POWERBI_CLIENT_ID:
    raise ValueError("❌ POWERBI_CLIENT_ID não está configurado no .env")
if not POWERBI_CLIENT_SECRET:
    raise ValueError("❌ POWERBI_CLIENT_SECRET não está configurado no .env")
if not POWERBI_TENANT_ID:
    raise ValueError("❌ POWERBI_TENANT_ID não está configurado no .env")
if not POWERBI_WORKSPACE_ID:
    raise ValueError("❌ POWERBI_WORKSPACE_ID não está configurado no .env")

AUTHORITY_URL = f"https://login.microsoftonline.com/{POWERBI_TENANT_ID}"
TOKEN_ENDPOINT = f"{AUTHORITY_URL}/oauth2/v2.0/token"
POWERBI_API_URL = "https://api.powerbi.com/v1.0/myorg"

print(f"[POWERBI] ===== CONFIGURAÇÃO CARREGADA =====")
print(f"[POWERBI] CLIENT_ID: {POWERBI_CLIENT_ID[:20]}...")
print(f"[POWERBI] CLIENT_SECRET: {'✅ Configurado' if POWERBI_CLIENT_SECRET else '❌ Não configurado'} ({len(POWERBI_CLIENT_SECRET)} chars)")
print(f"[POWERBI] TENANT_ID: {POWERBI_TENANT_ID}")
print(f"[POWERBI] WORKSPACE_ID: {POWERBI_WORKSPACE_ID}")
print(f"[POWERBI] =====================================")


# ============================================
# AUTHENTICATION
# ============================================

async def get_service_principal_token() -> str:
    """Get access token using service principal credentials"""
    print(f"[POWERBI] 🔄 Obtendo token de autenticação...")
    
    try:
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

            if response.status_code != 200:
                error_text = response.text
                print(f"[POWERBI] ❌ Erro de autenticação: {error_text}")
                raise HTTPException(status_code=400, detail=f"Azure auth error: {error_text}")

            token_data = response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                raise HTTPException(status_code=400, detail="No access token received")

            print(f"[POWERBI] ✅ Token obtido com sucesso!")
            return access_token

    except httpx.RequestError as e:
        print(f"[POWERBI] ❌ Erro de rede: {e}")
        raise HTTPException(status_code=400, detail=f"Network error: {str(e)}")


# ============================================
# MAIN ENDPOINTS
# ============================================

@router.get("/token")
async def get_powerbi_token(db: Session = Depends(get_db)):
    """Get Power BI access token"""
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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/embed-token/{report_id}")
async def get_embed_token(
    report_id: str,
    datasetId: str = Query(None, alias="datasetId"),
    db: Session = Depends(get_db)
):
    """
    Generate an embed token for a specific Power BI report
    
    ⚠️ IMPORTANTE: Para Service Principal, o payload NÃO deve incluir 'identities'!
    """
    print(f"\n[POWERBI] [EMBED-TOKEN] ========================================")
    print(f"[POWERBI] [EMBED-TOKEN] Report ID: {report_id}")
    print(f"[POWERBI] [EMBED-TOKEN] Dataset ID: {datasetId}")
    print(f"[POWERBI] [EMBED-TOKEN] Workspace ID: {POWERBI_WORKSPACE_ID}")
    
    try:
        # 1. Obter token de autenticação
        service_token = await get_service_principal_token()
        headers = {
            "Authorization": f"Bearer {service_token}",
            "Content-Type": "application/json"
        }

        # 2. Construir payload CORRETO para Service Principal
        # ✅ SEM 'identities' (isso é só para user authentication)
        payload = {
            "accessLevel": "View"
        }
        
        # Adiciona datasets se fornecido
        if datasetId:
            payload["datasets"] = [{"id": datasetId}]
        
        print(f"[POWERBI] [EMBED-TOKEN] Payload: {payload}")

        # 3. Fazer request para a API CORRETA (com workspace_id)
        embed_url = f"{POWERBI_API_URL}/groups/{POWERBI_WORKSPACE_ID}/reports/{report_id}/GenerateToken"
        print(f"[POWERBI] [EMBED-TOKEN] URL: {embed_url}")

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                embed_url,
                json=payload,
                headers=headers,
            )

            print(f"[POWERBI] [EMBED-TOKEN] Status: {response.status_code}")
            print(f"[POWERBI] [EMBED-TOKEN] Response: {response.text[:500]}")

            # 4. Tratar erros
            if response.status_code != 200:
                error_detail = response.text
                
                if response.status_code == 403:
                    print(f"\n[POWERBI] [EMBED-TOKEN] ❌ ERRO 403 - DIAGNÓSTICO:")
                    print(f"  1. Service Principal está no workspace como Membro/Admin?")
                    print(f"     → Workspace ID: {POWERBI_WORKSPACE_ID}")
                    print(f"     → Acesse: https://app.powerbi.com/groups/{POWERBI_WORKSPACE_ID}/settings/access")
                    print(f"  2. Report ID está correto?")
                    print(f"     → Report ID: {report_id}")
                    print(f"  3. Service Principal tem permissões de API no Azure?")
                    print(f"     → Acesse: https://portal.azure.com → App Registrations → Permissões de API")
                    print(f"  4. Power BI Admin habilitou Service Principals?")
                    print(f"     → Acesse: https://app.powerbi.com → Admin Portal → Tenant Settings")
                    print(f"\n  Execute: curl http://localhost:8000/api/powerbi/debug/workspace-access")
                    
                elif response.status_code == 404:
                    print(f"\n[POWERBI] [EMBED-TOKEN] ❌ ERRO 404:")
                    print(f"  - Report {report_id} não encontrado no workspace {POWERBI_WORKSPACE_ID}")
                    print(f"  - Verifique: curl http://localhost:8000/api/powerbi/debug/workspace/{POWERBI_WORKSPACE_ID}")

                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Power BI API error: {error_detail}"
                )

            # 5. Obter embed URL do report
            # Necessário para o Power BI Client validar a URL
            embed_url = None
            try:
                reports_response = await client.get(
                    f"{POWERBI_API_URL}/groups/{POWERBI_WORKSPACE_ID}/reports/{report_id}",
                    headers=headers,
                )

                if reports_response.status_code == 200:
                    report_info = reports_response.json()
                    embed_url = report_info.get("embedUrl")
                    print(f"[POWERBI] [EMBED-TOKEN] Embed URL obtida: {embed_url}")
            except Exception as e:
                print(f"[POWERBI] [EMBED-TOKEN] ⚠️  Aviso ao obter embed URL: {e}")

            # 6. Retornar token
            token_data = response.json()
            embed_token = token_data.get("token")

            if not embed_token:
                raise HTTPException(status_code=400, detail="No embed token received")

            print(f"[POWERBI] [EMBED-TOKEN] ✅ Token gerado com sucesso!")
            print(f"[POWERBI] [EMBED-TOKEN] ========================================\n")

            return {
                "token": embed_token,
                "tokenId": token_data.get("tokenId"),
                "expiration": token_data.get("expiration"),
                "report_id": report_id,
                "embedUrl": embed_url,
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[POWERBI] [EMBED-TOKEN] ❌ Erro inesperado: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


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


# ============================================
# DEBUG ENDPOINTS
# ============================================

@router.get("/debug/config")
def debug_powerbi_config():
    """Check current Power BI configuration"""
    return {
        "✅ Configuração": {
            "client_id": POWERBI_CLIENT_ID,
            "client_secret": f"✅ {len(POWERBI_CLIENT_SECRET)} caracteres" if POWERBI_CLIENT_SECRET else "❌ Não configurado",
            "client_secret_preview": POWERBI_CLIENT_SECRET[:15] + "..." if POWERBI_CLIENT_SECRET else "",
            "tenant_id": POWERBI_TENANT_ID,
            "workspace_id": POWERBI_WORKSPACE_ID,
            "object_id": POWERBI_OBJECT_ID,
            "display_name": POWERBI_DISPLAY_NAME,
        },
        "🔗 URLs": {
            "authority": AUTHORITY_URL,
            "token_endpoint": TOKEN_ENDPOINT,
            "api_base": POWERBI_API_URL,
        },
        "📊 Links Úteis": {
            "workspace_settings": f"https://app.powerbi.com/groups/{POWERBI_WORKSPACE_ID}/settings/access",
            "workspace_content": f"https://app.powerbi.com/groups/{POWERBI_WORKSPACE_ID}/list",
            "azure_app": f"https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/{POWERBI_CLIENT_ID}",
        }
    }


@router.get("/debug/workspaces")
async def debug_workspaces():
    """List all accessible workspaces"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{POWERBI_API_URL}/groups",
                headers=headers,
            )

            print(f"[POWERBI] [DEBUG] Workspaces - Status: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                workspaces = data.get("value", [])
                
                return {
                    "status": "✅ Service Principal tem acesso aos workspaces",
                    "total_workspaces": len(workspaces),
                    "configured_workspace_id": POWERBI_WORKSPACE_ID,
                    "workspaces": [
                        {
                            "id": w.get("id"),
                            "name": w.get("name"),
                            "isOnDedicatedCapacity": w.get("isOnDedicatedCapacity", False),
                            "type": w.get("type", "Workspace"),
                            "📊 Link": f"https://app.powerbi.com/groups/{w.get('id')}/list"
                        }
                        for w in workspaces
                    ]
                }
            else:
                return {
                    "status": f"❌ Erro {response.status_code}",
                    "error": response.text,
                    "diagnóstico": [
                        "Service Principal não está habilitado no Power BI Admin?",
                        "Falta permissões de API no Azure AD?",
                        "Tenant settings bloqueando Service Principals?"
                    ]
                }
                
    except Exception as e:
        import traceback
        return {
            "status": "❌ Erro",
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.get("/debug/workspace/{workspace_id}")
async def debug_workspace_access(workspace_id: str):
    """Check access to a specific workspace and list its contents"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}

        results = {}

        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. Informações do workspace
            workspace_response = await client.get(
                f"{POWERBI_API_URL}/groups/{workspace_id}",
                headers=headers,
            )
            
            if workspace_response.status_code == 200:
                results["workspace_info"] = workspace_response.json()
            else:
                results["workspace_info"] = {
                    "error": f"Status {workspace_response.status_code}",
                    "detail": workspace_response.text
                }

            # 2. Reports no workspace
            reports_response = await client.get(
                f"{POWERBI_API_URL}/groups/{workspace_id}/reports",
                headers=headers,
            )
            
            if reports_response.status_code == 200:
                reports = reports_response.json().get("value", [])
                results["reports"] = {
                    "status": "✅ Acesso OK",
                    "count": len(reports),
                    "reports": [
                        {
                            "id": r.get("id"),
                            "name": r.get("name"),
                            "datasetId": r.get("datasetId"),
                            "webUrl": r.get("webUrl"),
                            "embedUrl": r.get("embedUrl"),
                        }
                        for r in reports
                    ]
                }
            else:
                results["reports"] = {
                    "status": f"❌ Erro {reports_response.status_code}",
                    "error": reports_response.text
                }

            # 3. Datasets no workspace
            datasets_response = await client.get(
                f"{POWERBI_API_URL}/groups/{workspace_id}/datasets",
                headers=headers,
            )
            
            if datasets_response.status_code == 200:
                datasets = datasets_response.json().get("value", [])
                results["datasets"] = {
                    "status": "✅ Acesso OK",
                    "count": len(datasets),
                    "datasets": [
                        {
                            "id": d.get("id"),
                            "name": d.get("name"),
                            "webUrl": d.get("webUrl"),
                        }
                        for d in datasets
                    ]
                }
            else:
                results["datasets"] = {
                    "status": f"❌ Erro {datasets_response.status_code}",
                    "error": datasets_response.text
                }

            return {
                "workspace_id": workspace_id,
                "configured_workspace_id": POWERBI_WORKSPACE_ID,
                "is_correct_workspace": workspace_id == POWERBI_WORKSPACE_ID,
                "results": results,
                "🔗 Links": {
                    "workspace": f"https://app.powerbi.com/groups/{workspace_id}/list",
                    "settings": f"https://app.powerbi.com/groups/{workspace_id}/settings/access",
                }
            }

    except Exception as e:
        import traceback
        return {
            "status": "❌ Erro",
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.get("/debug/workspace-access")
async def debug_configured_workspace_access():
    """
    Verifica se o Service Principal tem acesso ao workspace configurado
    Este é o endpoint mais importante para diagnóstico!
    """
    return await debug_workspace_access(POWERBI_WORKSPACE_ID)


@router.get("/debug/datasets")
async def debug_datasets_access():
    """Check if service principal has access to datasets"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{POWERBI_API_URL}/datasets",
                headers=headers,
            )

            if response.status_code == 200:
                datasets = response.json().get("value", [])
                return {
                    "status": "✅ OK",
                    "count": len(datasets),
                    "datasets": [
                        {
                            "id": d.get("id"),
                            "name": d.get("name"),
                            "webUrl": d.get("webUrl"),
                        }
                        for d in datasets[:20]
                    ]
                }
            else:
                return {
                    "status": f"❌ Erro {response.status_code}",
                    "error": response.text
                }
    except Exception as e:
        return {"status": "❌ Erro", "error": str(e)}


@router.get("/debug/reports")
async def debug_reports_access():
    """Check if service principal has access to reports"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{POWERBI_API_URL}/reports",
                headers=headers,
            )

            if response.status_code == 200:
                reports = response.json().get("value", [])
                return {
                    "status": "✅ OK",
                    "count": len(reports),
                    "reports": [
                        {
                            "id": r.get("id"),
                            "name": r.get("name"),
                            "datasetId": r.get("datasetId"),
                            "webUrl": r.get("webUrl"),
                        }
                        for r in reports[:20]
                    ]
                }
            else:
                return {
                    "status": f"❌ Erro {response.status_code}",
                    "error": response.text
                }
    except Exception as e:
        return {"status": "❌ Erro", "error": str(e)}


@router.get("/status")
async def check_powerbi_status():
    """Check Power BI connection status"""
    try:
        token = await get_service_principal_token()
        return {
            "status": "connected",
            "display_name": POWERBI_DISPLAY_NAME,
            "tenant_id": POWERBI_TENANT_ID,
            "workspace_id": POWERBI_WORKSPACE_ID,
        }
    except Exception as e:
        return {
            "status": "disconnected",
            "error": str(e),
        }
