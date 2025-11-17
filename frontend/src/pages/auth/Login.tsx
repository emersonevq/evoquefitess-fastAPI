// Login.tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/lib/auth-context";
import LoginMediaPanel from "./components/LoginMediaPanel";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  Headphones,
  Shield,
  Zap,
  Clock,
} from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result: any = await login(email, password, remember);
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect") || "/";

      if (result && result.alterar_senha_primeiro_acesso) {
        navigate("/auth/change-password", { replace: true });
      } else {
        navigate(redirect, { replace: true });
      }
    } catch (err: any) {
      alert(err?.message || "Falha ao autenticar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100svh] w-full flex items-center justify-center overflow-hidden bg-background">
      {/* Fundo com mídia */}
      <LoginMediaPanel />

      {/* Conteúdo principal */}
      <div className="relative z-10 w-full h-screen flex items-center justify-center p-6 md:p-10">
        <div
          className={`w-full max-w-[480px] transition-all duration-1000 ${
            mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          {/* Card de Login */}
          <div className="card-surface rounded-xl p-6 sm:p-8 shadow-2xl border">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-lg animate-pulse" />
                  <div className="relative p-3.5 brand-gradient rounded-2xl shadow-lg">
                    <Headphones className="w-7 h-7 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Central de Suporte
                  </h1>
                  <p className="text-sm text-primary font-medium">
                    Sistema de Atendimento TI
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                Acesse o portal para abrir chamados, acompanhar solicitações e
                obter suporte técnico especializado.
              </p>
            </div>

            {/* Formulário */}
            <form onSubmit={submit} className="space-y-4">
              {/* Email */}
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail ou usuário</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="text"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="grid gap-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10 pr-10 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Lembrar & Esqueci senha */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                  />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors select-none">
                    Lembrar-me
                  </span>
                </label>
                <Link
                  to="/auth/forgot-password"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Esqueci minha senha
                </Link>
              </div>

              {/* Botão de login */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-md mt-6 group"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    <span>Autenticando...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>Acessar Portal</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </Button>
            </form>

            {/* Features */}
            <div className="mt-6 pt-6 border-t">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Shield, label: "Seguro" },
                  { icon: Zap, label: "Rápido" },
                  { icon: Clock, label: "24/7" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <item.icon className="w-5 h-5 text-primary" />
                    <span className="text-xs text-muted-foreground font-medium">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-xs text-muted-foreground text-center">
                © {new Date().getFullYear()} Central de Suporte TI — Sistema
                interno
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
