from __future__ import annotations
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from core.db import get_db
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/powerbi", tags=["Power BI"])

def get_powerbi_config():
    """Get Power BI configuration from environment variables (dynamic reading)"""
    return {
        "client_id": os.getenv("POWERBI_CLIENT_ID", "7cc65d27-294f-47a4-a525-d5efb61871f5"),
        "client_secret": os.getenv("POWERBI_CLIENT_SECRET", "").strip(),
        "object_id": os.getenv("POWERBI_OBJECT_ID", "ed04a53f-153b-4a99-8104-47e88c0a5476"),
        "tenant_id": os.getenv("POWERBI_TENANT_ID", "9f45f492-87a3-4214-862d-4c0d080aa136"),
        "display_name": os.getenv("POWERBI_DISPLAY_NAME", "PORTAL BI"),
    }

# Defaults for backwards compatibility
POWERBI_CLIENT_ID = os.getenv("POWERBI_CLIENT_ID", "7cc65d27-294f-47a4-a525-d5efb61871f5")
POWERBI_TENANT_ID = os.getenv("POWERBI_TENANT_ID", "9f45f492-87a3-4214-862d-4c0d080aa136")
POWERBI_DISPLAY_NAME = os.getenv("POWERBI_DISPLAY_NAME", "PORTAL BI")

def get_authority_url():
    """Get authority URL from current config"""
    config = get_powerbi_config()
    return f"https://login.microsoftonline.com/{config['tenant_id']}"

def get_token_endpoint():
    """Get token endpoint from current config"""
    return f"{get_authority_url()}/oauth2/v2.0/token"

POWERBI_API_URL = "https://api.powerbi.com/v1.0/myorg"


async def get_service_principal_token() -> str:
    """Get access token using service principal credentials (Client Credentials Flow)"""
    config = get_powerbi_config()

    if not config["client_secret"]:
        raise HTTPException(
            status_code=400,
            detail="Power BI client secret not configured. Please add POWERBI_CLIENT_SECRET to environment variables. Failed to get Power BI token"
        )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                get_token_endpoint(),
                data={
                    "grant_type": "client_credentials",
                    "client_id": config["client_id"],
                    "client_secret": config["client_secret"],
                    "scope": "https://analysis.windows.net/powerbi/api/.default",
                },
            )

            if response.status_code != 200:
                print(f"Token error: {response.text}")
                raise HTTPException(status_code=400, detail="Failed to get Power BI token")

            token_data = response.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(status_code=400, detail="No access token in response. Failed to get Power BI token")
            return access_token
    except httpx.RequestError as e:
        print(f"Request error: {e}")
        raise HTTPException(status_code=400, detail="Failed to connect to token service. Failed to get Power BI token")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=400, detail="Failed to authenticate with Power BI")


@router.get("/token")
async def get_powerbi_token(db: Session = Depends(get_db)):
    """Get Power BI access token for embedded authentication"""
    try:
        config = get_powerbi_config()
        token = await get_service_principal_token()
        return {
            "access_token": token,
            "token_type": "Bearer",
            "display_name": config["display_name"],
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_powerbi_token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/embed-token/{report_id}")
async def get_embed_token(report_id: str, db: Session = Depends(get_db)):
    """Generate an embed token for a specific Power BI report"""
    try:
        service_token = await get_service_principal_token()
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

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{POWERBI_API_URL}/reports/{report_id}/GenerateToken",
                json=payload,
                headers=headers,
            )

            if response.status_code != 200:
                error_detail = response.text
                print(f"Embed token error: {error_detail}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to generate embed token. Report ID may be invalid or not accessible: {report_id}"
                )

            token_data = response.json()
            token = token_data.get("token")
            if not token:
                raise HTTPException(
                    status_code=400,
                    detail="No embed token received from Power BI service"
                )
            return {
                "token": token,
                "expiration": token_data.get("expiration"),
                "report_id": report_id,
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating embed token: {e}")
        raise HTTPException(
            status_code=400,
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
                print(f"Dashboards error: {response.text}")
                return {"value": []}
            
            return response.json()
    except Exception as e:
        print(f"Error fetching dashboards: {e}")
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
                print(f"Reports error: {response.text}")
                return {"value": []}
            
            return response.json()
    except Exception as e:
        print(f"Error fetching reports: {e}")
        return {"value": []}


@router.get("/status")
async def check_powerbi_status(db: Session = Depends(get_db)):
    """Check Power BI connection status"""
    try:
        config = get_powerbi_config()
        token = await get_service_principal_token()
        return {
            "status": "connected",
            "display_name": config["display_name"],
            "tenant_id": config["tenant_id"],
        }
    except Exception as e:
        print(f"Error checking status: {e}")
        return {
            "status": "disconnected",
            "error": str(e),
        }


@router.get("/debug/config")
async def debug_powerbi_config():
    """Debug endpoint to check current Power BI configuration"""
    config = get_powerbi_config()
    return {
        "client_id": config["client_id"],
        "client_secret": "***" if config["client_secret"] else "(not configured)",
        "client_secret_length": len(config["client_secret"]) if config["client_secret"] else 0,
        "object_id": config["object_id"],
        "tenant_id": config["tenant_id"],
        "display_name": config["display_name"],
        "authority_url": get_authority_url(),
    }
