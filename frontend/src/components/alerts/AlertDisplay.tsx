import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertCircle, AlertTriangle, Info, Flame, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { shouldShowAlertOnPage } from "@/config/alert-pages";
import { useAuthContext } from "@/lib/auth-context";

const severityConfig = {
  low: {
    icon: Info,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    textColor: "text-blue-800 dark:text-blue-200",
    iconColor: "text-blue-500",
  },
  medium: {
    icon: AlertCircle,
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    borderColor: "border-yellow-200 dark:border-yellow-800",
    textColor: "text-yellow-800 dark:text-yellow-200",
    iconColor: "text-yellow-500",
  },
  high: {
    icon: AlertTriangle,
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800",
    textColor: "text-orange-800 dark:text-orange-200",
    iconColor: "text-orange-500",
  },
  critical: {
    icon: Flame,
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
    textColor: "text-red-800 dark:text-red-200",
    iconColor: "text-red-500",
  },
};

export default function AlertDisplay() {
  const location = useLocation();
  const { user } = useAuthContext();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [markedAsViewedRef] = useState(() => new Set<number>());

  useEffect(() => {
    loadAlerts();
    // Carregar alertas dismissados do localStorage
    const dismissed = localStorage.getItem("dismissedAlerts");
    if (dismissed) {
      try {
        setDismissedAlerts(JSON.parse(dismissed));
      } catch (e) {
        console.error("Erro ao parsear alertas dismissados:", e);
      }
    }
  }, []);

  const loadAlerts = async () => {
    try {
      const res = await apiFetch("/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Erro ao carregar alertas:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAlertAsViewed = async (alertId: number) => {
    // Só marca uma vez por sessão
    if (markedAsViewedRef.current.has(alertId)) {
      return;
    }

    try {
      const usuarioId = user?.email || user?.name || "anonymous";
      await apiFetch(`/alerts/${alertId}/visualizar`, {
        method: "POST",
        body: JSON.stringify({ usuario_id: usuarioId }),
      });
      markedAsViewedRef.current.add(alertId);
    } catch (error) {
      console.error("Erro ao marcar alerta como visualizado:", error);
    }
  };

  const dismissAlert = (alertId: number) => {
    const newDismissed = [...dismissedAlerts, alertId];
    setDismissedAlerts(newDismissed);
    localStorage.setItem("dismissedAlerts", JSON.stringify(newDismissed));
    // Marcar como visualizado ao dismissar
    markAlertAsViewed(alertId);
  };

  // Filtrar alertas:
  // 1. Não dismissados
  // 2. Que devem ser exibidos nesta página
  const visibleAlerts = alerts.filter((alert) => {
    if (dismissedAlerts.includes(alert.id)) return false;

    // Parsear páginas se for string JSON
    let alertPages: string[] | null = null;
    if (alert.pages) {
      try {
        alertPages = JSON.parse(alert.pages);
      } catch (e) {
        console.error("Erro ao parsear páginas do alerta:", e);
        alertPages = null;
      }
    }

    // Verificar se o alerta deve ser exibido nesta página
    return shouldShowAlertOnPage(alertPages, location.pathname);
  });

  if (loading) return null;
  if (visibleAlerts.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-4 pointer-events-none px-4">
      {visibleAlerts.map((alert) => {
        const config =
          severityConfig[alert.severity as keyof typeof severityConfig] ||
          severityConfig.low;
        const Icon = config.icon;

        return (
          <div
            key={alert.id}
            className="pointer-events-auto w-full max-w-md animate-in slide-in-from-top duration-500"
          >
            <div
              className={`
                relative rounded-lg border overflow-hidden shadow-lg
                ${config.bgColor} ${config.borderColor}
              `}
            >
              {/* Container com imagem e conteúdo */}
              <div className="flex flex-col gap-3 p-4">
                {/* Imagem se existir - pequena e centralizada */}
                {alert.imagem_blob && (
                  <div className="relative w-32 h-32 mx-auto rounded-lg overflow-hidden border border-border/50 shadow-md flex-shrink-0">
                    <img
                      src={`data:${alert.imagem_mime_type || "image/jpeg"};base64,${alert.imagem_blob}`}
                      alt="Alerta"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Conteúdo do Alerta */}
                <div className="flex-1 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Icon className={`h-5 w-5 ${config.iconColor} flex-shrink-0`} />
                    <h3 className={`font-bold text-base ${config.textColor}`}>
                      {alert.title}
                    </h3>
                  </div>

                  {alert.message && (
                    <p className={`text-sm ${config.textColor} opacity-90 leading-relaxed`}>
                      {alert.message}
                    </p>
                  )}

                  {alert.description && (
                    <p className={`text-xs ${config.textColor} opacity-75 mt-2 italic`}>
                      {alert.description}
                    </p>
                  )}
                </div>

                {/* Botão de fechar */}
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className={`
                    self-center mt-2 px-6 py-2 rounded-md text-sm font-medium
                    bg-background/90 hover:bg-background text-foreground
                    transition-colors duration-200
                  `}
                  aria-label="Fechar alerta"
                >
                  Fechar
                </button>
              </div>

              {/* Botão X no canto superior direito */}
              <button
                onClick={() => dismissAlert(alert.id)}
                className={`
                  absolute top-2 right-2 p-1.5 rounded-full
                  bg-background/80 hover:bg-background
                  transition-colors duration-200
                `}
                aria-label="Fechar alerta"
              >
                <X className={`h-4 w-4 ${config.textColor}`} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
