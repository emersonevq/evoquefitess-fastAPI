import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
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

const daily = Array.from({ length: 7 }).map((_, i) => ({
  day: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][i],
  abertos: Math.floor(Math.random() * 10) + 2,
}));
const weekly = Array.from({ length: 4 }).map((_, i) => ({
  semana: `S${i + 1}`,
  chamados: Math.floor(Math.random() * 40) + 10,
}));
const pieData = [
  { name: "Dentro SLA", value: 82 },
  { name: "Fora SLA", value: 18 },
];
const COLORS = ["#fa6400", "#334155"];

const performanceItems = [
  { label: "Tempo médio de resolução", value: "6h 12m", color: "orange" },
  { label: "Primeira resposta", value: "28m", color: "blue" },
  { label: "Taxa de reaberturas", value: "3%", color: "green" },
  { label: "Chamados em backlog", value: "14", color: "purple" },
];

const colorStyles = {
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
};

export default function Overview() {
  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          label="Chamados hoje"
          value="18"
          sub="+12% vs ontem"
          variant="orange"
          icon={TrendingUp}
          trend="up"
        />
        <Metric
          label="Tempo médio de resposta"
          value="32min"
          sub="Últimas 24h"
          variant="blue"
          icon={Clock}
        />
        <Metric
          label="SLA (30h)"
          value="82%"
          sub="Dentro do acordo"
          variant="green"
          icon={CheckCircle2}
          trend="up"
        />
        <Metric
          label="Abertos agora"
          value="7"
          sub="em andamento"
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
              <LineChart data={daily}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="day"
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
                  dataKey="abertos"
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
              <BarChart data={weekly}>
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
                  dataKey="chamados"
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
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              {pieData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index] }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {item.name}:{" "}
                    <span className="font-semibold text-foreground">
                      {item.value}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative card-surface rounded-2xl p-6 border border-border/60">
            <h3 className="font-semibold text-lg mb-4">Desempenho do mês</h3>
            <div className="space-y-4">
              {performanceItems.map((item, i) => (
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
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
