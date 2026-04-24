import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList, Search, Filter, ShoppingCart, Building2,
  Package, Users, Monitor, ChevronDown,
} from "lucide-react";
import { useLog, type LogEntry, type LogAction, type LogEntityType } from "../contexts/LogsContext";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";

const ACTION_META: Record<LogAction, { label: string; color: string }> = {
  pedido_criado:        { label: "Pedido criado",          color: "bg-blue-100 text-blue-700" },
  pedido_status:        { label: "Status alterado",        color: "bg-purple-100 text-purple-700" },
  pedido_cancelado:     { label: "Pedido cancelado",       color: "bg-red-100 text-red-700" },
  pedido_nota:          { label: "Nota adicionada",        color: "bg-slate-100 text-slate-600" },
  empresa_criada:       { label: "Empresa criada",         color: "bg-emerald-100 text-emerald-700" },
  empresa_atualizada:   { label: "Empresa atualizada",     color: "bg-amber-100 text-amber-700" },
  empresa_ativada:      { label: "Empresa ativada",        color: "bg-emerald-100 text-emerald-700" },
  empresa_desativada:   { label: "Empresa desativada",     color: "bg-red-100 text-red-700" },
  produto_criado:       { label: "Produto criado",         color: "bg-emerald-100 text-emerald-700" },
  produto_atualizado:   { label: "Produto atualizado",     color: "bg-amber-100 text-amber-700" },
  produto_ativado:      { label: "Produto ativado",        color: "bg-emerald-100 text-emerald-700" },
  produto_desativado:   { label: "Produto desativado",     color: "bg-red-100 text-red-700" },
  usuario_criado:       { label: "Usuário criado",         color: "bg-blue-100 text-blue-700" },
  usuario_atualizado:   { label: "Usuário atualizado",     color: "bg-amber-100 text-amber-700" },
  usuario_ativado:      { label: "Usuário ativado",        color: "bg-emerald-100 text-emerald-700" },
  usuario_desativado:   { label: "Usuário desativado",     color: "bg-red-100 text-red-700" },
  senha_alterada:       { label: "Senha alterada",         color: "bg-orange-100 text-orange-700" },
  credenciais_enviadas: { label: "Credenciais enviadas",   color: "bg-teal-100 text-teal-700" },
  login:                { label: "Login",                  color: "bg-slate-100 text-slate-600" },
  logout:               { label: "Logout",                 color: "bg-slate-100 text-slate-600" },
};

const ENTITY_ICON: Record<LogEntityType, typeof ShoppingCart> = {
  Pedido:   ShoppingCart,
  Empresa:  Building2,
  Produto:  Package,
  Usuário:  Users,
  Sistema:  Monitor,
};

const ROLE_LABEL: Record<string, string> = {
  super_admin:  "Super Admin",
  tenant_admin: "Admin",
  operator:     "Operador",
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

const ENTITY_FILTERS: { label: string; value: LogEntityType | "Todos" }[] = [
  { label: "Todos",    value: "Todos" },
  { label: "Pedidos",  value: "Pedido" },
  { label: "Empresas", value: "Empresa" },
  { label: "Produtos", value: "Produto" },
  { label: "Usuários", value: "Usuário" },
  { label: "Sistema",  value: "Sistema" },
];

export function Logs() {
  const { logs } = useLog();
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<LogEntityType | "Todos">("Todos");
  const [showCount, setShowCount] = useState(50);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const matchEntity = entityFilter === "Todos" || l.entityType === entityFilter;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        l.entityName.toLowerCase().includes(q) ||
        l.userName.toLowerCase().includes(q) ||
        l.userEmail.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q) ||
        ACTION_META[l.action].label.toLowerCase().includes(q);
      return matchEntity && matchSearch;
    });
  }, [logs, search, entityFilter]);

  const visible = filtered.slice(0, showCount);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Sistema</p>
          <h1 className="font-display text-2xl font-extrabold">Logs de Auditoria</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro completo de todas as ações realizadas no sistema.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <ClipboardList className="h-4 w-4" />
          <span className="font-semibold text-foreground">{logs.length}</span> registros
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ação, entidade, usuário..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          {ENTITY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setEntityFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                entityFilter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted/60 text-muted-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["Pedido", "Empresa", "Produto", "Usuário"] as LogEntityType[]).map((type) => {
          const count = logs.filter((l) => l.entityType === type).length;
          const Icon = ENTITY_ICON[type];
          return (
            <Card
              key={type}
              className="p-3 bg-gradient-card cursor-pointer hover:-translate-y-0.5 transition-all"
              onClick={() => setEntityFilter(entityFilter === type ? "Todos" : type)}
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-display text-lg font-extrabold leading-none">{count}</div>
                  <div className="text-[10px] text-muted-foreground">{type}s</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Log list */}
      {filtered.length === 0 ? (
        <Card className="p-10 bg-gradient-card text-center">
          <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((log, i) => <LogRow key={log.id} log={log} index={i} />)}

          {filtered.length > showCount && (
            <button
              onClick={() => setShowCount((n) => n + 50)}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
              Ver mais ({filtered.length - showCount} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LogRow({ log, index }: { log: LogEntry; index: number }) {
  const { date, time } = formatTimestamp(log.timestamp);
  const meta = ACTION_META[log.action];
  const Icon = ENTITY_ICON[log.entityType];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
    >
      <Card className="px-4 py-3 bg-gradient-card hover:shadow-sm transition-shadow">
        <div className="flex items-start gap-3">
          {/* Entity icon */}
          <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold", meta.color)}>
                  {meta.label}
                </span>
                <span className="text-sm font-medium truncate">{log.entityName}</span>
              </div>
              {/* Timestamp */}
              <div className="text-right flex-shrink-0">
                <p className="text-[11px] font-semibold text-foreground">{time}</p>
                <p className="text-[10px] text-muted-foreground">{date}</p>
              </div>
            </div>

            {/* Details */}
            {log.details && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{log.details}</p>
            )}

            {/* Actor */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-primary">
                  {log.userName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{log.userName}</span>
                {" · "}
                <span className="font-mono">{log.userEmail}</span>
                {" · "}
                {ROLE_LABEL[log.userRole] ?? log.userRole}
              </span>
              {log.tenantSlug !== "sistemalegado" && (
                <Badge variant="muted" className="text-[10px] font-mono">{log.tenantSlug}</Badge>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
