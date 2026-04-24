import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Calendar, Package, DollarSign, ShoppingCart,
  ChevronDown, FileDown, Filter,
} from "lucide-react";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subDays, isWithinInterval, parseISO, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useOrders } from "../contexts/OrdersContext";
import type { Order, OrderStatus } from "../types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending:    "Pendente",
  started:    "Iniciado",
  production: "Em Produção",
  finishing:  "Acabamento",
  done:       "Finalizado",
  cancelled:  "Cancelado",
};

const STATUS_VARIANT: Record<OrderStatus, string> = {
  pending:    "bg-warning/15 text-warning",
  started:    "bg-primary/15 text-primary",
  production: "bg-accent/15 text-accent",
  finishing:  "bg-indigo-500/15 text-indigo-600",
  done:       "bg-success/15 text-success",
  cancelled:  "bg-destructive/15 text-destructive",
};

type Period = "today" | "week" | "month" | "last30" | "custom";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatQty(n: number) {
  return n.toLocaleString("pt-BR");
}

function getPeriodRange(period: Period, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date();
  if (period === "today")  return { from: startOfDay(now), to: endOfDay(now) };
  if (period === "week")   return { from: startOfWeek(now, { locale: ptBR }), to: endOfWeek(now, { locale: ptBR }) };
  if (period === "month")  return { from: startOfMonth(now), to: endOfMonth(now) };
  if (period === "last30") return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
  // custom
  const from = customFrom ? startOfDay(parseISO(customFrom)) : startOfDay(subDays(now, 30));
  const to   = customTo   ? endOfDay(parseISO(customTo))     : endOfDay(now);
  return { from, to };
}

export function Reports() {
  const { user } = useAuth();
  const { products, companies } = useData();
  const { orders } = useOrders();

  const isSuperAdmin = user?.role === "super_admin";

  const [period, setPeriod]         = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter]   = useState("active"); // active | done | all

  const { from, to } = getPeriodRange(period, customFrom, customTo);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const date = parseISO(o.createdAt);
      if (!isWithinInterval(date, { start: from, end: to })) return false;
      if (companyFilter !== "all" && o.tenantSlug !== companyFilter) return false;
      if (!isSuperAdmin && o.tenantSlug !== user?.tenantSlug) return false;
      if (statusFilter === "active" && o.status === "cancelled") return false;
      if (statusFilter === "done"   && o.status !== "done") return false;
      return true;
    });
  }, [orders, from, to, companyFilter, statusFilter, isSuperAdmin, user]);

  // Product summary
  const productSummary = useMemo(() => {
    const map: Record<string, { productId: string; name: string; code: string; category: string; unitPrice: number; totalQty: number; orderCount: number; subtotal: number }> = {};
    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        const unitPrice = product?.price ?? 0;
        if (!map[item.productId]) {
          map[item.productId] = {
            productId: item.productId,
            name: item.productName,
            code: product?.code ?? "—",
            category: product?.category ?? "—",
            unitPrice,
            totalQty: 0,
            orderCount: 0,
            subtotal: 0,
          };
        }
        map[item.productId].totalQty   += item.quantity;
        map[item.productId].orderCount += 1;
        map[item.productId].subtotal   += item.quantity * unitPrice;
      });
    });
    return Object.values(map).sort((a, b) => b.subtotal - a.subtotal);
  }, [filteredOrders, products]);

  const totalPieces  = productSummary.reduce((s, r) => s + r.totalQty, 0);
  const totalRevenue = productSummary.reduce((s, r) => s + r.subtotal, 0);
  const totalProducts = productSummary.length;

  const PERIOD_LABELS: Record<Period, string> = {
    today:  "Hoje",
    week:   "Esta semana",
    month:  "Este mês",
    last30: "Últimos 30 dias",
    custom: "Personalizado",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Gestão</p>
          <h1 className="font-display text-2xl font-extrabold">Relatórios de Produção</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fechamento de materiais produzidos por período.
          </p>
        </div>
        <Button variant="outline" className="gap-2 self-start sm:self-auto" onClick={() => window.print()}>
          <FileDown className="h-4 w-4" />
          Exportar / Imprimir
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Filtros</span>
        </div>

        {/* Period presets */}
        <div className="flex flex-wrap gap-2">
          {(["today", "week", "month", "last30", "custom"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                period === p
                  ? "bg-primary text-white border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {period === "custom" && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Company filter — super admin only */}
          {isSuperAdmin && (
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Empresa</Label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status filter */}
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Status dos pedidos</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Todos (exceto cancelados)</SelectItem>
                <SelectItem value="done">Apenas finalizados</SelectItem>
                <SelectItem value="all">Incluir cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active period label */}
        <p className="text-[11px] text-muted-foreground">
          Exibindo pedidos de{" "}
          <strong>{format(from, "dd/MM/yyyy", { locale: ptBR })}</strong>
          {" "}até{" "}
          <strong>{format(to, "dd/MM/yyyy", { locale: ptBR })}</strong>
        </p>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Pedidos",       value: filteredOrders.length,       icon: ShoppingCart, color: "text-primary bg-primary/10",   fmt: String },
          { label: "Produtos",      value: totalProducts,               icon: Package,      color: "text-accent bg-accent/10",     fmt: String },
          { label: "Total de peças",value: totalPieces,                 icon: BarChart3,    color: "text-success bg-success/10",   fmt: formatQty },
          { label: "Valor total",   value: totalRevenue,                icon: DollarSign,   color: "text-warning bg-warning/10",   fmt: formatBRL },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="p-4 bg-gradient-card">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="font-display text-xl font-extrabold leading-tight">{s.fmt(s.value as any)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Product breakdown table */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Produção por produto
        </h2>

        {productSummary.length === 0 ? (
          <Card className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <BarChart3 className="h-10 w-10 opacity-20" />
            <p className="text-sm">Nenhum pedido encontrado no período.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Código</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Categoria</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pedidos</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Peças</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Preço unit.</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {productSummary.map((row, i) => (
                    <motion.tr
                      key={row.productId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">{row.code}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="muted" className="text-[10px]">{row.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{row.orderCount}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatQty(row.totalQty)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                        {row.unitPrice > 0 ? formatBRL(row.unitPrice) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        {row.unitPrice > 0 ? formatBRL(row.subtotal) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 font-semibold">
                    <td className="px-4 py-3" colSpan={2}>Total</td>
                    <td className="hidden md:table-cell" />
                    <td className="px-4 py-3 text-right">{filteredOrders.length}</td>
                    <td className="px-4 py-3 text-right">{formatQty(totalPieces)}</td>
                    <td className="hidden sm:table-cell" />
                    <td className="px-4 py-3 text-right text-primary font-extrabold">{formatBRL(totalRevenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Order list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          Pedidos do período
        </h2>

        {filteredOrders.length === 0 ? (
          <Card className="p-8 flex flex-col items-center gap-2 text-muted-foreground">
            <ShoppingCart className="h-8 w-8 opacity-20" />
            <p className="text-sm">Nenhum pedido no período selecionado.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Título</th>
                    {isSuperAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Empresa</th>}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Data</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Peças</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Valor</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, i) => {
                    const pieces = order.items.reduce((s, item) => s + item.quantity, 0);
                    const value  = order.items.reduce((s, item) => {
                      const p = products.find((x) => x.id === item.productId);
                      return s + item.quantity * (p?.price ?? 0);
                    }, 0);
                    return (
                      <motion.tr
                        key={order.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{order.id}</td>
                        <td className="px-4 py-3 font-medium max-w-[180px] truncate">{order.title}</td>
                        {isSuperAdmin && (
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{order.tenantName}</td>
                        )}
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-xs">
                          {format(parseISO(order.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{formatQty(pieces)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                          {value > 0 ? formatBRL(value) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_VARIANT[order.status]}`}>
                            {STATUS_LABEL[order.status]}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
