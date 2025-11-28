import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertCircle, AlertTriangle, Info, Flame, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { shouldShowAlertOnPage } from "@/config/alert-pages";

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
  const [alerts, setAlerts] = useState<any[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

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

  const dismissAlert = (alertId: number) => {
    const newDismissed = [...dismissedAlerts, alertId];
    setDismissedAlerts(newDismissed);
    localStorage.setItem("dismissedAlerts", JSON.stringify(newDismissed));
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
    <div className="w-full space-y-3 mb-6">
      {visibleAlerts.map((alert) => {
        const config =
          severityConfig[alert.severity as keyof typeof severityConfig] ||
          severityConfig.low;
        const Icon = config.icon;

        return (
          <div key={alert.id} className="space-y-2">
            {/* Imagem se existir */}
            {alert.imagem_blob && (
              <div className="relative group rounded-lg overflow-hidden border-2 border-border shadow-md">
                <img
                  src={`data:${alert.imagem_mime_type || "image/jpeg"};base64,${alert.imagem_blob}`}
                  alt="Alerta"
                  className="w-full max-h-96 object-cover"
                />
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="absolute top-3 right-3 bg-background/90 hover:bg-background rounded-full p-2 text-foreground shadow-md transition"
                  aria-label="Fechar alerta"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {/* Alerta texto/mensagem */}
            <div
              className={`
                relative rounded-lg border p-4
                ${config.bgColor} ${config.borderColor}
                animate-in slide-in-from-top duration-500
              `}
            >
              <div className="flex gap-3">
                {/* Ícone */}
                <div className="flex-shrink-0 mt-0.5">
                  <Icon className={`h-5 w-5 ${config.iconColor}`} />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold ${config.textColor}`}>
                    {alert.title}
                  </h3>
                  <p className={`mt-1 text-sm ${config.textColor} opacity-90`}>
                    {alert.message}
                  </p>
                  {alert.description && (
                    <p
                      className={`mt-2 text-xs ${config.textColor} opacity-75`}
                    >
                      {alert.description}
                    </p>
                  )}
                </div>

                {/* Botão de fechar */}
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className={`
                    flex-shrink-0 rounded-md p-1
                    hover:bg-black/10 dark:hover:bg-white/10
                    transition-colors
                  `}
                  aria-label="Fechar alerta"
                >
                  <X className={`h-4 w-4 ${config.textColor}`} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
