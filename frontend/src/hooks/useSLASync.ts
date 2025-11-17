import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface SLASyncStats {
  total_recalculados: number;
  em_dia: number;
  vencidos: number;
  em_andamento: number;
  congelados: number;
  erros: number;
}

/**
 * Hook para recalcular SLAs quando o painel administrativo é acessado.
 * Garante que os cálculos estejam sempre atualizados.
 */
export function useSLASync() {
  const { data: stats, refetch, isLoading } = useQuery({
    queryKey: ["sla-sync"],
    queryFn: async () => {
      const response = await api.post("/sla/recalcular/painel");
      return response.data as SLASyncStats;
    },
    enabled: false,
    staleTime: 0,
  });

  // Recalcula SLAs quando o hook é montado (ao acessar painel)
  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    stats,
    isLoading,
    refetch,
  };
}

/**
 * Hook para sincronizar todos os chamados existentes com a tabela de SLA.
 * Deve ser executado uma única vez ou para revalidação completa.
 */
export function useSLASyncAll() {
  const { data: stats, mutate, isPending } = useQuery({
    queryKey: ["sla-sync-all"],
    queryFn: async () => {
      const response = await api.post("/sla/sync/todos-chamados");
      return response.data;
    },
    enabled: false,
    staleTime: 0,
  });

  return {
    stats,
    sync: mutate,
    isPending,
  };
}
