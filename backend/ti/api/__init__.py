from .chamados import router as chamados_router
from .usuarios import router as usuarios_router
from .unidades import router as unidades_router
from .problemas import router as problemas_router
from .notifications import router as notifications_router
from .alerts import router as alerts_router
from .email_debug import router as email_debug_router
from .sla import router as sla_router
from .powerbi import router as powerbi_router
__all__ = ["chamados_router", "usuarios_router", "unidades_router", "problemas_router", "notifications_router", "alerts_router", "email_debug_router", "sla_router", "powerbi_router"]
