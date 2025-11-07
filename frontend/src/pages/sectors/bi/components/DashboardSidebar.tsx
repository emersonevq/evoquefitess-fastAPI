import { Dashboard, DashboardCategory } from "../data/dashboards";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id)),
  );

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-sm text-gray-700">Dashboards</h2>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-2">
        {categories.map((category) => (
          <div key={category.id} className="space-y-1">
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 transition text-sm font-medium text-gray-700"
            >
              <span>{category.name}</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  expandedCategories.has(category.id) ? "rotate-180" : ""
                }`}
              />
            </button>

            {expandedCategories.has(category.id) && (
              <div className="pl-4 space-y-1">
                {category.dashboards.map((dashboard) => (
                  <button
                    key={dashboard.id}
                    onClick={() => onSelectDashboard(dashboard)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition text-sm ${
                      selectedDashboard?.id === dashboard.id
                        ? "bg-primary/10 text-primary font-medium border border-primary/20"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {dashboard.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
