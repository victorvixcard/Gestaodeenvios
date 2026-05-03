import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User, UserRole } from "../types";
import { api, getToken, setToken, clearToken } from "../lib/api";
import { mapUser } from "../lib/mappers";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<boolean>;
  logout: () => void;
  updateAvatar: (url: string) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api.get<Record<string, unknown>>('/me')
      .then((data) => setUser(mapUser(data)))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string, tenantSlug: string): Promise<boolean> => {
    try {
      const data = await api.post<{ token: string; user: Record<string, unknown> }>('/login', {
        email,
        password,
        tenant_slug: tenantSlug,
      });
      setToken(data.token);
      setUser(mapUser(data.user));
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    api.post('/logout', {}).catch(() => {});
    clearToken();
    setUser(null);
  };

  const updateAvatar = (url: string) => {
    setUser((prev) => (prev ? { ...prev, avatarUrl: url } : prev));
    if (user?.id) {
      api.put(`/users/${user.id}`, { avatar_url: url }).catch(() => {});
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateAvatar, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRole(): UserRole | null {
  const { user } = useAuth();
  return user?.role ?? null;
}
