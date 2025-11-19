import React, { useState, useRef, useEffect } from "react";
import { Dashboard } from "../hooks/useDashboards";
import { Loader } from "lucide-react";
import { apiFetch } from "@/lib/api";
import * as pbi from "powerbi-client";
import confetti from "canvas-confetti";
import {
  diagnostics,
  logDashboardTransition,
  validateDashboardData,
} from "../utils/dashboard-diagnostics";

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

      // 1. Remover listeners do report anterior
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

      // 2. Resetar Power BI Service ANTES de limpar container
      // Isso é importante - o Service precisa saber que o container vai mudar
      if (powerBiClient && embedContainerRef.current) {
        try {
          powerBiClient.reset(embedContainerRef.current);
          console.log("[PowerBI] Power BI Service resetado");
        } catch (e) {
          console.warn("[PowerBI] Erro ao resetar Power BI Service:", e);
        }
      }

      // 3. Limpar container completamente
      if (embedContainerRef.current) {
        try {
          // Remover todos os iframes e elementos
          const iframes = embedContainerRef.current.querySelectorAll("iframe");
          iframes.forEach((iframe) => {
            try {
              iframe.remove();
              console.log("[PowerBI] iframe removido");
            } catch (e) {
              console.warn("[PowerBI] Erro ao remover iframe:", e);
            }
          });

          // Limpar todo o conteúdo
          embedContainerRef.current.innerHTML = "";

          // Remover atributos de estilo
          embedContainerRef.current.style.cssText = "";

          // Remover atributos customizados que o Power BI pode ter adicionado
          Array.from(embedContainerRef.current.attributes).forEach((attr) => {
            if (
              attr.name.startsWith("data-") ||
              attr.name.startsWith("aria-")
            ) {
              embedContainerRef.current?.removeAttribute(attr.name);
            }
          });

          console.log("[PowerBI] Container totalmente limpo");
        } catch (e) {
          console.warn("[PowerBI] Erro ao limpar container:", e);
        }
      }

      // 4. Destruir instância anterior do Service
      if (powerBiClient) {
        try {
          // Setar como null para garbage collection
          powerBiClient = null;
          console.log(
            "[PowerBI] Instância anterior do Power BI Service destruída",
          );
        } catch (e) {
          console.warn("[PowerBI] Erro ao destruir Service:", e);
        }
      }
    };

    const embedReport = async () => {
      try {
        if (!isMounted) return;

        // Validar dados do dashboard
        const validationErrors = validateDashboardData(dashboard);
        if (validationErrors.length > 0) {
          console.error("[PowerBI] ❌ Validação falhou:", validationErrors);
          throw new Error(validationErrors.join("; "));
        }

        console.log(`[PowerBI] 📊 Carregando dashboard: ${dashboard.title}`);
        console.log(
          `[PowerBI] Report ID: ${dashboard.report_id}, Dataset ID: ${dashboard.dataset_id}`,
        );

        logDashboardTransition(
          "previous",
          dashboard.title,
          dashboard.report_id,
          dashboard.dataset_id,
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
          },
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

        console.group("[PowerBI] 📊 Resposta do servidor recebida");
        console.log("Token:", token ? "✅ Presente" : "❌ Ausente");
        console.log("Token type:", typeof token);
        console.log("Token length:", token?.length || 0);

        console.log("embedUrl:", embedUrl ? "✅ Presente" : "❌ Ausente");
        if (embedUrl) {
          console.log("embedUrl type:", typeof embedUrl);
          console.log("embedUrl length:", embedUrl.length);
          // Log URL completa (importante para debug)
          console.log("embedUrl COMPLETA:", embedUrl);
          console.log("Válida (https):", embedUrl.startsWith("https://"));
          console.log(
            "Contém app.powerbi.com:",
            embedUrl.includes("app.powerbi.com"),
          );
          console.log("Contém reportId:", embedUrl.includes("reportId"));
          console.log("Contém groupId:", embedUrl.includes("groupId"));
        }
        console.groupEnd();

        // Validação rigorosa
        if (!token || typeof token !== "string" || token.trim().length === 0) {
          throw new Error(
            `Token inválido: tipo=${typeof token}, length=${token?.length || 0}`,
          );
        }

        if (
          !embedUrl ||
          typeof embedUrl !== "string" ||
          embedUrl.trim().length === 0
        ) {
          throw new Error(
            `embedUrl inválida: tipo=${typeof embedUrl}, length=${embedUrl?.length || 0}`,
          );
        }

        if (!isMounted) {
          console.log("[PowerBI] Componente desmontado, abortando");
          return;
        }

        // Validar URL ANTES de usar
        if (
          !embedUrl ||
          typeof embedUrl !== "string" ||
          embedUrl.trim().length === 0
        ) {
          throw new Error(
            `embedUrl inválida: tipo=${typeof embedUrl}, length=${embedUrl?.length || 0}`,
          );
        }

        if (!embedUrl.startsWith("https://")) {
          throw new Error(
            `embedUrl não começa com https://: ${embedUrl.substring(0, 50)}`,
          );
        }

        if (!embedUrl.includes("app.powerbi.com")) {
          throw new Error(
            `embedUrl não contém app.powerbi.com: ${embedUrl.substring(0, 50)}`,
          );
        }

        console.log("[PowerBI] ✅ embedUrl passou na validação");

        // Criar NOVA instância do Power BI Service para este dashboard
        powerBiClient = new pbi.service.Service(
          pbi.factories.hpmFactory,
          pbi.factories.wpmpFactory,
          pbi.factories.routerFactory,
        );

        console.log("[PowerBI] ✅ Nova instância do Power BI Service criada");

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
          console.log(
            "[PowerBI] ❌ Container não disponível (null ou not mounted)",
          );
          throw new Error(
            "embedContainerRef.current is null or component not mounted",
          );
        }

        // Verificar que o container existe no DOM
        if (!document.body.contains(embedContainerRef.current)) {
          console.log("[PowerBI] ❌ Container não está no DOM");
          throw new Error("embedContainerRef.current is not in the DOM");
        }

        // IMPORTANTE: Verificar que o container está vazio ANTES de resetar
        console.log(
          "[PowerBI] Container estado antes de reset - Children count:",
          embedContainerRef.current.children.length,
          "- offsetHeight:",
          embedContainerRef.current.offsetHeight,
        );

        // Resetar container e criar novo embed
        try {
          powerBiClient.reset(embedContainerRef.current);
          console.log("[PowerBI] Container resetado com sucesso");
        } catch (resetError) {
          console.warn("[PowerBI] Erro ao resetar container:", resetError);
          // Se reset falhou, limpar manualmente
          embedContainerRef.current.innerHTML = "";
          console.log("[PowerBI] Container limpo manualmente");
        }

        if (!isMounted) {
          console.log("[PowerBI] Componente desmontado após limpeza");
          return;
        }

        console.log("[PowerBI] 🚀 Chamando powerBiClient.embed()...");
        console.log("[PowerBI] embedContainerRef.current status:", {
          exists: !!embedContainerRef.current,
          inDOM: embedContainerRef.current
            ? document.body.contains(embedContainerRef.current)
            : false,
          children: embedContainerRef.current?.children.length || 0,
          clientRect: embedContainerRef.current?.getBoundingClientRect(),
        });

        let report: pbi.Report;
        try {
          report = powerBiClient.embed(
            embedContainerRef.current,
            embedConfig,
          ) as pbi.Report;
        } catch (embedError) {
          console.error("[PowerBI] ❌ Erro durante embed:", embedError);
          console.error("[PowerBI] embedContainerRef no momento do erro:", {
            exists: !!embedContainerRef.current,
            inDOM: embedContainerRef.current
              ? document.body.contains(embedContainerRef.current)
              : false,
          });
          throw new Error(
            `Erro ao chamar embed: ${embedError instanceof Error ? embedError.message : String(embedError)}`,
          );
        }
        console.log("[PowerBI] ✅ powerBiClient.embed() completou");

        if (!isMounted) {
          console.log("[PowerBI] Componente desmontado após embed");
          return;
        }

        reportRef.current = report;

        // Listeners com verificação isMounted
        report.on("loaded", () => {
          console.log("[PowerBI] ✅ Relatório carregado");
          if (isMounted) {
            diagnostics.recordAttempt(
              dashboard.title,
              dashboard.report_id,
              dashboard.dataset_id,
              "✅ Token obtido com sucesso",
              "✅ Embed URL válida",
            );
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
            const errorMsg =
              event?.detail?.message ||
              "❌ Erro desconhecido ao carregar relatório";
            diagnostics.recordAttempt(
              dashboard.title,
              dashboard.report_id,
              dashboard.dataset_id,
              "⚠️ Token obtido",
              "❌ Erro ao renderizar",
              [errorMsg],
            );
            setEmbedError(errorMsg);
            setIsLoading(false);
            setIsAuthenticating(false);
          }
        });
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("[PowerBI] ⏹️ Requisição cancelada (dashboard mudou)");
          return;
        }

        console.error("[PowerBI] ❌ Erro ao carregar:", err);
        const errorMsg =
          err?.message || "Erro inesperado ao carregar dashboard";

        if (isMounted) {
          diagnostics.recordAttempt(
            dashboard.title,
            dashboard.report_id,
            dashboard.dataset_id,
            "❌ Erro ao obter token",
            "❌ Não carregado",
            [errorMsg],
          );
          setEmbedError(errorMsg);
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
          key={`embed-container-${dashboard.report_id}`}
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
