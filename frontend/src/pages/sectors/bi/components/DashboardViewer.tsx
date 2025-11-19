import React, { useState, useRef, useEffect } from "react";
import { Dashboard } from "../hooks/useDashboards";
import { Loader } from "lucide-react";
import { apiFetch } from "@/lib/api";
import * as pbi from "powerbi-client";
import confetti from "canvas-confetti";

interface DashboardViewerProps {
  dashboard: Dashboard;
}

export default function DashboardViewer({ dashboard }: DashboardViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const embedContainerRef = useRef<HTMLDivElement | null>(null);
  const reportRef = useRef<pbi.Report | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const successOverlayRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const triggerConfetti = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const containerRect = embedContainerRef.current?.getBoundingClientRect();

    if (!containerRect) return;

    canvas.width = containerRect.width;
    canvas.height = containerRect.height;

    const duration = 2000;
    const animationEnd = Date.now() + duration;

    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA502", "#FF1744"];
    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const animate = () => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        if (successOverlayRef.current) {
          successOverlayRef.current.style.opacity = "0";
          setTimeout(() => {
            if (successOverlayRef.current) {
              successOverlayRef.current.style.display = "none";
            }
          }, 300);
        }
        return;
      }

      const progress = 1 - timeLeft / duration;
      const particleCount = Math.max(0, 50 * (1 - progress));

      confetti({
        particleCount,
        angle: randomInRange(60, 120),
        spread: randomInRange(40, 80),
        origin: { x: randomInRange(0.2, 0.8), y: 1 },
        velocity: randomInRange(8, 20),
        decay: randomInRange(0.85, 0.95),
        scalar: randomInRange(0.5, 1),
        canvas,
        shapes: ["square"],
        colors,
        gravity: 1,
        drift: randomInRange(-0.5, 0.5),
      });

      requestAnimationFrame(animate);
    };

    if (successOverlayRef.current) {
      successOverlayRef.current.style.display = "flex";
      successOverlayRef.current.style.opacity = "1";
    }

    animate();
  };

  // Power BI load and embed
  useEffect(() => {
    let isMounted = true;

    const embedReport = async () => {
      try {
        setIsLoading(true);
        setIsAuthenticating(true);
        setEmbedError(null);

        // Cleanup previous report instance completely
        if (reportRef.current) {
          try {
            reportRef.current.off("loaded");
            reportRef.current.off("rendered");
            reportRef.current.off("error");
          } catch (e) {
            console.warn("[PowerBI] Erro ao remover listeners:", e);
          }
          reportRef.current = null;
        }

        // Reset container to clear previous embed
        if (embedContainerRef.current) {
          embedContainerRef.current.innerHTML = "";
        }

        const response = await apiFetch(
          `/powerbi/embed-token/${dashboard.reportId}?datasetId=${dashboard.datasetId}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: falha ao obter token`);
        }

        const data = await response.json();
        const { token, embedUrl } = data;

        if (!token || !embedUrl) {
          throw new Error("Token ou embedUrl ausente na resposta do servidor");
        }

        console.log("[PowerBI] ✅ Token e embedUrl recebidos");
        console.log("[PowerBI] URL preview:", embedUrl.substring(0, 150) + "...");

        const powerBiClient = new pbi.service.Service(
          pbi.factories.hpmFactory,
          pbi.factories.wpmpFactory,
          pbi.factories.routerFactory
        );

        const embedConfig: pbi.IReportEmbedConfiguration = {
          type: "report",
          id: dashboard.reportId,
          embedUrl: embedUrl,
          accessToken: token,
          tokenType: pbi.models.TokenType.Embed,
          permissions: pbi.models.Permissions.All,
          settings: {
            filterPaneEnabled: true,
            navContentPaneEnabled: true,
            bars: {
              statusBar: { visible: true },
            },
          },
        };

        console.log("[PowerBI] Embed config:", embedConfig);

        if (embedContainerRef.current && isMounted) {
          // 🔥 ESSENCIAL: resetar antes de embutir
          powerBiClient.reset(embedContainerRef.current);

          const report = powerBiClient.embed(
            embedContainerRef.current,
            embedConfig
          ) as pbi.Report;

          reportRef.current = report;

          report.on("loaded", () => {
            console.log("[PowerBI] Loaded ✅");
            if (isMounted) {
              setIsLoading(false);
              triggerConfetti();
            }
          });

          report.on("rendered", () => {
            console.log("[PowerBI] Rendered 🎉");
          });

          report.on("error", (event: any) => {
            console.error("[PowerBI] Error:", event);
            if (isMounted) {
              setEmbedError(
                event?.detail?.message ||
                  "❌ Erro desconhecido ao carregar relatório"
              );
              setIsLoading(false);
            }
          });
        }
      } catch (err: any) {
        console.error("[PowerBI] Embed failed:", err);
        if (isMounted) {
          setEmbedError(err?.message || "Erro inesperado");
          setIsLoading(false);
          setIsAuthenticating(false);
        }
      }
    };

    embedReport();

    return () => {
      isMounted = false;
    };
  }, [dashboard.reportId, dashboard.datasetId]);

  // Fullscreen sync
  useEffect(() => {
    const handler = () =>
      setIsFullscreen(
        Boolean(
          document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).mozFullScreenElement
        )
      );

    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    document.addEventListener("mozfullscreenchange", handler);

    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
      document.removeEventListener("mozfullscreenchange", handler);
    };
  }, []);

  const toggleFullscreen = async () => {
    const doc: any = document;

    const isFull =
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement;

    try {
      if (!isFull && containerRef.current) {
        const el: any = containerRef.current;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        else if (el.mozRequestFullScreen) await el.mozRequestFullScreen();
        setIsFullscreen(true);
      } else {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        else if (doc.mozCancelFullScreen) await doc.mozCancelFullScreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.warn("Erro ao alternar fullscreen:", error);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="bi-dashboard-header px-4 py-2 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            {dashboard.title}
          </h1>
          <p className="text-xs text-gray-600">{dashboard.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label={
              isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"
            }
            onClick={toggleFullscreen}
            className="bi-control-button"
          >
            {isFullscreen ? "🡻" : "🡹"}
          </button>
        </div>
      </div>

      <div className="flex-1 bi-viewer-outer" ref={containerRef}>
        {isLoading && (
          <div className="bi-loading-overlay">
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-gray-600">
                {isAuthenticating ? "Logando..." : "Carregando dashboard..."}
              </p>
            </div>
          </div>
        )}

        {embedError && (
          <div className="bi-loading-overlay">
            <div className="flex flex-col items-center gap-3">
              <div className="text-4xl">��️</div>
              <p className="text-sm text-red-600">{embedError}</p>
            </div>
          </div>
        )}

        <div
          className="bi-embed-card"
          ref={embedContainerRef}
          style={{
            width: "100%",
            height: "100%",
            display: embedError ? "none" : "block",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
              zIndex: 999,
            }}
          />
          <div
            ref={successOverlayRef}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              display: "none",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              pointerEvents: "none",
              transition: "opacity 0.3s ease-out",
              opacity: 0,
            }}
          >
            <div
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                color: "rgba(0, 0, 0, 0.7)",
                textShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              }}
            >
              Sucesso!
            </div>
          </div>
        </div>

        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="bi-fullscreen-toggle"
            aria-label="Sair da tela cheia"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
