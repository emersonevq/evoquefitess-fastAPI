import React, { useState, useRef } from "react";
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
      {/* Header compacto */}
      <div className="px-4 py-2 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">{dashboard.title}</h1>
          <p className="text-xs text-gray-600">{dashboard.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            aria-label="Fullscreen"
            onClick={toggleFullscreen}
            className="rounded p-1.5 bg-gray-100 hover:bg-gray-200 transition-colors"
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
        </div>
      </div>

      {/* Container principal OTIMIZADO */}
      <div className="flex-1 bi-viewer-outer" ref={containerRef}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
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
      </div>
    </div>
  );
}
