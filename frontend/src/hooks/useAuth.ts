import { useState, useEffect } from "react";
import { permissionDebugger } from "@/lib/permission-debugger";

interface AuthUser {
  id?: number;
  email: string;
  name: string;
  nivel_acesso?: string;
  setores?: string[];
  alterar_senha_primeiro_acesso?: boolean;
  loginTime: number;
}

interface AuthRecord extends AuthUser {
  expiresAt: number;
}

const AUTH_KEY = "evoque-fitness-auth";
const REMEMBER_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 dias
const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas (fallback de segurança)

function readFromStorage(): AuthUser | null {
  const now = Date.now();
  const LEGACY_EXPIRY = 24 * 60 * 60 * 1000; // compat 24h

  // Helper to validate required fields
  const isValidUser = (data: any): boolean => {
    return (
      data &&
      typeof data.email === "string" &&
      data.email.length > 0 &&
      typeof data.name === "string" &&
      data.name.length > 0 &&
      typeof data.loginTime === "number" &&
      data.loginTime > 0
    );
  };

  // 1) Preferir sessão atual (sessionStorage)
  const sessionRaw = sessionStorage.getItem(AUTH_KEY);
  if (sessionRaw) {
    try {
      const data = JSON.parse(sessionRaw) as Partial<AuthRecord & AuthUser>;

      // Check new format with expiresAt
      if (typeof (data as AuthRecord).expiresAt === "number") {
        if (now < (data as AuthRecord).expiresAt && isValidUser(data)) {
          const {
            email,
            name,
            loginTime,
            nivel_acesso,
            setores,
            alterar_senha_primeiro_acesso,
            id,
          } = data as AuthRecord & Partial<AuthUser>;
          return {
            id,
            email,
            name,
            loginTime,
            nivel_acesso,
            setores,
            alterar_senha_primeiro_acesso,
          } as AuthUser;
        }
      }
      // Check legacy format
      else if (typeof data.loginTime === "number" && isValidUser(data)) {
        if (now - data.loginTime < LEGACY_EXPIRY) {
          const {
            email,
            name,
            loginTime,
            nivel_acesso,
            setores,
            alterar_senha_primeiro_acesso,
            id,
          } = data as AuthUser & Partial<AuthRecord>;
          return {
            id,
            email,
            name,
            loginTime,
            nivel_acesso,
            setores,
            alterar_senha_primeiro_acesso,
          } as AuthUser;
        }
      }

      // Data is expired or invalid, remove it
      sessionStorage.removeItem(AUTH_KEY);
    } catch (e) {
      console.debug("[AUTH] Failed to parse sessionStorage:", e);
      sessionStorage.removeItem(AUTH_KEY);
    }
  }

  // 2) Senão, usar persistência (localStorage)
  const localRaw = localStorage.getItem(AUTH_KEY);
  if (localRaw) {
    try {
      const data = JSON.parse(localRaw) as Partial<AuthRecord & AuthUser>;

      // Check new format with expiresAt
      if (typeof (data as AuthRecord).expiresAt === "number") {
        if (now < (data as AuthRecord).expiresAt && isValidUser(data)) {
          const {
            email,
            name,
            loginTime,
            nivel_acesso,
            setores,
            alterar_senha_primeiro_acesso,
            id,
          } = data as AuthRecord & Partial<AuthUser>;
          return {
            id,
            email,
            name,
            loginTime,
            nivel_acesso,
            setores,
            alterar_senha_primeiro_acesso,
          } as AuthUser;
        }
      }
      // Check legacy format
      else if (typeof data.loginTime === "number" && isValidUser(data)) {
        if (now - data.loginTime < LEGACY_EXPIRY) {
          const {
            email,
            name,
            loginTime,
            nivel_acesso,
            setores,
            alterar_senha_primeiro_acesso,
            id,
          } = data as AuthUser & Partial<AuthRecord>;
          return {
            id,
            email,
            name,
            loginTime,
            nivel_acesso,
            setores,
            alterar_senha_primeiro_acesso,
          } as AuthUser;
        }
      }

      // Data is expired or invalid, remove it
      localStorage.removeItem(AUTH_KEY);
    } catch (e) {
      console.debug("[AUTH] Failed to parse localStorage:", e);
      localStorage.removeItem(AUTH_KEY);
    }
  }

  return null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const existing = readFromStorage();
    if (existing) setUser(existing);
    setIsLoading(false);

    // Socket.IO connection (shared on window so multiple imports don't recreate)
    let socket: any = (window as any).__APP_SOCK__;
    let mounted = true;
    const setupSocket = async () => {
      if (socket) {
        console.debug("[SIO] Socket already exists, reusing");
        return socket;
      }
      try {
        console.debug("[SIO] Setting up socket connection");
        const { io } = await import("socket.io-client");
        // Connect socket to same origin (server mounts socket.io at root /socket.io)
        const origin = window.location.origin;
        const path = "/socket.io";
        console.debug("[SIO] Connecting to", origin, "path", path);
        socket = io(origin, {
          path,
          transports: ["websocket", "polling"],
          autoConnect: true,
        });
        (window as any).__APP_SOCK__ = socket;
        console.debug("[SIO] Socket created and stored globally");

        socket.on("connect", () => {
          console.debug("[SIO] ✓ Socket connected with ID", socket.id);
          // identify if we have a current user
          const curr = readFromStorage();
          if (curr && curr.id) {
            socket.emit("identify", { user_id: curr.id });
            console.debug("[SIO] ✓ Identify emitted for user", curr.id);
          }
        });
        socket.on("disconnect", (reason: any) => {
          console.debug("[SIO] Socket disconnected:", reason);
        });
        socket.on("connect_error", (err: any) => {
          console.error("[SIO] ✗ Connection error:", err);
        });
        socket.on("auth:logout", (data: any) => {
          console.debug("[SIO] Received auth:logout event", data);
          try {
            const uid = data?.user_id;
            const curr = readFromStorage();
            if (curr && curr.id && uid === curr.id) {
              // force local logout
              setUser(null);
              sessionStorage.removeItem(AUTH_KEY);
              localStorage.removeItem(AUTH_KEY);
              window.dispatchEvent(new CustomEvent("auth:revoked"));

              // As a fallback, redirect immediately to the login page preserving current path
              try {
                const redirect =
                  window.location.pathname + window.location.search;
                window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
              } catch (e) {
                window.location.href = "/login";
              }
            }
          } catch (e) {
            console.error("[SIO] auth:logout handler error", e);
            try {
              window.location.href = "/login";
            } catch {}
          }
        });

        // Server-side permission/profile update for this user
        socket.on("auth:refresh", (data: any) => {
          console.debug(
            "[SIO] ✓ Received auth:refresh event from server",
            data,
          );
          try {
            const uid = data?.user_id;
            const curr = readFromStorage();
            if (curr && curr.id && uid === curr.id) {
              console.debug(
                "[SIO] ✓ Event is for current user",
                uid,
                "- will refresh permissions",
              );
              // Dispatch the refresh event to trigger permission updates
              window.dispatchEvent(new CustomEvent("auth:refresh"));
            } else {
              console.debug(
                "[SIO] Event is for different user or no current user. uid:",
                uid,
                "curr.id:",
                curr?.id,
              );
            }
          } catch (e) {
            console.error("[SIO] auth:refresh handler error", e);
          }
        });
      } catch (e) {
        console.error("[SIO] ✗ Socket setup error:", e);
      }
      return socket;
    };

    // Await socket setup to ensure it's ready before listening for refresh
    setupSocket().catch((err) => {
      console.error("[SIO] Failed to setup socket:", err);
    });

    const refresh = async () => {
      try {
        if (!mounted) return;
        const current = readFromStorage();
        if (!current || !current.id) return;
        console.debug("[AUTH] ⟳ Refreshing user data for id", current.id);
        permissionDebugger.log(
          "api",
          `Fetching updated user data from /api/usuarios/${current.id}`,
        );

        const res = await fetch(`/api/usuarios/${current.id}`);
        if (!res.ok) {
          console.debug("[AUTH] ✗ Refresh failed with status", res.status);
          permissionDebugger.log("api", "❌ API call failed", {
            status: res.status,
          });
          return;
        }
        const data = await res.json();
        const now = Date.now();
        const oldSetores = (current.setores || []).slice().sort();
        const newSetores = (Array.isArray(data.setores) ? data.setores : [])
          .slice()
          .sort();

        // Deep comparison of setores
        const setoresChanged =
          JSON.stringify(oldSetores) !== JSON.stringify(newSetores);

        // Also check nivel_acesso
        const nivelChanged = current.nivel_acesso !== data.nivel_acesso;

        if (setoresChanged) {
          console.log(
            "[AUTH] ✓ SETORES CHANGED:",
            oldSetores.join(", "),
            "→",
            newSetores.join(", "),
          );
          permissionDebugger.log(
            "state",
            `✓ Setores CHANGED: ${oldSetores.join(", ")} → ${newSetores.join(", ")}`,
          );
        }

        if (nivelChanged) {
          console.log(
            "[AUTH] ✓ NIVEL_ACESSO CHANGED:",
            current.nivel_acesso,
            "→",
            data.nivel_acesso,
          );
          permissionDebugger.log(
            "state",
            `✓ Nivel acesso CHANGED: ${current.nivel_acesso} → ${data.nivel_acesso}`,
          );
        }

        if (!setoresChanged && !nivelChanged) {
          console.debug("[AUTH] ℹ No permission changes detected");
          permissionDebugger.log("api", "ℹ No changes in permissions");
        }

        const base: AuthUser = {
          id: data.id,
          email: data.email,
          name: `${data.nome} ${data.sobrenome}`,
          nivel_acesso: data.nivel_acesso,
          setores: newSetores,
          loginTime: now,
          alterar_senha_primeiro_acesso: !!data.alterar_senha_primeiro_acesso,
        };
        const record: AuthRecord = {
          ...base,
          expiresAt: now + REMEMBER_EXPIRY,
        };
        console.debug("[AUTH] ✓ Updating user state with new data");
        setUser(base);

        try {
          // prefer preserving existing storage choice
          const sessionRaw = sessionStorage.getItem(AUTH_KEY);
          if (sessionRaw) {
            console.debug("[AUTH] Updating sessionStorage");
            sessionStorage.setItem(AUTH_KEY, JSON.stringify(record));
          } else {
            console.debug("[AUTH] Updating localStorage");
            localStorage.setItem(AUTH_KEY, JSON.stringify(record));
          }
        } catch (e) {
          console.error("[AUTH] Failed to update storage:", e);
        }

        // re-identify socket on refresh
        try {
          const s = (window as any).__APP_SOCK__;
          if (s && s.connected && base.id) {
            console.debug("[AUTH] Re-identifying socket after refresh");
            s.emit("identify", { user_id: base.id });
          }
        } catch (e) {
          console.debug("[AUTH] Socket re-identify failed:", e);
        }

        // Force a secondary dispatch to ensure all listeners get notified
        if (setoresChanged || nivelChanged) {
          console.debug(
            "[AUTH] Dispatching 'user:data-updated' event for UI re-render",
          );
          window.dispatchEvent(
            new CustomEvent("user:data-updated", {
              detail: {
                changed: {
                  setores: setoresChanged,
                  nivel_acesso: nivelChanged,
                },
              },
            }),
          );
        }
      } catch (err) {
        console.error("[AUTH] ✗ Refresh error:", err);
        permissionDebugger.log("api", `❌ Refresh failed: ${err}`, err);
      }
    };

    const handleAuthRefresh = (e: Event) => {
      console.debug("[AUTH] auth:refresh event received");
      refresh().catch((err) => {
        console.error("[AUTH] auth:refresh handler error:", err);
      });
    };

    const handleUsersChanged = (e: Event) => {
      console.debug("[AUTH] users:changed event received");
      refresh().catch((err) => {
        console.error("[AUTH] users:changed handler error:", err);
      });
    };

    const handleUserUpdated = (e: Event) => {
      console.debug("[AUTH] user:updated event received");
      refresh().catch((err) => {
        console.error("[AUTH] user:updated handler error:", err);
      });
    };

    window.addEventListener("auth:refresh", handleAuthRefresh as EventListener);
    window.addEventListener(
      "users:changed",
      handleUsersChanged as EventListener,
    );
    window.addEventListener("user:updated", handleUserUpdated as EventListener);

    // Polling fallback: periodically check for permission updates (every 10 seconds)
    // This ensures even if Socket.IO fails, users still get updates quickly
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const setupPolling = () => {
      if (pollInterval) clearInterval(pollInterval);
      console.debug("[AUTH] Setting up polling fallback (10s interval)");
      pollInterval = setInterval(() => {
        if (mounted) {
          // Silent poll - don't spam console
          refresh().catch(() => {});
        }
      }, 10000);
    };

    setupPolling();

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      window.removeEventListener(
        "auth:refresh",
        handleAuthRefresh as EventListener,
      );
      window.removeEventListener(
        "users:changed",
        handleUsersChanged as EventListener,
      );
      window.removeEventListener(
        "user:updated",
        handleUserUpdated as EventListener,
      );
      // do not disconnect socket here - keep global alive
    };
  }, []);

  const login = async (
    identifier: string,
    password: string,
    remember = true,
  ) => {
    try {
      const res = await fetch("/api/usuarios/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, senha: password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}) as any);
        throw new Error(
          (err && (err.detail || err.message)) || "Falha ao autenticar",
        );
      }
      const data = await res.json();
      const now = Date.now();
      const base: AuthUser = {
        id: data.id,
        email: data.email,
        name: `${data.nome} ${data.sobrenome}`,
        nivel_acesso: data.nivel_acesso,
        setores: Array.isArray(data.setores) ? data.setores : [],
        loginTime: now,
        // include flag
        alterar_senha_primeiro_acesso: !!data.alterar_senha_primeiro_acesso,
      };
      const record: AuthRecord = {
        ...base,
        expiresAt: now + (remember ? REMEMBER_EXPIRY : SESSION_EXPIRY),
      };
      setUser(base);
      try {
        const payload = JSON.stringify(record);
        if (remember) {
          sessionStorage.removeItem(AUTH_KEY);
          localStorage.setItem(AUTH_KEY, payload);
        } else {
          localStorage.removeItem(AUTH_KEY);
          sessionStorage.setItem(AUTH_KEY, payload);
        }
      } catch {}
      // identify socket if present
      try {
        const s = (window as any).__APP_SOCK__;
        if (s && s.connected && base.id)
          s.emit("identify", { user_id: base.id });
      } catch (e) {}
      // return full server data for immediate decisions
      return data;
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_KEY);
  };

  const isAuthenticated = !!user;

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}
