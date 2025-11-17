import Layout from "@/components/layout/Layout";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Menu,
  LayoutDashboard,
  FileText,
  Users,
  Activity,
  Clock,
  Puzzle,
  Settings,
  Cog,
  ChevronRight,
} from "lucide-react";
import NotificationBell from "./components/NotificationBell";

const iconMap = {
  "Visão geral": LayoutDashboard,
  "Gerenciar chamados": FileText,
  "Gerenciar usuários": Users,
  Monitoramento: Activity,
  Histórico: Clock,
  Integrações: Puzzle,
  Sistema: Cog,
  Configurações: Settings,
};

const groups = [
  {
    title: "Operação",
    items: [
      { to: "/setor/ti/admin/overview", label: "Visão geral" },
      { to: "/setor/ti/admin/chamados", label: "Gerenciar chamados" },
      { to: "/setor/ti/admin/usuarios", label: "Gerenciar usuários" },
    ],
  },
  {
    title: "Monitoramento",
    items: [
      { to: "/setor/ti/admin/monitoramento", label: "Monitoramento" },
      { to: "/setor/ti/admin/historico", label: "Histórico" },
    ],
  },
  {
    title: "Administração",
    items: [
      { to: "/setor/ti/admin/integracoes", label: "Integrações" },
      { to: "/setor/ti/admin/sistema", label: "Sistema" },
      { to: "/setor/ti/admin/configuracoes", label: "Configurações" },
    ],
  },
];

export default function AdminLayout() {
  return (
    <Layout>
      {/* Header */}
      <section className="w-full border-b border-border/60">
        <div className="brand-gradient relative overflow-hidden">
          {/* Background pattern */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
              backgroundSize: "64px 64px",
            }}
          />

          <div className="container py-8 sm:py-10 relative">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full mb-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-white">
                    Sistema Ativo
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-primary-foreground drop-shadow-lg">
                  Painel Administrativo — TI
                </h1>
                <p className="mt-1 text-primary-foreground/90 text-sm sm:text-base">
                  Métricas, gerenciamento e configurações do setor
                </p>
              </div>
              <div className="pt-1">
                <NotificationBell />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-6 grid grid-cols-1 md:grid-cols-[280px,1fr] gap-6">
        {/* Sidebar Desktop */}
        <aside className="hidden md:block">
          <div className="sticky top-24 space-y-2">
            {groups.map((g) => (
              <div key={g.title} className="space-y-2">
                <div className="px-4 py-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {g.title}
                  </h3>
                </div>
                <nav className="space-y-1">
                  {g.items.map((i) => {
                    const Icon =
                      iconMap[i.label as keyof typeof iconMap] || FileText;
                    return (
                      <NavLink
                        key={i.to}
                        to={i.to}
                        className={({ isActive }) =>
                          `group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              className={`w-4 h-4 ${isActive ? "" : "group-hover:scale-110 transition-transform"}`}
                            />
                            <span className="text-sm font-medium flex-1">
                              {i.label}
                            </span>
                            {isActive && <ChevronRight className="w-4 h-4" />}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0">
          {/* Mobile menu */}
          <div className="mb-4 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary" className="rounded-xl h-11 gap-2">
                  <Menu className="size-4" />
                  <span>Menu de navegação</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85%] sm:w-[350px]">
                <div className="mt-8 space-y-6">
                  {groups.map((g) => (
                    <div key={g.title} className="space-y-2">
                      <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {g.title}
                      </h3>
                      <nav className="space-y-1">
                        {g.items.map((i) => {
                          const Icon =
                            iconMap[i.label as keyof typeof iconMap] ||
                            FileText;
                          return (
                            <Link
                              key={i.to}
                              to={i.to}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors group"
                            >
                              <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              <span className="text-sm font-medium">
                                {i.label}
                              </span>
                            </Link>
                          );
                        })}
                      </nav>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Outlet />
        </div>
      </section>
    </Layout>
  );
}
