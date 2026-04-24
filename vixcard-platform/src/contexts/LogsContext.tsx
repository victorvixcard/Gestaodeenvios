import { createContext, useContext, useState, type ReactNode } from "react";
import type { UserRole } from "../types";

export type LogAction =
  | "pedido_criado"
  | "pedido_status"
  | "pedido_cancelado"
  | "pedido_nota"
  | "empresa_criada"
  | "empresa_atualizada"
  | "empresa_ativada"
  | "empresa_desativada"
  | "produto_criado"
  | "produto_atualizado"
  | "produto_ativado"
  | "produto_desativado"
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

const t = (offsetMs: number) => new Date(Date.now() - offsetMs).toISOString();
const DAY = 86400000;

const INITIAL_LOGS: LogEntry[] = [
  {
    id: "l1", timestamp: t(2 * DAY),
    action: "pedido_criado", entityType: "Pedido", entityId: "ORD-001", entityName: "Cartões PVC — Lote Março",
    userName: "Ana Medsenior", userEmail: "admin@medsenior.com.br", userRole: "tenant_admin", tenantSlug: "medsenior",
    details: "Pedido criado com 1 item: Cartão PVC × 5.000",
  },
  {
    id: "l2", timestamp: t(1.8 * DAY),
    action: "pedido_status", entityType: "Pedido", entityId: "ORD-001", entityName: "Cartões PVC — Lote Março",
    userName: "Victor Vixcard", userEmail: "admin@vixcard.com.br", userRole: "super_admin", tenantSlug: "medsenior",
    details: "Status: Aguardando → Em Produção",
  },
  {
    id: "l3", timestamp: t(2 * DAY + 3600000),
    action: "pedido_criado", entityType: "Pedido", entityId: "ORD-002", entityName: "Carnê 2-4 lâminas — Abril",
    userName: "Carlos Operador", userEmail: "operador@medsenior.com.br", userRole: "operator", tenantSlug: "medsenior",
    details: "Pedido criado com 1 item: Carnê 2-4 lâminas × 2.000",
  },
  {
    id: "l4", timestamp: t(1.5 * DAY),
    action: "pedido_cancelado", entityType: "Pedido", entityId: "ORD-004", entityName: "Impressão Carta Notificação",
    userName: "Ana Medsenior", userEmail: "admin@medsenior.com.br", userRole: "tenant_admin", tenantSlug: "medsenior",
    details: "Motivo: Arquivo de layout precisa ser refeito",
  },
  {
    id: "l5", timestamp: t(1 * DAY),
    action: "pedido_status", entityType: "Pedido", entityId: "ORD-003", entityName: "Etiquetas Adesivas — Fevereiro",
    userName: "Victor Vixcard", userEmail: "admin@vixcard.com.br", userRole: "super_admin", tenantSlug: "medsenior",
    details: "Status: Em Produção → Finalizado",
  },
  {
    id: "l6", timestamp: t(0.8 * DAY),
    action: "pedido_status", entityType: "Pedido", entityId: "ORD-005", entityName: "Cartões PVC Convênio Q1",
    userName: "Victor Vixcard", userEmail: "admin@vixcard.com.br", userRole: "super_admin", tenantSlug: "unimed",
    details: "Status: Em Produção → Acabamento",
  },
  {
    id: "l7", timestamp: t(0.5 * DAY),
    action: "empresa_criada", entityType: "Empresa", entityId: "sebrae", entityName: "SEBRAE",
    userName: "Victor Vixcard", userEmail: "admin@vixcard.com.br", userRole: "super_admin", tenantSlug: "sistemalegado",
    details: "Empresa criada com 2 produtos vinculados",
  },
  {
    id: "l8", timestamp: t(0.3 * DAY),
    action: "usuario_criado", entityType: "Usuário", entityId: "u5", entityName: "Admin SEBRAE",
    userName: "Victor Vixcard", userEmail: "admin@vixcard.com.br", userRole: "super_admin", tenantSlug: "sistemalegado",
    details: "Perfil: Administrador — Empresa: SEBRAE",
  },
  {
    id: "l9", timestamp: t(0.1 * DAY),
    action: "pedido_nota", entityType: "Pedido", entityId: "ORD-001", entityName: "Cartões PVC — Lote Março",
    userName: "Ana Medsenior", userEmail: "admin@medsenior.com.br", userRole: "tenant_admin", tenantSlug: "medsenior",
    details: "Anotação adicionada: Arquivo enviado com os dados atualizados",
  },
];

export function LogsProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);

  const addLog = (entry: Omit<LogEntry, "id" | "timestamp">) => {
    setLogs((prev) => [
      { ...entry, id: `l-${Date.now()}`, timestamp: new Date().toISOString() },
      ...prev,
    ]);
  };

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
