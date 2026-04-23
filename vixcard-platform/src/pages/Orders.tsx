import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, Filter, ChevronRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { useOrders } from "../contexts/OrdersContext";
import { StatusBadge } from "../components/shared/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { formatDateShort } from "../lib/utils";
import type { OrderStatus } from "../types";

const STATUS_LABELS: Record<OrderStatus | "all", string> = {
  all: "Todos",
  pending: "Pendente",
  started: "Iniciado",
  production: "Em Produção",
  finishing: "Acabamento",
  done: "Finalizado",
  cancelled: "Cancelado",
};

export function Orders() {
  const { user } = useAuth();
  const tenant = useTenant();
  const { orders } = useOrders();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") ?? "all"
  );

  const tenantOrders = user?.role === "super_admin"
    ? orders
    : orders.filter((o) => o.tenantSlug === tenant.slug);

  const filtered = tenantOrders.filter((o) => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchSearch =
      !search ||
      o.title.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.requestedBy.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Gestão</p>
          <h1 className="font-display text-2xl font-extrabold">Pedidos</h1>
        </div>
        <Button variant="brand" onClick={() => navigate(`/${tenant.slug}/pedidos/novo`)}>
          <Plus className="h-4 w-4" />
          Novo Pedido
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, ID ou solicitante..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABELS) as (OrderStatus | "all")[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results info */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} pedido{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground text-sm">Nenhum pedido encontrado.</p>
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
              className="p-4 cursor-pointer hover:shadow-brand hover:-translate-y-0.5 transition-all duration-200 bg-gradient-card"
              onClick={() => navigate(`/${tenant.slug}/pedidos/${order.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {order.id}
                    </span>
                    {user?.role === "super_admin" && (
                      <Badge variant="outline" className="text-[11px]">{order.tenantName}</Badge>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-foreground truncate">{order.title}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>{order.items.length} item{order.items.length > 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>Por {order.requestedBy}</span>
                    <span>·</span>
                    <span>{formatDateShort(order.updatedAt)}</span>
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
    </div>
  );
}
