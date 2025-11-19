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
    const abortController = new AbortController();
    let powerBiClient: pbi.service.Service | null = null;

    const cleanupPreviousEmbed = () => {
      console.log("[PowerBI] 🧹 Limpando embed anterior...");

      // Remover listeners do report anterior
      if (reportRef.current) {
        try {
          reportRef.current.off("loaded");
          reportRef.current.off("rendered");
          reportRef.current.off("error");
          console.log("[PowerBI] Listeners removidos");
        } catch (e) {
          console.warn("[PowerBI] Erro ao remover listeners:", e);
        }
        reportRef.current = null;
      }

      // Limpar container completamente
      if (embedContainerRef.current) {
        try {
          // Remover todos os filhos
          while (embedContainerRef.current.firstChild) {
            embedContainerRef.current.removeChild(embedContainerRef.current.firstChild);
          }
          // Resetar atributos
          embedContainerRef.current.innerHTML = "";
          embedContainerRef.current.style.cssText = "";
          console.log("[PowerBI] Container limpo");
        } catch (e) {
          console.warn("[PowerBI] Erro ao limpar container:", e);
        }
      }

      // Resetar Power BI Service se existir
      if (powerBiClient) {
        try {
          if (embedContainerRef.current) {
            powerBiClient.reset(embedContainerRef.current);
          }
          console.log("[PowerBI] Power BI Service resetado");
        } catch (e) {
          console.warn("[PowerBI] Erro ao resetar Power BI Service:", e);
        }
        powerBiClient = null;
      }
    };

    const embedReport = async () => {
      try {
        if (!isMounted) return;

        console.log(`[PowerBI] 📊 Carregando dashboard: ${dashboard.title}`);
        console.log(
          `[PowerBI] Report ID: ${dashboard.report_id}, Dataset ID: ${dashboard.dataset_id}`,
        );

        setIsLoading(true);
        setIsAuthenticating(true);
        setEmbedError(null);

        // Limpar embed anterior antes de começar
        cleanupPreviousEmbed();

        // Obter token com AbortController
        const response = await apiFetch(
          `/powerbi/embed-token/${dashboard.report_id}?datasetId=${dashboard.dataset_id}`,
          {
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: falha ao obter token do servidor`,
          );
        }

        if (!isMounted) {
          console.log("[PowerBI] Componente desmontado, abortando");
          return;
        }

        const data = await response.json();
        const { token, embedUrl } = data;

        if (!token || !embedUrl) {
          throw new Error(
            "Token ou embedUrl ausente na resposta do servidor",
          );
        }

        console.log("[PowerBI] ✅ Token recebido");
        console.log(
          "[PowerBI] embedUrl:",
          embedUrl.substring(0, 100) + "...",
        );

        if (!isMounted) {
          console.log("[PowerBI] Componente desmontado, abortando");
          return;
        }

        // Criar NOVA instância do Power BI Service para este dashboard
        powerBiClient = new pbi.service.Service(
          pbi.factories.hpmFactory,
          pbi.factories.wpmpFactory,
          pbi.factories.routerFactory,
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

        console.log("[PowerBI] 🔧 Configuração do embed pronta");

        if (!embedContainerRef.current || !isMounted) {
          console.log("[PowerBI] Container não disponível, abortando");
          return;
        }

        // Resetar container e criar novo embed
        powerBiClient.reset(embedContainerRef.current);
        console.log("[PowerBI] Container resetado");

        const report = powerBiClient.embed(
          embedContainerRef.current,
          embedConfig,
        ) as pbi.Report;

        if (!isMounted) {
          console.log("[PowerBI] Componente desmontado após embed");
          return;
        }

        reportRef.current = report;

        // Listeners com verificação isMounted
        report.on("loaded", () => {
          console.log("[PowerBI] ✅ Relatório carregado");
          if (isMounted) {
            setIsLoading(false);
            setIsAuthenticating(false);
            triggerConfetti();
          }
        });

        report.on("rendered", () => {
          console.log("[PowerBI] 🎉 Relatório renderizado");
          if (isMounted) {
            setIsAuthenticating(false);
          }
        });

        report.on("error", (event: any) => {
          console.error("[PowerBI] ❌ Erro no relatório:", event);
          if (isMounted) {
            setEmbedError(
              event?.detail?.message ||
                "❌ Erro desconhecido ao carregar relatório",
            );
            setIsLoading(false);
            setIsAuthenticating(false);
          }
        });
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log(
            "[PowerBI] ⏹️ Requisição cancelada (dashboard mudou)",
          );
          return;
        }

        console.error("[PowerBI] ❌ Erro ao carregar:", err);
        if (isMounted) {
          setEmbedError(err?.message || "Erro inesperado ao carregar dashboard");
          setIsLoading(false);
          setIsAuthenticating(false);
        }
      }
    };

    embedReport();

    return () => {
      console.log("[PowerBI] 🔌 Limpeza: Desmontando componente");
      isMounted = false;
      abortController.abort();
      cleanupPreviousEmbed();
    };
  }, [dashboard.report_id, dashboard.dataset_id, dashboard.title]);

  // Fullscreen sync
  useEffect(() => {
    const handler = () =>
      setIsFullscreen(
        Boolean(
          document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).mozFullScreenElement,
        ),
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
              <div className="text-4xl">⚠️</div>
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
