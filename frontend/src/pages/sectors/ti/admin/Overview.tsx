import { useEffect, useState } from "react";
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader,
  RefreshCw,
} from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSLACacheManager } from "@/hooks/useSLACacheManager";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
} from "recharts";

function Metric({
  label,
  value,
  sub,
  variant,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  variant: "orange" | "blue" | "green" | "purple";
  icon: any;
  trend?: "up" | "down";
}) {
  const colorMap = {
    orange: "from-orange-500 to-orange-600",
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    purple: "from-purple-500 to-purple-600",
  };

  return (
    <div className="relative group">
      <div
        className={`absolute -inset-1 bg-gradient-to-r ${colorMap[variant]} rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300`}
      />
      <div
        className={`relative metric-card rounded-2xl bg-gradient-to-br ${colorMap[variant]} text-white p-5 overflow-hidden`}
      >
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative space-y-3">
          <div className="flex items-start justify-between">
            <div className="text-xs font-medium opacity-90">{label}</div>
            <Icon className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-extrabold leading-none">{value}</div>
          {sub && (
            <div className="flex items-center gap-1.5 text-xs opacity-90">
              {trend &&
                (trend === "up" ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                ))}
              <span>{sub}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const COLORS = ["#fa6400", "#334155"];

const colorStyles = {
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
};

export default function Overview() {
  const { warmupCache } = useSLACacheManager();
  const queryClient = useQueryClient();
  const [metrics, setMetrics] = useState<any>(null);
  const [dailyData, setDailyData] = useState<
    Array<{ dia: string; quantidade: number }>
  >([]);
  const [weeklyData, setWeeklyData] = useState<
    Array<{ semana: string; quantidade: number }>
  >([]);
  const [slaData, setSLAData] = useState<{
    dentro_sla: number;
    fora_sla: number;
  }>({ dentro_sla: 0, fora_sla: 0 });
  const [performanceData, setPerformanceData] = useState<{
    tempo_resolucao_medio: string;
    primeira_resposta_media: string;
    taxa_reaberturas: string;
    chamados_backlog: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cache de métricas com React Query
  const { data: basicMetricsData, isLoading: basicLoading } = useQuery({
    queryKey: ["metrics-basic"],
    queryFn: async () => {
      const response = await api.get("/metrics/dashboard/basic");
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos (cache persistence)
  });

  const { data: dailyChartData, isLoading: dailyLoading } = useQuery({
    queryKey: ["metrics-daily"],
    queryFn: async () => {
      const response = await api.get("/metrics/chamados-por-dia");
      return response.data?.dados || [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { data: weeklyChartData, isLoading: weeklyLoading } = useQuery({
    queryKey: ["metrics-weekly"],
    queryFn: async () => {
      const response = await api.get("/metrics/chamados-por-semana");
      return response.data?.dados || [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { data: slaMetricsData, isLoading: slaLoading } = useQuery({
    queryKey: ["metrics-sla"],
    queryFn: async () => {
      const response = await api.get("/metrics/dashboard/sla");
      return response.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutos
    gcTime: 120 * 60 * 1000, // 120 minutos (cache persistence)
  });

  const { data: performanceMetricsData, isLoading: performanceLoading } =
    useQuery({
      queryKey: ["metrics-performance"],
      queryFn: async () => {
        const response = await api.get("/metrics/performance");
        return response.data;
      },
      staleTime: 15 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

  // Atualiza estado local quando dados do React Query chegam
  useEffect(() => {
    if (basicMetricsData) {
      setMetrics(basicMetricsData);
    }
  }, [basicMetricsData]);

  useEffect(() => {
    if (dailyChartData && Array.isArray(dailyChartData)) {
      setDailyData(dailyChartData);
    }
  }, [dailyChartData]);

  useEffect(() => {
    if (weeklyChartData && Array.isArray(weeklyChartData)) {
      setWeeklyData(weeklyChartData);
    }
  }, [weeklyChartData]);

  useEffect(() => {
    if (performanceMetricsData) {
      setPerformanceData(performanceMetricsData);
    }
  }, [performanceMetricsData]);

  useEffect(() => {
    if (slaMetricsData) {
      // Merge das métricas de SLA com validação
      setMetrics((prev) => ({
        ...prev,
        sla_compliance_24h: Number(slaMetricsData.sla_compliance_24h ?? 0),
        sla_compliance_mes: Number(slaMetricsData.sla_compliance_mes ?? 0),
        tempo_resposta_24h: slaMetricsData.tempo_resposta_24h ?? "—",
        tempo_resposta_mes: slaMetricsData.tempo_resposta_mes ?? "—",
        total_chamados_mes: Number(slaMetricsData.total_chamados_mes ?? 0),
      }));

      // Atualiza distribuição SLA
      if (slaMetricsData?.sla_distribution) {
        setSLAData({
          dentro_sla: Number(slaMetricsData.sla_distribution.dentro_sla ?? 0),
          fora_sla: Number(slaMetricsData.sla_distribution.fora_sla ?? 0),
        });
      }
    }
  }, [slaMetricsData]);

  const atualizarMetricasMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/sla/recalcular/p90-incremental");
      return response.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["metrics-basic"] });
      queryClient.invalidateQueries({ queryKey: ["metrics-sla"] });
      queryClient.invalidateQueries({ queryKey: ["metrics-daily"] });
      queryClient.invalidateQueries({ queryKey: ["metrics-weekly"] });
      queryClient.invalidateQueries({ queryKey: ["metrics-performance"] });

      const prioridades = Object.keys(data.prioridades || {});
      toast.success(
        `Métricas atualizadas! ${prioridades.length} prioridades recalculadas.`,
      );
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.detail || "Erro ao atualizar métricas de SLA",
      );
    },
  });

  // Pré-aquece cache na primeira carga
  useEffect(() => {
    const preWarmCache = async () => {
      try {
        await warmupCache();
      } catch (error) {
        console.warn("Aviso: Pré-aquecimento de cache falhou");
      }
    };
    preWarmCache();
  }, [warmupCache]);

  // Determina se está carregando
  useEffect(() => {
    const allLoading =
      basicLoading ||
      dailyLoading ||
      weeklyLoading ||
      slaLoading ||
      performanceLoading;
    setIsLoading(allLoading);
  }, [
    basicLoading,
    dailyLoading,
    weeklyLoading,
    slaLoading,
    performanceLoading,
  ]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Visão Geral</h1>
          <Button
            onClick={() => atualizarMetricasMutation.mutate()}
            disabled={atualizarMetricasMutation.isPending}
            size="sm"
            className="gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${atualizarMetricasMutation.isPending ? "animate-spin" : ""}`}
            />
            {atualizarMetricasMutation.isPending
              ? "Atualizando..."
              : "Atualizar Métricas"}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="relative group h-32 rounded-2xl bg-muted/50 animate-pulse flex items-center justify-center"
            >
              <Loader className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const comparacao = metrics?.comparacao_ontem || {
    hoje: 0,
    ontem: 0,
    percentual: 0,
    direcao: "up",
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Visão Geral</h1>
        <Button
          onClick={() => atualizarMetricasMutation.mutate()}
          disabled={atualizarMetricasMutation.isPending}
          size="sm"
          className="gap-2"
        >
          <RefreshCw
            className={`w-4 h-4 ${atualizarMetricasMutation.isPending ? "animate-spin" : ""}`}
          />
          {atualizarMetricasMutation.isPending
            ? "Atualizando..."
            : "Atualizar Métricas"}
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          label="Chamados hoje"
          value={String(metrics?.chamados_hoje || 0)}
          sub={`${comparacao.percentual >= 0 ? "+" : ""}${comparacao.percentual}% vs ontem`}
          variant="orange"
          icon={TrendingUp}
          trend={comparacao.direcao}
        />
        <Metric
          label="Tempo médio de resposta"
          value={metrics?.tempo_resposta_mes || "—"}
          sub={`Este mês (${metrics?.total_chamados_mes || 0} chamados)`}
          variant="blue"
          icon={Clock}
        />
        <Metric
          label="SLA (30h)"
          value={`${metrics?.sla_compliance_24h || 0}%`}
          sub="Dentro do acordo"
          variant="green"
          icon={CheckCircle2}
          trend={metrics && metrics.sla_compliance_24h >= 80 ? "up" : "down"}
        />
        <Metric
          label="Chamados ativos"
          value={String(metrics?.abertos_agora || 0)}
          sub="não concluídos"
          variant="purple"
          icon={AlertCircle}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative card-surface rounded-2xl p-6 border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Chamados por dia</h3>
              <div className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full">
                <span className="text-xs font-medium text-primary">
                  Última semana
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="dia"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="quantidade"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative card-surface rounded-2xl p-6 border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Chamados por semana</h3>
              <div className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full">
                <span className="text-xs font-medium text-primary">
                  Último mês
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="semana"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar
                  dataKey="quantidade"
                  fill="hsl(var(--primary))"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative card-surface rounded-2xl p-6 border border-border/60">
            <h3 className="font-semibold text-lg mb-4">Distribuição SLA</h3>
            <div className="flex items-center justify-center">
              {slaData.dentro_sla === 0 && slaData.fora_sla === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                  Sem dados de SLA
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Dentro SLA", value: slaData.dentro_sla },
                        { name: "Fora SLA", value: slaData.fora_sla },
                      ]}
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        { name: "Dentro SLA", value: slaData.dentro_sla },
                        { name: "Fora SLA", value: slaData.fora_sla },
                      ].map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              {[
                { name: "Dentro SLA", value: slaData.dentro_sla },
                { name: "Fora SLA", value: slaData.fora_sla },
              ].map((item, index) => {
                const total = slaData.dentro_sla + slaData.fora_sla;
                const percentage =
                  total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index] }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {item.name}:{" "}
                      <span className="font-semibold text-foreground">
                        {percentage}%
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative card-surface rounded-2xl p-6 border border-border/60">
            <h3 className="font-semibold text-lg mb-4">Desempenho do mês</h3>
            <div className="space-y-4">
              {!performanceData ? (
                <div className="text-muted-foreground text-center py-4">
                  Carregando dados de desempenho...
                </div>
              ) : (
                [
                  {
                    label: "Tempo médio de resolução",
                    value: performanceData.tempo_resolucao_medio,
                    color: "orange",
                  },
                  {
                    label: "Primeira resposta",
                    value: performanceData.primeira_resposta_media,
                    color: "blue",
                  },
                  {
                    label: "Taxa de reaberturas",
                    value: performanceData.taxa_reaberturas,
                    color: "green",
                  },
                  {
                    label: "Chamados em backlog",
                    value: String(performanceData.chamados_backlog),
                    color: "purple",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-1.5 h-8 rounded-full ${colorStyles[item.color as keyof typeof colorStyles]}`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-lg font-bold">{item.value}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
