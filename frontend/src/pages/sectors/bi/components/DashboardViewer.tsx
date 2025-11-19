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

        const response = await apiFetch(
          `/powerbi/embed-token/${dashboard.report_id}?datasetId=${dashboard.dataset_id}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: falha ao obter token`);
        }

        const data = await response.json();
        const { token, embedUrl } = data;

        if (!token || !embedUrl) {
          throw new Error("Token ou embedUrl ausente");
        }

        const powerBiClient = new pbi.service.Service(
          pbi.factories.hpmFactory,
          pbi.factories.wpmpFactory,
          pbi.factories.routerFactory
        );

        const embedConfig: pbi.IReportEmbedConfiguration = {
          type: "report",
          id: dashboard.report_id,
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
              setIsAuthenticating(false);
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
              setIsAuthenticating(false);
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
  }, [dashboard.report_id, dashboard.dataset_id]);

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
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between shadow-sm">
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">
            {dashboard.title}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{dashboard.description}</p>
        </div>
        <button
          aria-label={
            isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"
          }
          onClick={toggleFullscreen}
          className="ml-4 px-4 py-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 transition-colors font-medium text-sm text-gray-700"
        >
          {isFullscreen ? "🡻 Sair" : "🡹 Tela Cheia"}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative bg-white overflow-hidden" ref={containerRef}>
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95 z-50">
            <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-xl shadow-lg">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
              <div className="text-center">
                <p className="text-base font-semibold text-gray-900">
                  {isAuthenticating ? "Autenticando..." : "Carregando dashboard..."}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Por favor, aguarde
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {embedError && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95 z-50">
            <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
              <div className="text-5xl">⚠️</div>
              <div>
                <p className="text-base font-semibold text-red-600 mb-2">
                  Erro ao carregar dashboard
                </p>
                <p className="text-sm text-gray-600">{embedError}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                Recarregar Página
              </button>
            </div>
          </div>
        )}

        {/* Embed Container */}
        <div
          className="w-full h-full relative bg-white"
          ref={embedContainerRef}
          style={{
            display: embedError ? "none" : "block",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Confetti Canvas */}
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
              zIndex: 999,
              width: "100%",
              height: "100%",
            }}
          />

          {/* Success Overlay */}
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
                color: "rgba(0, 0, 0, 0.8)",
                textShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                padding: "20px 40px",
                borderRadius: "12px",
                backdropFilter: "blur(10px)",
              }}
            >
              ✨ Sucesso!
            </div>
          </div>
        </div>

        {/* Fullscreen Exit Button */}
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            aria-label="Sair da tela cheia"
            className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-100 transition-colors font-bold text-2xl text-gray-700"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
