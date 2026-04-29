import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  ShoppingCart, Clock, CheckCircle2, XCircle, TrendingUp, Zap,
  Siren, AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { useOrders } from "../contexts/OrdersContext";
import { useData } from "../contexts/DataContext";
import { KPICard } from "../components/shared/KPICard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { DeadlineChip, isOverdue } from "../components/shared/DeadlineChip";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { formatDateShort } from "../lib/utils";
import { getOrderDeadline, getDeadlineStatus } from "../lib/holidays";
import type { Order } from "../types";

const STATUS_COLOR: Record<string, string> = {
  pending:    "hsl(var(--warning))",
  started:    "hsl(var(--primary))",
  production: "hsl(var(--accent))",
  finishing:  "hsl(238 70% 60%)",
  done:       "hsl(var(--success))",
  cancelled:  "hsl(var(--destructive))",
};

const STATUS_LABEL: Record<string, string> = {
  pending:    "Pendente",
  started:    "Iniciado",
  production: "Em Produção",
  finishing:  "Acabamento",
  done:       "Finalizado",
  cancelled:  "Cancelado",
};

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function buildAreaData(orders: Order[]) {
  const now = new Date();
  const months: { mes: string; pedidos: number; key: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    months.push({ mes: MONTH_SHORT[d.getMonth()], pedidos: 0, key });
  }
  orders.forEach((o) => {
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const slot = months.find((m) => m.key === key);
    if (slot) slot.pedidos += 1;
  });
  return months;
}

function buildStatusPie(orders: Order[]) {
  const counts: Record<string, number> = {};
  orders.forEach((o) => { counts[o.status] = (counts[o.status] ?? 0) + 1; });
  return Object.entries(counts).map(([status, value]) => ({
    name: STATUS_LABEL[status] ?? status,
    status,
    value,
    color: STATUS_COLOR[status] ?? "hsl(var(--muted-foreground))",
  })).sort((a, b) => b.value - a.value);
}

function buildCategoryBars(orders: Order[], productCategoryById: Record<string, string>) {
  const counts: Record<string, number> = {};
  orders.forEach((o) => {
    o.items.forEach((it) => {
      const cat = productCategoryById[it.productId] ?? "Outros";
      counts[cat] = (counts[cat] ?? 0) + 1;
    });
  });
  return Object.entries(counts)
    .map(([tipo, qtd]) => ({ tipo, qtd }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 6);
}

export function Dashboard() {
  const { user } = useAuth();
  const tenant = useTenant();
  const { orders } = useOrders();
  const { products } = useData();
  const navigate = useNavigate();

  const isSuperAdmin = user?.role === "super_admin";
  const tenantOrders = isSuperAdmin
    ? orders
    : orders.filter((o) => o.tenantSlug === tenant.slug);

  const productCategoryById = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach((p) => { map[p.id] = p.category; });
    return map;
  }, [products]);

  const areaData     = useMemo(() => buildAreaData(tenantOrders), [tenantOrders]);
  const statusPie    = useMemo(() => buildStatusPie(tenantOrders), [tenantOrders]);
  const categoryBars = useMemo(() => buildCategoryBars(tenantOrders, productCategoryById), [tenantOrders, productCategoryById]);

  // KPIs
  const pending    = tenantOrders.filter((o) => o.status === "pending").length;
  const inProgress = tenantOrders.filter((o) => ["started", "production", "finishing"].includes(o.status)).length;
  const done       = tenantOrders.filter((o) => o.status === "done").length;
  const cancelled  = tenantOrders.filter((o) => o.status === "cancelled").length;
  const total      = tenantOrders.length;

  // Trend: pedidos do mês atual vs mês anterior
  const monthTrend = (() => {
    const cur  = areaData[areaData.length - 1]?.pedidos ?? 0;
    const prev = areaData[areaData.length - 2]?.pedidos ?? 0;
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  })();

  // Done trend: finalizados nos últimos 30 dias vs 30-60 dias atrás
  const doneTrend = (() => {
    const now = Date.now();
    const elapsed = (iso: string) => now - new Date(iso).getTime();
    const last30 = tenantOrders.filter((o) => o.status === "done" && elapsed(o.updatedAt) <= 30 * 86400000).length;
    const prev30 = tenantOrders.filter((o) => {
      if (o.status !== "done") return false;
      const e = elapsed(o.updatedAt);
      return e > 30 * 86400000 && e <= 60 * 86400000;
    }).length;
    if (prev30 === 0) return last30 > 0 ? 100 : 0;
    return Math.round(((last30 - prev30) / prev30) * 100);
  })();

  // Alertas de prazo: overdue + danger (vence hoje)
  const overdueOrders = useMemo(() => {
    return tenantOrders.filter((o) => isOverdue(o.createdAt, o.status, o.deadline))
      .sort((a, b) => {
        const da = new Date(a.deadline ?? getOrderDeadline(a.createdAt)).getTime();
        const db = new Date(b.deadline ?? getOrderDeadline(b.createdAt)).getTime();
        return da - db;
      });
  }, [tenantOrders]);

  const dueTodayOrders = useMemo(() => {
    return tenantOrders.filter((o) => {
      const dl = o.deadline ? new Date(o.deadline) : getOrderDeadline(o.createdAt);
      return getDeadlineStatus(dl, o.status) === "danger";
    });
  }, [tenantOrders]);

  const recent = [...tenantOrders]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">
            Visão Geral
          </p>
          <h1 className="font-display text-2xl lg:text-3xl font-extrabold">
            Olá, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tenant.name} · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button
          variant="brand"
          onClick={() => navigate(`/${tenant.slug}/pedidos/novo`)}
          className="sm:self-start"
        >
          <Zap className="h-4 w-4" />
          Novo Pedido
        </Button>
      </motion.div>

      {/* Alerta de prazos */}
      {(overdueOrders.length > 0 || dueTodayOrders.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid sm:grid-cols-2 gap-3"
        >
          {overdueOrders.length > 0 && (
            <Card className="p-4 border-2 border-red-300 bg-red-50/60">
              <div className="flex items-start gap-3">
                <Siren className="h-5 w-5 text-red-600 flex-shrink-0 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-red-700 text-sm">
                    {overdueOrders.length} pedido{overdueOrders.length > 1 ? "s" : ""} em atraso
                  </p>
                  <div className="space-y-1 mt-2">
                    {overdueOrders.slice(0, 3).map((o) => (
                      <button
                        key={o.id}
                        onClick={() => navigate(`/${tenant.slug}/pedidos/${o.id}`)}
                        className="block text-left text-xs text-red-700 hover:underline truncate w-full"
                      >
                        <span className="font-mono font-semibold">{o.id}</span> — {o.title}
                      </button>
                    ))}
                    {overdueOrders.length > 3 && (
                      <button
                        onClick={() => navigate(`/${tenant.slug}/pedidos`)}
                        className="text-[11px] text-red-600 underline"
                      >
                        + ver todos
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
          {dueTodayOrders.length > 0 && (
            <Card className="p-4 border-2 border-amber-300 bg-amber-50/60">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-amber-800 text-sm">
                    {dueTodayOrders.length} pedido{dueTodayOrders.length > 1 ? "s" : ""} vence{dueTodayOrders.length === 1 ? "" : "m"} hoje
                  </p>
                  <div className="space-y-1 mt-2">
                    {dueTodayOrders.slice(0, 3).map((o) => (
                      <button
                        key={o.id}
                        onClick={() => navigate(`/${tenant.slug}/pedidos/${o.id}`)}
                        className="block text-left text-xs text-amber-800 hover:underline truncate w-full"
                      >
                        <span className="font-mono font-semibold">{o.id}</span> — {o.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </motion.div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total de Pedidos" value={total} icon={ShoppingCart} color="primary" trend={monthTrend} trendLabel="vs mês anterior" delay={0} />
        <KPICard label="Em Andamento" value={inProgress} icon={TrendingUp} color="accent" delay={0.05} />
        <KPICard label="Pendentes" value={pending} icon={Clock} color="warning" delay={0.1} />
        <KPICard label="Finalizados" value={done} icon={CheckCircle2} color="success" trend={doneTrend} delay={0.15} />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Area chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Pedidos por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPedidos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", boxShadow: "var(--shadow-brand)" }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, fontSize: 12 }}
                  itemStyle={{ color: "hsl(var(--primary))", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="pedidos" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#colorPedidos)" dot={{ fill: "hsl(var(--primary))", r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {statusPie.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Sem pedidos.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={statusPie} innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                      {statusPie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-1.5 mt-2">
                  {statusPie.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => navigate(`/${tenant.slug}/pedidos?status=${s.status}`)}
                      className="w-full flex items-center justify-between text-xs hover:bg-muted/30 rounded px-1.5 py-0.5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                        <span className="text-muted-foreground">{s.name}</span>
                      </div>
                      <span className="font-semibold">{s.value}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bar chart + recent orders */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Pedidos por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBars.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={categoryBars} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="tipo" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                  />
                  <Bar dataKey="qtd" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Pedidos Recentes</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/${tenant.slug}/pedidos`)}>
                Ver todos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recent.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
              )}
              {recent.map((order) => (
                <motion.div
                  key={order.id}
                  whileHover={{ backgroundColor: "hsl(var(--muted) / 0.4)" }}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors"
                  onClick={() => navigate(`/${tenant.slug}/pedidos/${order.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{order.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="font-mono">{order.id}</span>
                      <span>·</span>
                      <span>{formatDateShort(order.updatedAt)}</span>
                      {isSuperAdmin && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight">
                          {order.tenantName}
                        </Badge>
                      )}
                    </p>
                  </div>
                  <div className="hidden sm:flex flex-shrink-0">
                    <DeadlineChip
                      createdAt={order.createdAt}
                      orderStatus={order.status}
                      deadline={order.deadline}
                      showDays={false}
                    />
                  </div>
                  <StatusBadge status={order.status} size="sm" />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancelled alert */}
      {cancelled > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/5"
        >
          <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {cancelled} pedido{cancelled > 1 ? "s" : ""} cancelado{cancelled > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">Verifique os motivos e reabra se necessário.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/${tenant.slug}/pedidos?status=cancelled`)}>
            Ver
          </Button>
        </motion.div>
      )}
    </div>
  );
}
