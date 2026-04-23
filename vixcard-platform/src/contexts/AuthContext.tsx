import { createContext, useContext, useState, type ReactNode } from "react";
import type { User, UserRole } from "../types";

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string, tenantSlug: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Mock users for demo
const MOCK_USERS: User[] = [
  {
    id: "1",
    name: "Victor Vixcard",
    email: "admin@vixcard.com.br",
    role: "super_admin",
    tenantSlug: "sistemalegado",
    avatarInitials: "VV",
  },
  {
    id: "2",
    name: "Ana Medsenior",
    email: "admin@medsenior.com.br",
    role: "tenant_admin",
    tenantSlug: "medsenior",
    avatarInitials: "AM",
  },
  {
    id: "3",
    name: "Carlos Operador",
    email: "operador@medsenior.com.br",
    role: "operator",
    tenantSlug: "medsenior",
    avatarInitials: "CO",
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("vixcard_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (email: string, _password: string, tenantSlug: string): Promise<boolean> => {
    const found = MOCK_USERS.find(
      (u) => u.email === email && u.tenantSlug === tenantSlug
    );
    if (found) {
      setUser(found);
      localStorage.setItem("vixcard_user", JSON.stringify(found));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("vixcard_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
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
