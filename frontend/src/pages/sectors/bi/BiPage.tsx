import { useState } from "react";
import Layout from "@/components/layout/Layout";
import DashboardViewer from "./components/DashboardViewer";
import DashboardSidebar from "./components/DashboardSidebar";
import AuthenticationHandler from "./components/AuthenticationHandler";
import { dashboardsData, getAllDashboards, Dashboard } from "./data/dashboards";

export default function BiPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(
    getAllDashboards()[0] || null,
  );

  const handleSelectDashboard = (dashboard: Dashboard) => {
    setSelectedDashboard(dashboard);
  };

  return (
    <Layout>
      <AuthenticationHandler onAuthenticated={() => setIsAuthenticated(true)}>
        {isAuthenticated && (
          <div className="bi-page-root">
            {/* Sidebar com lista de dashboards */}
            <DashboardSidebar
              categories={dashboardsData}
              selectedDashboard={selectedDashboard}
              onSelectDashboard={handleSelectDashboard}
            />

            {/* Área principal de conteúdo - OTIMIZADA */}
            <main className="bi-content">
              {selectedDashboard && (
                <DashboardViewer dashboard={selectedDashboard} />
              )}
            </main>
          </div>
        )}
      </AuthenticationHandler>
    </Layout>
  );
}
