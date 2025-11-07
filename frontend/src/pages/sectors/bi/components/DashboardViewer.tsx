import React, { useState, useRef, useEffect } from "react";
import { Dashboard, getPowerBIEmbedUrl } from "../data/dashboards";
import { Loader } from "lucide-react";

interface DashboardViewerProps {
  dashboard: Dashboard;
}

export default function DashboardViewer({ dashboard }: DashboardViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const embedUrl = getPowerBIEmbedUrl(dashboard.reportId);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync fullscreen state with browser events (handles Esc key and other exits)
  useEffect(() => {
    const handler = () =>
      setIsFullscreen(
        Boolean(
          (document as any).fullscreenElement ||
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
    try {
      const docAny = document as any;
      const isInFs = !!(
        docAny.fullscreenElement ||
        docAny.webkitFullscreenElement ||
        docAny.mozFullScreenElement
      );

      if (!isInFs) {
        if (containerRef.current) {
          const el: any = containerRef.current;
          if (el.requestFullscreen) await el.requestFullscreen();
          else if (el.webkitRequestFullscreen)
            await el.webkitRequestFullscreen();
          else if (el.mozRequestFullScreen) await el.mozRequestFullScreen();
          // optimistically set state so controls appear even if vendor events don't fire
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (docAny.webkitExitFullscreen)
          await docAny.webkitExitFullscreen();
        else if (docAny.mozCancelFullScreen) await docAny.mozCancelFullScreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header compacto (aparece normalmente; in fullscreen será reposicionado por CSS) */}
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
            {isFullscreen ? (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 9L5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 15L19 19"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 3H5a2 2 0 0 0-2 2v4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 21h4a2 2 0 0 0 2-2v-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 9V5a2 2 0 0 0-2-2h-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 15v4a2 2 0 0 0 2 2h4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Container principal OTIMIZADO */}
      <div className="flex-1 bi-viewer-outer" ref={containerRef}>
        {isLoading && (
          <div className="bi-loading-overlay">
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-gray-600">Carregando dashboard...</p>
            </div>
          </div>
        )}

        <div className="bi-embed-card">
          <div className="bi-embed-viewport">
            <div className="bi-embed-inner">
              <iframe
                title={dashboard.title}
                src={embedUrl}
                frameBorder="0"
                allowFullScreen
                onLoad={() => setIsLoading(false)}
                className="bi-embed-iframe"
              />
            </div>
          </div>
        </div>

        {/* Floating exit button visible in fullscreen mode */}
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
