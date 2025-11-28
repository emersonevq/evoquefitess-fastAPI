import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sectors } from "@/data/sectors";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthContext } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { AlertsDisplay } from "@/components/alerts/AlertsDisplay";

export default function Index() {
  const { user } = useAuthContext();
  const [, setTick] = useState(0);
  const [showPermissionUpdate, setShowPermissionUpdate] = useState(false);

  useEffect(() => {
    const handler = () => {
      console.debug("[INDEX] Permission update detected (auth:refresh)");
      setTick((t) => t + 1);
      // Show a brief notification when permissions are updated
      setShowPermissionUpdate(true);
      setTimeout(() => setShowPermissionUpdate(false), 3000);
    };

    const userDataHandler = () => {
      console.debug("[INDEX] Permission update detected (user:data-updated)");
      setTick((t) => t + 1);
      setShowPermissionUpdate(true);
      setTimeout(() => setShowPermissionUpdate(false), 3000);
    };

    window.addEventListener("auth:refresh", handler as EventListener);
    window.addEventListener(
      "user:data-updated",
      userDataHandler as EventListener,
    );
    window.addEventListener("users:changed", handler as EventListener);

    return () => {
      window.removeEventListener("auth:refresh", handler as EventListener);
      window.removeEventListener(
        "user:data-updated",
        userDataHandler as EventListener,
      );
      window.removeEventListener("users:changed", handler as EventListener);
    };
  }, []);

  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiFetch("/alerts");
        if (res.ok) {
          const data = await res.json();
          if (mounted && Array.isArray(data)) setAlerts(data);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const dismissed =
    typeof window !== "undefined"
      ? (JSON.parse(
          localStorage.getItem("dismissedAlerts") || "[]",
        ) as number[])
      : [];
  const dismiss = (id: number) => {
    try {
      const arr = JSON.parse(
        localStorage.getItem("dismissedAlerts") || "[]",
      ) as number[];
      if (!Array.isArray(arr)) {
        localStorage.setItem("dismissedAlerts", JSON.stringify([id]));
      } else {
        if (!arr.includes(id)) arr.push(id);
        localStorage.setItem("dismissedAlerts", JSON.stringify(arr));
      }
    } catch {
      localStorage.setItem("dismissedAlerts", JSON.stringify([id]));
    }
    setAlerts((cur) => cur.filter((a) => a.id !== id));
  };

  const normalize = (s: any) =>
    typeof s === "string"
      ? s
          .normalize("NFKD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
      : s;
  const slugToKey: Record<string, string> = {
    ti: "TI",
    compras: "Compras",
    manutencao: "Manutencao",
    bi: "BI",
  };
  const canAccess = (slug: string) => {
    if (!user) return false;
    if (user.nivel_acesso === "Administrador") return true;
    const required = slugToKey[slug];
    if (!required) return false;
    const req = normalize(required);
    const arr = Array.isArray(user.setores) ? user.setores.map(normalize) : [];
    return arr.some(
      (s) => s && (s === req || s.includes(req) || req.includes(s)),
    );
  };

  return (
    <Layout>
      {/* Permission update indicator */}
      {showPermissionUpdate && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-50 border border-green-300 rounded-lg px-4 py-3 text-sm text-green-800 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
          ✓ Suas permissões foram atualizadas!
        </div>
      )}

      {/* Alerts */}
      <AlertsDisplay
        alerts={alerts}
        onDismiss={dismiss}
        dismissed={dismissed}
        userId={user?.id}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container py-8 sm:py-16">
          <div className="rounded-2xl brand-gradient px-4 py-8 sm:px-12 sm:py-16 shadow-xl">
            <div className="text-center">
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-primary-foreground drop-shadow-md">
                Evoque Fitness
              </h1>
              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-primary-foreground/90">
                Explore nossos setores e eleve sua experiência com serviços
                personalizados!
              </p>
              <div className="mt-6 sm:mt-8 flex items-center justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="lg"
                      className="rounded-full bg-background text-foreground hover:bg-background/90"
                    >
                      Escolher Setor <ChevronDown className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    {sectors.map((s) => {
                      const allowed = canAccess(s.slug);
                      const href = user
                        ? `/setor/${s.slug}`
                        : `/login?redirect=/setor/${s.slug}`;
                      return (
                        <Link key={s.slug} to={href}>
                          <DropdownMenuItem
                            className={
                              !user || allowed
                                ? ""
                                : "opacity-50 pointer-events-none"
                            }
                          >
                            {s.title}
                          </DropdownMenuItem>
                        </Link>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sectors Grid */}
      <section id="setores" className="pb-16">
        <div className="container">
          <h2 className="text-xl sm:text-2xl font-bold mb-6">Nossos setores</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {sectors.map((s) => {
              const allowed = canAccess(s.slug);
              const href = user
                ? `/setor/${s.slug}`
                : `/login?redirect=/setor/${s.slug}`;
              return (
                <Link
                  to={href}
                  key={s.slug}
                  className={`card-surface group rounded-xl p-5 transition hover:shadow-lg hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring ${user && !allowed ? "opacity-50 pointer-events-none" : ""}`}
                  aria-disabled={user ? String(!allowed) : undefined}
                >
                  <div className="flex items-center gap-3">
                    <s.icon className="size-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">{s.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {s.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </Layout>
  );
}
