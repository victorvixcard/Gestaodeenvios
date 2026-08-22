import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus, Search, ChevronRight, List, GitBranch,
  XCircle, Calendar, User, Package,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { useOrders } from "../contexts/OrdersContext";
import { useData } from "../contexts/DataContext";
import { StatusBadge } from "../components/shared/StatusBadge";
import { StatusFilterChips, type StatusFilterValue } from "../components/shared/StatusFilterChips";
import {
  CollaboratorsPanel, tenantPassaNoFiltro, empresasDoUsuario, type SelecaoColab,
} from "../components/shared/CollaboratorsPanel";
import { ItemDeadlineBadge, OrderDeadlineSummary } from "../components/shared/ItemDeadlineBadge";
import { orderIsOverdue } from "../lib/itemDeadline";
import { orderTimeline, stepState, STATUS_ICON } from "../lib/timeline";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { formatDateShort } from "../lib/utils";
import { cn } from "../lib/utils";
import type { Order } from "../types";

function OrderProgressBar({ order }: { order: Order }) {
  const isCancelled = order.status === "cancelled";
  // Fluxo do PROPRIO pedido, congelado na criacao — pedidos de empresas
  // com linha do tempo personalizada mostram as etapas delas
  const steps = orderTimeline(order);

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 py-1">
        <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
        <span className="text-xs font-semibold text-destructive">Ordem Cancelada</span>
        {order.cancelReason && (
          <span className="text-xs text-muted-foreground truncate">— {order.cancelReason}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((stage, i) => {
        const estado = stepState(stage, order.status);
        const isCompleted = estado === "done";
        const isCurrent = estado === "current";
        const isPending = estado === "pending";
        const Icon = STATUS_ICON[stage.status];

        return (
          <div key={stage.status} className="flex items-center flex-1 min-w-0">
            {/* Stage node */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "bg-primary/10 border-primary text-primary ring-2 ring-primary/20",
                  isPending && "bg-muted/50 border-border text-muted-foreground/40"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isCurrent && "animate-pulse")} />
              </div>
              <span
                className={cn(
                  "text-[9px] font-semibold text-center leading-tight",
                  isCompleted && "text-primary",
                  isCurrent && "text-primary",
                  isPending && "text-muted-foreground/40"
                )}
              >
                {stage.label}
              </span>
            </div>

            {/* Connector line (not after last) */}
            {i < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-1 rounded-full transition-all"
                style={{ background: isCompleted ? "hsl(var(--primary))" : "hsl(var(--border))" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimelineCard({ order, index, tenantSlug, isSuperAdmin }: {
  order: Order; index: number; tenantSlug: string; isSuperAdmin: boolean
}) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={cn(
          "p-4 cursor-pointer hover:-translate-y-0.5 transition-all duration-200 bg-gradient-card",
          orderIsOverdue(order.items, order.status)
            ? "border-red-400 border-2 hover:shadow-red-200 hover:shadow-md"
            : "hover:shadow-brand"
        )}
        onClick={() => navigate(`/${tenantSlug}/pedidos/${order.id}`)}
      >
        {/* Top row — OS number + badges + date */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded">
              OS {order.id}
            </span>
            {isSuperAdmin && (
              <Badge variant="outline" className="text-[11px]">{order.tenantName}</Badge>
            )}
            <StatusBadge status={order.status} size="sm" />
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground flex-shrink-0">
            <Calendar className="h-3 w-3" />
            {formatDateShort(order.createdAt)}
          </div>
        </div>

        {/* Title */}
        <p className="font-semibold text-sm text-foreground mb-3 truncate">{order.title}</p>

        {/* Timeline */}
        <OrderProgressBar order={order} />

        {/* Bottom info */}
        <div className="flex items-start gap-4 mt-3 pt-3 border-t border-border/50 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1 flex-shrink-0">
            <User className="h-3 w-3" />
            {order.requestedBy}
          </span>

          {/* Cada item carrega o próprio prazo — a cor do badge é o alerta */}
          <span className="flex items-start gap-1.5 flex-wrap flex-1 min-w-0">
            <span className="flex items-center gap-1 flex-shrink-0">
              <Package className="h-3 w-3" />
              <span className="font-medium">{order.items.length} {order.items.length === 1 ? "item" : "itens"}</span>
            </span>
            <span className="flex items-center gap-1.5 flex-wrap">
              {order.items.slice(0, 3).map((item, idx) => (
                <ItemDeadlineBadge key={idx} item={item} orderStatus={order.status} />
              ))}
              {order.items.length > 3 && (
                <span className="text-muted-foreground/60 text-[10px]">+{order.items.length - 3} mais</span>
              )}
            </span>
          </span>

          <div className="ml-auto flex-shrink-0">
            <OrderDeadlineSummary items={order.items} orderStatus={order.status} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function Orders() {
  const { user } = useAuth();
  const tenant = useTenant();
  const { orders } = useOrders();
  const { companies, users } = useData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? "all");
  // Lista é o padrão: mostra mais OS por tela. A linha do tempo segue
  // disponível no botão ao lado.
  const [view, setView] = useState<"list" | "timeline">("list");
  // Filtro do painel de colaboradores (só para admins da VIXCard)
  const [colab, setColab] = useState<SelecaoColab>(null);

  const isSuperAdmin = user?.role === "super_admin";
  const mostraPainel = isSuperAdmin && user?.tenantSlug === "vixcard";

  const tenantOrders = isSuperAdmin ? orders : orders.filter((o) => o.tenantSlug === tenant.slug);

  // O painel de colaboradores corta antes dos chips, para as contagens
  // refletirem o que está em tela
  const doColab = tenantOrders.filter((o) =>
    tenantPassaNoFiltro(colab, o.tenantSlug, companies, users)
  );

  const overdueCount = doColab.filter((o) => orderIsOverdue(o.items, o.status)).length;

  // Contagem por status para os chips do filtro (ignora a busca de texto,
  // para os números não pularem enquanto o usuário digita)
  const statusCounts: Partial<Record<StatusFilterValue, number>> = { all: doColab.length, overdue: overdueCount };
  doColab.forEach((o) => { statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1; });

  const filtered = doColab.filter((o) => {
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "overdue" ? orderIsOverdue(o.items, o.status) : o.status === statusFilter);
    const matchSearch =
      !search ||
      o.title.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.requestedBy.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Badge de quantidade ao lado de cada nome no painel
  const contadorOs = (userId: string) => {
    const slugs = empresasDoUsuario(companies, userId);
    return tenantOrders.filter((o) => slugs.has(o.tenantSlug)).length;
  };

  return (
    <div className="flex gap-4 items-start">
      {mostraPainel && (
        <CollaboratorsPanel selecao={colab} onChange={setColab} contadorOs={contadorOs} />
      )}
      <div className="space-y-5 flex-1 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Gestão</p>
          <h1 className="font-display text-2xl font-extrabold">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} ordem{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                view === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </button>
            <button
              onClick={() => setView("timeline")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                view === "timeline"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GitBranch className="h-3.5 w-3.5" />
              Linha do Tempo
            </button>
          </div>
          <Button variant="brand" onClick={() => navigate(`/${tenant.slug}/pedidos/novo`)}>
            <Plus className="h-4 w-4" />
            Nova OS
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, número da OS ou solicitante..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <StatusFilterChips value={statusFilter} onChange={setStatusFilter} counts={statusCounts} />
      </div>

      {/* List view */}
      {view === "list" && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground text-sm">Nenhuma ordem de serviço encontrada.</p>
            </Card>
          )}
          {filtered.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card
                className={cn(
                  "p-4 cursor-pointer hover:-translate-y-0.5 transition-all duration-200 bg-gradient-card",
                  orderIsOverdue(order.items, order.status)
                    ? "border-red-400 border-2 hover:shadow-red-200 hover:shadow-md"
                    : "hover:shadow-brand"
                )}
                onClick={() => navigate(`/${tenant.slug}/pedidos/${order.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        OS {order.id}
                      </span>
                      {isSuperAdmin && (
                        <Badge variant="outline" className="text-[11px]">{order.tenantName}</Badge>
                      )}
                    </div>
                    <p className="font-semibold text-sm text-foreground truncate">{order.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      {/* Item count + compact product list */}
                      <span className="flex items-center gap-1 flex-wrap">
                        <span className="font-medium text-foreground/70">
                          {order.items.length} {order.items.length === 1 ? "item" : "itens"}
                        </span>
                        {order.items.length === 1 ? (
                          <span className="text-muted-foreground/60">
                            · {order.items[0].productName} × {order.items[0].quantity.toLocaleString("pt-BR")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 truncate max-w-[220px]">
                            · {order.items.slice(0, 3).map(i => i.productName).join(", ")}
                            {order.items.length > 3 && ` +${order.items.length - 3}`}
                          </span>
                        )}
                      </span>
                      <span>·</span>
                      <span>Por {order.requestedBy}</span>
                      <span>·</span>
                      <span>{formatDateShort(order.updatedAt)}</span>
                    </div>
                    <div className="mt-2">
                      <OrderDeadlineSummary items={order.items} orderStatus={order.status} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={order.status} size="sm" />
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Timeline view */}
      {view === "timeline" && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground text-sm">Nenhuma ordem de serviço encontrada.</p>
            </Card>
          )}
          {filtered.map((order, i) => (
            <TimelineCard
              key={order.id}
              order={order}
              index={i}
              tenantSlug={tenant.slug}
              isSuperAdmin={isSuperAdmin}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
