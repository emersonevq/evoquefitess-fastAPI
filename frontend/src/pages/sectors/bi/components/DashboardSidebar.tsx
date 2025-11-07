import { Dashboard, DashboardCategory } from "../data/dashboards";

interface DashboardSidebarProps {
  categories: DashboardCategory[];
  selectedDashboard: Dashboard | null;
  onSelectDashboard: (dashboard: Dashboard) => void;
}

export default function DashboardSidebar({
  categories,
  selectedDashboard,
  onSelectDashboard,
}: DashboardSidebarProps) {
  const dashboards = categories.flatMap((c) => c.dashboards);

  return (
    <aside className="bi-sidebar">
      <div className="bi-sidebar-header">
        <img
          src="https://images.totalpass.com/public/1280x720/czM6Ly90cC1pbWFnZS1hZG1pbi1wcm9kL2d5bXMva2g2OHF6OWNuajloN2lkdnhzcHhhdWx4emFhbWEzYnc3MGx5cDRzZ3p5aTlpZGM0OHRvYnk0YW56azRk"
          alt="Evoque"
          className="bi-logo"
        />
        <h2 className="bi-sidebar-title">Dashboards</h2>
      </div>

      <nav className="bi-nav" aria-label="Dashboards navigation">
        {dashboards.map((dashboard) => (
          <button
            key={dashboard.id}
            onClick={() => onSelectDashboard(dashboard)}
            className={`bi-item ${
              selectedDashboard?.id === dashboard.id ? "active" : ""
            }`}
            title={dashboard.title}
            aria-current={selectedDashboard?.id === dashboard.id}
          >
            <span className="bi-item-label">{dashboard.title}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
