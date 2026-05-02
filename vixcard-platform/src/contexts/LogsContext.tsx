import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { UserRole } from "../types";
import { api } from "../lib/api";
import { mapLog } from "../lib/mappers";
import { useAuth } from "./AuthContext";

export type LogAction =
  | "pedido_criado"
  | "pedido_status"
  | "pedido_cancelado"
  | "pedido_nota"
  | "empresa_criada"
  | "empresa_atualizada"
  | "empresa_ativada"
  | "empresa_desativada"
  | "empresa_produtos_sincronizados"
  | "produto_criado"
  | "produto_atualizado"
  | "produto_ativado"
  | "produto_desativado"
  | "produto_removido"
  | "usuario_criado"
  | "usuario_atualizado"
  | "usuario_ativado"
  | "usuario_desativado"
  | "senha_alterada"
  | "credenciais_enviadas"
  | "login"
  | "logout";

export type LogEntityType = "Pedido" | "Empresa" | "Produto" | "Usuário" | "Sistema";

export interface LogEntry {
  id: string;
  timestamp: string;
  action: LogAction;
  entityType: LogEntityType;
  entityId: string;
  entityName: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  tenantSlug: string;
  details?: string;
}

interface LogsContextValue {
  logs: LogEntry[];
  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
}

const LogsContext = createContext<LogsContextValue | null>(null);

export function LogsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || user?.role !== 'super_admin') {
      if (!isAuthenticated) setLogs([]);
      return;
    }
    api.get<{ data: Record<string, unknown>[] }>('/audit-logs')
      .then((res) => setLogs(res.data.map(mapLog)))
      .catch(() => {});
  }, [isAuthenticated, authLoading, user?.role]);

  // Backend auto-records logs — addLog is kept for compatibility but is a no-op
  const addLog = (_entry: Omit<LogEntry, "id" | "timestamp">) => {};

  return (
    <LogsContext.Provider value={{ logs, addLog }}>
      {children}
    </LogsContext.Provider>
  );
}

export function useLog() {
  const ctx = useContext(LogsContext);
  if (!ctx) throw new Error("useLog must be used within LogsProvider");
  return ctx;
}
