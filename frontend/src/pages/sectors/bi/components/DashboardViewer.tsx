import { Dashboard, getPowerBIEmbedUrl } from "../data/dashboards";
import { Loader } from "lucide-react";
import { useState } from "react";

interface DashboardViewerProps {
  dashboard: Dashboard;
}

export default function DashboardViewer({ dashboard }: DashboardViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const embedUrl = getPowerBIEmbedUrl(dashboard.reportId);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-primary">{dashboard.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {dashboard.description}
          </p>
        </div>
      </div>

      <div className="flex-1 relative bg-gray-50">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Carregando dashboard...
              </p>
            </div>
          </div>
        )}

        <iframe
          title={dashboard.title}
          width="100%"
          height="100%"
          src={embedUrl}
          frameBorder="0"
          allowFullScreen
          onLoad={() => setIsLoading(false)}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
