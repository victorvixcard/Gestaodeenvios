import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Package, DollarSign, ShoppingCart,
  FileDown, Filter, ChevronDown, ChevronRight as ChevronRightIcon, FileText,
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
import { cn } from "../lib/utils";

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

function getPeriodRange(period: Period, customFrom: string, customTo: string) {
  const now = new Date();
  if (period === "today")  return { from: startOfDay(now),            to: endOfDay(now) };
  if (period === "week")   return { from: startOfWeek(now, { locale: ptBR }), to: endOfWeek(now, { locale: ptBR }) };
  if (period === "month")  return { from: startOfMonth(now),           to: endOfMonth(now) };
  if (period === "last30") return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
  const from = customFrom ? startOfDay(parseISO(customFrom)) : startOfDay(subDays(now, 30));
  const to   = customTo   ? endOfDay(parseISO(customTo))     : endOfDay(now);
  return { from, to };
}

// ── CSV export ────────────────────────────────────────────────────────────────
function downloadCSV(
  filteredOrders: Order[],
  products: ReturnType<typeof useData>["products"],
  isSuperAdmin: boolean
) {
  const header = [
    "OS", "Título", ...(isSuperAdmin ? ["Empresa"] : []), "Data",
    "Produto", "Código", "Qtd", "Preço Unit.", "Subtotal (R$)", "Status",
  ];

  const rows: string[][] = [];
  filteredOrders.forEach((order) => {
    const date = format(parseISO(order.createdAt), "dd/MM/yyyy", { locale: ptBR });
    order.items.forEach((item) => {
      const product  = products.find((p) => p.id === item.productId);
      const unitPrice = product?.price ?? 0;
      const subtotal  = item.quantity * unitPrice;
      rows.push([
        order.id,
        order.title,
        ...(isSuperAdmin ? [order.tenantName] : []),
        date,
        item.productName,
        product?.code ?? "—",
        String(item.quantity),
        unitPrice.toFixed(2).replace(".", ","),
        subtotal.toFixed(2).replace(".", ","),
        STATUS_LABEL[order.status],
      ]);
    });
  });

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(escape).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `consumo_${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Expandable order row ──────────────────────────────────────────────────────
function OrderConsumptionRow({
  order,
  products,
  isSuperAdmin,
  index,
}: {
  order: Order;
  products: ReturnType<typeof useData>["products"];
  isSuperAdmin: boolean;
  index: number;
}) {
  const [expanded, setExpanded] = useState(true);

  const orderTotal = order.items.reduce((sum, item) => {
    const p = products.find((x) => x.id === item.productId);
    return sum + item.quantity * (p?.price ?? 0);
  }, 0);
  const orderPieces = order.items.reduce((s, i) => s + i.quantity, 0);
  const date = format(parseISO(order.createdAt), "dd/MM/yyyy", { locale: ptBR });

  return (
    <motion.tbody
      key={order.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      {/* ── Order header row ── */}
      <tr
        className="bg-muted/50 border-t-2 border-primary/10 cursor-pointer select-none hover:bg-muted/70 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-2.5" colSpan={isSuperAdmin ? 7 : 6}>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Expand icon */}
            <span className="text-muted-foreground/60">
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
            </span>

            {/* OS number */}
            <span className="font-mono text-xs font-bold text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded">
              OS {order.id}
            </span>

            {/* Title */}
            <span className="text-sm font-semibold text-foreground truncate max-w-[180px]">{order.title}</span>

            {/* Company (super admin) */}
            {isSuperAdmin && (
              <Badge variant="outline" className="text-[10px] font-normal">{order.tenantName}</Badge>
            )}

            {/* Date */}
            <span className="text-xs text-muted-foreground">{date}</span>

            {/* Status */}
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold",
              STATUS_VARIANT[order.status]
            )}>
              {STATUS_LABEL[order.status]}
            </span>

            {/* Summary */}
            <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
              {order.items.length} {order.items.length === 1 ? "item" : "itens"} · {formatQty(orderPieces)} peças
              {orderTotal > 0 && <> · <strong className="text-foreground">{formatBRL(orderTotal)}</strong></>}
            </span>
          </div>
        </td>
      </tr>

      {/* ── Item sub-rows ── */}
      {expanded && order.items.map((item, idx) => {
        const product   = products.find((p) => p.id === item.productId);
        const unitPrice = product?.price ?? 0;
        const subtotal  = item.quantity * unitPrice;

        return (
          <tr
            key={idx}
            className="border-b border-border/40 hover:bg-muted/20 transition-colors"
          >
            {/* Indent + product name */}
            <td className="pl-10 pr-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/40 text-xs">↳</span>
                <span className="text-sm font-medium">{item.productName}</span>
              </div>
              {item.specifications && (
                <p className="text-[11px] text-muted-foreground/60 pl-4 mt-0.5 truncate max-w-[200px]">
                  {item.specifications}
                </p>
              )}
            </td>

            {/* Code */}
            <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground hidden sm:table-cell">
              {product?.code ?? "—"}
            </td>

            {/* Category */}
            <td className="px-4 py-2.5 hidden md:table-cell">
              {product?.category ? (
                <Badge variant="muted" className="text-[10px]">{product.category}</Badge>
              ) : "—"}
            </td>

            {/* Quantity */}
            <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
              {formatQty(item.quantity)}
            </td>

            {/* Unit price */}
            <td className="px-4 py-2.5 text-right text-muted-foreground text-xs hidden sm:table-cell tabular-nums">
              {unitPrice > 0 ? formatBRL(unitPrice) : <span className="opacity-40">—</span>}
            </td>

            {/* Subtotal */}
            <td className="px-4 py-2.5 text-right font-bold tabular-nums">
              {subtotal > 0 ? formatBRL(subtotal) : <span className="opacity-40">—</span>}
            </td>

            {/* Empty status col for alignment */}
            {isSuperAdmin && <td />}
          </tr>
        );
      })}
    </motion.tbody>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function Reports() {
  const { user } = useAuth();
  const { products, companies } = useData();
  const { orders } = useOrders();

  const isSuperAdmin = user?.role === "super_admin";

  const [period, setPeriod]         = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter]   = useState("active");

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

  // Aggregate by product for the summary table
  const productSummary = useMemo(() => {
    const map: Record<string, {
      productId: string; name: string; code: string; category: string;
      unitPrice: number; totalQty: number; orderCount: number; subtotal: number;
    }> = {};
    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const product   = products.find((p) => p.id === item.productId);
        const unitPrice = product?.price ?? 0;
        if (!map[item.productId]) {
          map[item.productId] = {
            productId: item.productId, name: item.productName,
            code: product?.code ?? "—", category: product?.category ?? "—",
            unitPrice, totalQty: 0, orderCount: 0, subtotal: 0,
          };
        }
        map[item.productId].totalQty   += item.quantity;
        map[item.productId].orderCount += 1;
        map[item.productId].subtotal   += item.quantity * unitPrice;
      });
    });
    return Object.values(map).sort((a, b) => b.subtotal - a.subtotal);
  }, [filteredOrders, products]);

  const totalPieces   = productSummary.reduce((s, r) => s + r.totalQty, 0);
  const totalRevenue  = productSummary.reduce((s, r) => s + r.subtotal, 0);
  const totalProducts = productSummary.length;

  const PERIOD_LABELS: Record<Period, string> = {
    today: "Hoje", week: "Esta semana", month: "Este mês",
    last30: "Últimos 30 dias", custom: "Personalizado",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Gestão</p>
          <h1 className="font-display text-2xl font-extrabold">Relatórios de Consumo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle do que cada cliente consumiu por produto e período.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => downloadCSV(filteredOrders, products, isSuperAdmin)}
            disabled={filteredOrders.length === 0}
          >
            <FileText className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <FileDown className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Filtros</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["today", "week", "month", "last30", "custom"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                period === p ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

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
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Considerar pedidos</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Todos (exceto cancelados)</SelectItem>
                <SelectItem value="done">Apenas finalizados/entregues</SelectItem>
                <SelectItem value="all">Incluir cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

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
          { label: "Pedidos",        value: filteredOrders.length, icon: ShoppingCart, color: "text-primary bg-primary/10",   fmt: String },
          { label: "Produtos únicos",value: totalProducts,         icon: Package,      color: "text-accent bg-accent/10",     fmt: String },
          { label: "Total de peças", value: totalPieces,           icon: BarChart3,    color: "text-success bg-success/10",   fmt: formatQty },
          { label: "Valor total",    value: totalRevenue,          icon: DollarSign,   color: "text-warning bg-warning/10",   fmt: formatBRL },
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

      {/* ── 1. Resumo por produto ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Resumo por produto
          <span className="text-xs text-muted-foreground font-normal">— total consumido no período</span>
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
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">OS</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total peças</th>
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
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatQty(row.totalQty)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell tabular-nums">
                        {row.unitPrice > 0 ? formatBRL(row.unitPrice) : <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        {row.unitPrice > 0 ? formatBRL(row.subtotal) : <span className="opacity-40">—</span>}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 font-semibold border-t-2 border-border">
                    <td className="px-4 py-3 font-bold" colSpan={2}>Total geral</td>
                    <td className="hidden md:table-cell" />
                    <td className="px-4 py-3 text-right">{filteredOrders.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatQty(totalPieces)}</td>
                    <td className="hidden sm:table-cell" />
                    <td className="px-4 py-3 text-right text-primary font-extrabold tabular-nums">{formatBRL(totalRevenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* ── 2. Consumo detalhado por OS ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          Consumo detalhado por OS
          <span className="text-xs text-muted-foreground font-normal">— clique no cabeçalho para expandir/recolher</span>
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produto / OS</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Código</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Categoria</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qtd</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Preço unit.</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subtotal</th>
                    {isSuperAdmin && <th />}
                  </tr>
                </thead>

                {filteredOrders.map((order, i) => (
                  <OrderConsumptionRow
                    key={order.id}
                    order={order}
                    products={products}
                    isSuperAdmin={isSuperAdmin}
                    index={i}
                  />
                ))}
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
