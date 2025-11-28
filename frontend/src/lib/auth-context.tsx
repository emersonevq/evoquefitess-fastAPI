import { createContext, useContext, ReactNode } from "react";
import { useState, useEffect } from "react";
import { msalInstance, scopes } from "./msal-config";
import { AuthenticationResult } from "@azure/msal-browser";

interface AuthContextType {
  user: {
    id?: number;
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    nivel_acesso?: string;
    setores?: string[];
    bi_subcategories?: string[] | null;
    loginTime: number;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email?: string, password?: string) => Promise<any>;
  logout: () => void;
  loginWithMicrosoft: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextType["user"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appIsReady, setAppIsReady] = useState(false);

  // Initialize MSAL and sync with backend on mount
  useEffect(() => {
    const initMsal = async () => {
      try {
        await msalInstance.initialize();

        // Check if there's an existing session
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          const account = accounts[0];
          // Try to get token silently
          try {
            const result = await msalInstance.acquireTokenSilent({
              scopes,
              account,
            });
            // Validate with backend
            await validateAndSyncUser(result.accessToken);
          } catch (error) {
            console.error("Erro ao obter token silenciosamente:", error);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Erro ao inicializar MSAL:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
        setAppIsReady(true);
      }
    };

    initMsal();
  }, []);

  // Validate token with backend and sync user data
  const validateAndSyncUser = async (accessToken: string) => {
    try {
      // Decode JWT to extract email (without verification, since we trust the token from MSAL)
      const decoded = decodeJwt(accessToken);
      const email = decoded.email || decoded.preferred_username || decoded.upn;

      if (!email) {
        console.error("Email não encontrado no token");
        setUser(null);
        return;
      }

      // Send to backend to validate and get user data
      const response = await fetch("/api/usuarios/msal-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email,
          name: decoded.name || "",
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          console.error("Email não autorizado:", email);
        } else {
          console.error("Erro ao validar com backend:", response.status);
        }
        setUser(null);
        return;
      }

      const data = await response.json();
      const now = Date.now();

      setUser({
        id: data.id,
        email: data.email,
        name: `${data.nome} ${data.sobrenome}`,
        firstName: data.nome,
        lastName: data.sobrenome,
        nivel_acesso: data.nivel_acesso,
        setores: Array.isArray(data.setores) ? data.setores : [],
        bi_subcategories: Array.isArray(data.bi_subcategories)
          ? data.bi_subcategories
          : null,
        loginTime: now,
      });

      // Store in sessionStorage for quick access
      sessionStorage.setItem(
        "evoque-fitness-auth",
        JSON.stringify({
          id: data.id,
          email: data.email,
          name: `${data.nome} ${data.sobrenome}`,
          firstName: data.nome,
          lastName: data.sobrenome,
          nivel_acesso: data.nivel_acesso,
          setores: Array.isArray(data.setores) ? data.setores : [],
          bi_subcategories: Array.isArray(data.bi_subcategories)
            ? data.bi_subcategories
            : null,
          loginTime: now,
        }),
      );
    } catch (error) {
      console.error("Erro ao sincronizar usuário:", error);
      setUser(null);
    }
  };

  // Traditional email/password login
  const login = async (email?: string, password?: string) => {
    try {
      if (!email || !password) {
        throw new Error("Email e senha são obrigatórios");
      }

      const response = await fetch("/api/usuarios/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, senha: password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Falha ao autenticar");
      }

      const data = await response.json();
      const now = Date.now();

      const userData = {
        id: data.id,
        email: data.email,
        name: `${data.nome} ${data.sobrenome}`,
        firstName: data.nome,
        lastName: data.sobrenome,
        nivel_acesso: data.nivel_acesso,
        setores: Array.isArray(data.setores) ? data.setores : [],
        bi_subcategories: Array.isArray(data.bi_subcategories)
          ? data.bi_subcategories
          : null,
        loginTime: now,
      };

      setUser(userData);

      // Store in sessionStorage
      sessionStorage.setItem("evoque-fitness-auth", JSON.stringify(userData));

      return {
        ...data,
        alterar_senha_primeiro_acesso:
          data.alterar_senha_primeiro_acesso || false,
      };
    } catch (error: any) {
      throw new Error(error?.message || "Falha ao autenticar");
    }
  };

  // Login with Microsoft Office 365
  const loginWithMicrosoft = async () => {
    try {
      const result: AuthenticationResult = await msalInstance.loginPopup({
        scopes,
      });

      // Validate with backend
      await validateAndSyncUser(result.accessToken);
    } catch (error) {
      console.error("Erro ao fazer login com Microsoft:", error);
      throw error;
    }
  };

  // Logout
  const logout = async () => {
    try {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        const account = accounts[0];
        await msalInstance.logoutPopup({
          account,
        });
      }
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }

    setUser(null);
    sessionStorage.removeItem("evoque-fitness-auth");
    window.location.href = "/";
  };

  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    loginWithMicrosoft,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext deve ser usado dentro de AuthProvider");
  }
  return context;
}

// Helper function to decode JWT without verification
function decodeJwt(token: string): Record<string, any> {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Erro ao decodificar JWT:", error);
    return {};
  }
}
