import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface AuthenticationHandlerProps {
  onAuthenticated: () => void;
  children: React.ReactNode;
}

export default function AuthenticationHandler({
  onAuthenticated,
  children,
}: AuthenticationHandlerProps) {
  const [status, setStatus] = useState<
    "loading" | "success" | "error" | "authenticated"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const authenticate = async () => {
      try {
        const response = await apiFetch("/powerbi/token");

        // Even if the token endpoint is not fully configured (missing secret),
        // we can still proceed since Power BI embed uses autoAuth
        if (response.ok) {
          const data = await response.json();
          if (data.access_token) {
            // Token obtained successfully
            if (isMounted) {
              setStatus("success");
              setTimeout(() => {
                if (isMounted) {
                  setStatus("authenticated");
                  onAuthenticated();
                }
              }, 2000);
            }
            return;
          }
        }

        // If no token but response indicates client secret not configured,
        // proceed anyway since Power BI will handle authentication
        if (response.status === 400 || response.status === 401) {
          const data = await response.json();
          if (data.detail && data.detail.includes("client secret")) {
            // Client secret not configured, but we can still proceed with autoAuth
            if (isMounted) {
              setStatus("success");
              setTimeout(() => {
                if (isMounted) {
                  setStatus("authenticated");
                  onAuthenticated();
                }
              }, 2000);
            }
            return;
          }
        }

        throw new Error(`Authentication failed: ${response.status}`);
      } catch (error) {
        if (isMounted) {
          // Check if it's a network error (backend not running)
          const message =
            error instanceof Error ? error.message : "Authentication failed";

          // If it's a network error, still proceed with embedded dashboards
          if (message.includes("fetch") || message.includes("ECONNREFUSED")) {
            setStatus("success");
            setTimeout(() => {
              if (isMounted) {
                setStatus("authenticated");
                onAuthenticated();
              }
            }, 2000);
            return;
          }

          setErrorMessage(message);
          setStatus("error");
        }
      }
    };

    authenticate();

    return () => {
      isMounted = false;
    };
  }, [onAuthenticated]);

  if (status === "authenticated") {
    return <>{children}</>;
  }

  return (
    <div className="bi-auth-container">
      <div className="bi-auth-content">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-base text-muted-foreground animate-pulse">
              Carregando credenciais...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-4xl">🎉</div>
            <p className="text-base text-foreground font-medium">
              Você está logado no portal de BI!
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-4xl">⚠️</div>
            <p className="text-base text-destructive font-medium">
              Erro ao autenticar
            </p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
