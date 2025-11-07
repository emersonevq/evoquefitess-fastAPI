import { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import DashboardViewer from "./components/DashboardViewer";
import DashboardSidebar from "./components/DashboardSidebar";
import DashboardGrid from "./components/DashboardGrid";
import { dashboardsData, getAllDashboards, Dashboard } from "./data/dashboards";

export default function BiPage() {
  console.log("[BiPage] Rendering BiPage component!");
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(
    getAllDashboards()[0] || null,
  );

  const handleSelectDashboard = (dashboard: Dashboard) => {
    setSelectedDashboard(dashboard);
  };

  // Always render viewer layout (match requested design exactly)
  return (
    <Layout>
      <div className="flex h-screen">
        <DashboardSidebar
          categories={dashboardsData}
          selectedDashboard={selectedDashboard}
          onSelectDashboard={handleSelectDashboard}
        />

        <div className="flex-1 flex flex-col bg-[color:var(--background)]">
          <div className="px-6 py-3 border-b bg-transparent flex items-center gap-4">
            <div className="text-sm text-muted-foreground">☰</div>
            <h1 className="text-sm font-medium text-primary-foreground">{selectedDashboard?.title}</h1>
          </div>

          <div className="flex-1 overflow-hidden">
            {selectedDashboard && <DashboardViewer dashboard={selectedDashboard} />}
          </div>
        </div>
      </div>
    </Layout>
  );
}
