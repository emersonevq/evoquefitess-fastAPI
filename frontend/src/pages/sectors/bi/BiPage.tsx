import { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import DashboardViewer from "./components/DashboardViewer";
import DashboardSidebar from "./components/DashboardSidebar";
import DashboardGrid from "./components/DashboardGrid";
import { dashboardsData, getAllDashboards, Dashboard } from "./data/dashboards";

export default function BiPage() {
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"grid" | "viewer">("grid");

  useEffect(() => {
    if (viewMode === "viewer" && !selectedDashboard) {
      const firstDashboard = getAllDashboards()[0];
      if (firstDashboard) {
        setSelectedDashboard(firstDashboard);
      }
    }
  }, [viewMode, selectedDashboard]);

  const handleSelectDashboard = (dashboard: Dashboard) => {
    setSelectedDashboard(dashboard);
    setViewMode("viewer");
  };

  return (
    <Layout>
      {viewMode === "grid" ? (
        <div className="container py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">
              Portal de BI
            </h1>
            <p className="text-muted-foreground">
              Analise dados e visualize insights em dashboards interativos
            </p>
          </div>

          <DashboardGrid
            dashboards={getAllDashboards()}
            onSelectDashboard={handleSelectDashboard}
          />
        </div>
      ) : selectedDashboard ? (
        <div className="flex h-screen bg-white">
          <DashboardSidebar
            categories={dashboardsData}
            selectedDashboard={selectedDashboard}
            onSelectDashboard={handleSelectDashboard}
          />

          <div className="flex-1 flex flex-col">
            <div className="px-6 py-3 border-b bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => setViewMode("grid")}
                className="text-sm text-primary hover:text-primary/80 font-medium"
              >
                ← Voltar para Dashboards
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <DashboardViewer dashboard={selectedDashboard} />
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
