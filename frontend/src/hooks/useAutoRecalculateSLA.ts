import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface RecalculateStats {
  total_recalculados: number;
  em_dia: number;
  vencidos: number;
  em_andamento: number;
  congelados: number;
  erros: number;
}

export function useAutoRecalculateSLA() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/sla/recalcular/painel");
      return response.data as RecalculateStats;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-status-realtime"] });
      queryClient.invalidateQueries({ queryKey: ["sla-status"] });
    },
    onError: (error) => {
      console.error("Erro ao recalcular SLA:", error);
    },
  });

  useEffect(() => {
    mutation.mutate();
  }, []);

  return {
    stats: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
