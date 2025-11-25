import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export interface Dashboard {
  id: number;
  dashboard_id: string;
  title: string;
  description: string | null;
  report_id: string;
  dataset_id: string | null;
  category: string;
  category_name: string;
  order: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface DashboardCategory {
  id: string;
  name: string;
  dashboards: Dashboard[];
}

export function useDashboards() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<DashboardCategory[]>([]);
  const { user } = useAuth();
  const [lastPermissions, setLastPermissions] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    const fetchDashboards = async () => {
      if (isFetching) {
        console.log("[BI] ⏳ Fetch já em andamento, ignorando nova requisição");
        return;
      }

      try {
        setIsFetching(true);
        setLoading(true);
        setError(null);

        console.log("[BI] 📥 Buscando dashboards do banco de dados...");

        const response = await apiFetch("/powerbi/db/dashboards");

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: Falha ao buscar dashboards do servidor`,
          );
        }

        const dashboards: Dashboard[] = await response.json();

        if (!Array.isArray(dashboards)) {
          throw new Error("Resposta inválida: esperado array de dashboards");
        }

        console.log(`[BI] ✅ ${dashboards.length} dashboards encontrados`);

        // Log cada dashboard para debug
        dashboards.forEach((dash) => {
          console.log(`[BI]   - ${dash.title} (${dash.dashboard_id})`);
          console.log(`[BI]     Report: ${dash.report_id}`);
          console.log(`[BI]     Dataset: ${dash.dataset_id}`);
        });

        // Filter dashboards based on user permissions
        let filteredDashboards = dashboards;
        if (
          user &&
          user.bi_subcategories &&
          Array.isArray(user.bi_subcategories) &&
          user.bi_subcategories.length > 0
        ) {
          console.log(
            `[BI] 🔐 Filtrando dashboards por permissão do usuário:`,
            user.bi_subcategories,
          );
          filteredDashboards = dashboards.filter((dash) =>
            user.bi_subcategories.includes(dash.dashboard_id),
          );
          console.log(
            `[BI] ✅ ${filteredDashboards.length} dashboards após filtragem`,
          );
        } else {
          console.log("[BI] ⚠️ Usuário sem permissões de BI definidas");
        }

        // Group dashboards by category
        const grouped = filteredDashboards.reduce((acc, dashboard) => {
          const existingCategory = acc.find(
            (cat) => cat.id === dashboard.category,
          );

          if (existingCategory) {
            existingCategory.dashboards.push(dashboard);
          } else {
            acc.push({
              id: dashboard.category,
              name: dashboard.category_name,
              dashboards: [dashboard],
            });
          }

          return acc;
        }, [] as DashboardCategory[]);

        // Sort dashboards within each category by order
        grouped.forEach((category) => {
          category.dashboards.sort((a, b) => a.order - b.order);
        });

        console.log(
          `[BI] ✅ Dashboards organizados em ${grouped.length} categorias`,
        );
        setCategories(grouped);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido";
        console.error("[BI] ❌ Erro ao buscar dashboards:", message);
        setError(message);
      } finally {
        setLoading(false);
        setIsFetching(false);
      }
    };

    // Only refetch if user permissions actually changed
    const currentPermissions = JSON.stringify(user?.bi_subcategories || []);
    if (currentPermissions !== lastPermissions && !isFetching) {
      console.log("[BI] 🔄 Permissões alteradas, recarregando dashboards");
      setLastPermissions(currentPermissions);
      fetchDashboards();
    }
  }, [user?.bi_subcategories, lastPermissions, isFetching]);

  const getDashboardById = (dashboardId: string): Dashboard | undefined => {
    for (const category of categories) {
      const dashboard = category.dashboards.find(
        (d) => d.dashboard_id === dashboardId,
      );
      if (dashboard) return dashboard;
    }
    return undefined;
  };

  return {
    categories,
    loading,
    error,
    getDashboardById,
  };
}
