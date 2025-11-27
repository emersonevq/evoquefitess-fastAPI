import { createContext, useContext, ReactNode } from "react";
import { useAuth0 as useAuth0Hook } from "@auth0/auth0-react";
import { useState, useEffect } from "react";

interface AuthContextType {
  user: {
    id?: number;
    email: string;
    name: string;
    nivel_acesso?: string;
    setores?: string[];
    bi_subcategories?: string[] | null;
    loginTime: number;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email?: string, password?: string) => Promise<boolean>;
  logout: () => void;
  loginWithAuth0: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    isAuthenticated: auth0IsAuthenticated,
    isLoading: auth0IsLoading,
    user: auth0User,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0Hook();

  const [user, setUser] = useState<AuthContextType["user"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appIsReady, setAppIsReady] = useState(false);

  // When Auth0 user changes, validate with backend
  useEffect(() => {
    const syncUserWithBackend = async () => {
      if (!auth0IsAuthenticated || !auth0User?.email) {
        setUser(null);
        setIsLoading(false);
        setAppIsReady(true);
        return;
      }

      try {
        // Get Auth0 access token
        const token = await getAccessTokenSilently({
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        });

        // Validate token with backend and get user data
        const response = await fetch("/api/usuarios/auth0-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: auth0User.email,
            name: auth0User.name || "",
          }),
        });

        if (!response.ok) {
          if (response.status === 403) {
            // Email not found in system
            setUser(null);
            console.error("Email não autorizado:", auth0User.email);
          } else {
            console.error("Erro ao validar com backend:", response.status);
          }
          setIsLoading(false);
          setAppIsReady(true);
          return;
        }

        const data = await response.json();
        const now = Date.now();

        setUser({
          id: data.id,
          email: data.email,
          name: `${data.nome} ${data.sobrenome}`,
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
      } finally {
        setIsLoading(false);
        setAppIsReady(true);
      }
    };

    if (!auth0IsLoading) {
      syncUserWithBackend();
    }
  }, [auth0IsAuthenticated, auth0User?.email, auth0IsLoading, getAccessTokenSilently]);

  const login = async (email?: string, password?: string) => {
    // Legacy login method - not used with Auth0, kept for compatibility
    return false;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("evoque-fitness-auth");
    localStorage.removeItem("evoque-fitness-auth");
    
    // Auth0 logout with redirect
    auth0Logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  const loginWithAuth0 = async () => {
    try {
      await loginWithRedirect({
        appState: { returnTo: window.location.pathname },
        connection: "Microsoft-Evoque",
      });
    } catch (error) {
      console.error("Erro ao fazer login com Auth0:", error);
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user && auth0IsAuthenticated,
    isLoading: auth0IsLoading || !appIsReady,
    login,
    logout,
    loginWithAuth0,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
