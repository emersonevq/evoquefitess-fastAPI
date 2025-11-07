import React, { useState, useRef } from "react";
import { Dashboard, getPowerBIEmbedUrl } from "../data/dashboards";
import { Loader, ZoomIn, ZoomOut, Maximize } from "lucide-react";

interface DashboardViewerProps {
  dashboard: Dashboard;
}

export default function DashboardViewer({ dashboard }: DashboardViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const embedUrl = getPowerBIEmbedUrl(dashboard.reportId);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const zoomIn = () => setScale((s) => Math.min(2, +(s + 0.1).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.1).toFixed(2)));
  const resetZoom = () => setScale(1);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="px-6 py-3 border-b bg-transparent flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary">{dashboard.title}</h1>
          <p className="text-sm text-muted-foreground">{dashboard.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            aria-label="Zoom out"
            onClick={zoomOut}
            className="rounded-md p-2 bg-secondary/40 hover:bg-secondary/60"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            aria-label="Reset zoom"
            onClick={resetZoom}
            className="rounded-md p-2 bg-secondary/40 hover:bg-secondary/60"
          >
            <Maximize className="w-4 h-4" />
          </button>
          <button
            aria-label="Zoom in"
            onClick={zoomIn}
            className="rounded-md p-2 bg-secondary/40 hover:bg-secondary/60"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            aria-label="Fullscreen"
            onClick={toggleFullscreen}
            className="rounded-md p-2 bg-secondary/40 hover:bg-secondary/60"
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 9L5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 15L19 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 3H5a2 2 0 0 0-2 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 21h4a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 9V5a2 2 0 0 0-2-2h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 15v4a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <div className="text-sm text-muted-foreground ml-2">{Math.round(scale * 100)}%</div>
        </div>
      </div>

      <div className="flex-1 p-4 bi-viewer-outer" ref={containerRef}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
            </div>
          </div>
        )}

        <div className="bi-embed-card">
          <div
            className="bi-embed-viewport"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", overflow: "hidden" }}
          >
            <div
              className="bi-embed-inner"
              style={{ transform: `scale(${scale})`, transformOrigin: "center center", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
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
      </div>
    </div>
  );
}
