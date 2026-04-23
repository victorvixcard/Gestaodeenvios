import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { ShoppingCart, Clock, CheckCircle2, XCircle, TrendingUp, Zap } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { useOrders } from "../contexts/OrdersContext";
import { KPICard } from "../components/shared/KPICard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { formatDateShort } from "../lib/utils";
import { useNavigate } from "react-router-dom";

const AREA_DATA = [
  { mes: "Out", pedidos: 12 }, { mes: "Nov", pedidos: 18 }, { mes: "Dez", pedidos: 15 },
  { mes: "Jan", pedidos: 22 }, { mes: "Fev", pedidos: 28 }, { mes: "Mar", pedidos: 35 },
  { mes: "Abr", pedidos: 30 },
];

const STATUS_PIE = [
  { name: "Em Produção", value: 8, color: "hsl(262 70% 56%)" },
  { name: "Pendente",    value: 5, color: "hsl(215 18% 55%)" },
  { name: "Finalizado",  value: 14, color: "hsl(152 62% 40%)" },
  { name: "Cancelado",   value: 3, color: "hsl(0 78% 55%)" },
];

const BAR_DATA = [
  { tipo: "Cartão PVC", qtd: 15 }, { tipo: "Carnê", qtd: 8 },
  { tipo: "Etiqueta", qtd: 12 }, { tipo: "Impressão", qtd: 6 }, { tipo: "Serviço", qtd: 4 },
];

export function Dashboard() {
  const { user } = useAuth();
  const tenant = useTenant();
  const { orders } = useOrders();
  const navigate = useNavigate();

  const tenantOrders = user?.role === "super_admin"
    ? orders
    : orders.filter((o) => o.tenantSlug === tenant.slug);

  const pending    = tenantOrders.filter((o) => o.status === "pending").length;
  const inProgress = tenantOrders.filter((o) => ["started", "production", "finishing"].includes(o.status)).length;
  const done       = tenantOrders.filter((o) => o.status === "done").length;
  const cancelled  = tenantOrders.filter((o) => o.status === "cancelled").length;
  const total      = tenantOrders.length;

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

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total de Pedidos" value={total} icon={ShoppingCart} color="primary" trend={12} trendLabel="vs mês anterior" delay={0} />
        <KPICard label="Em Andamento" value={inProgress} icon={TrendingUp} color="accent" delay={0.05} />
        <KPICard label="Pendentes" value={pending} icon={Clock} color="warning" delay={0.1} />
        <KPICard label="Finalizados" value={done} icon={CheckCircle2} color="success" trend={8} delay={0.15} />
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
              <AreaChart data={AREA_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPedidos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", boxShadow: "var(--shadow-brand)" }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, fontSize: 12 }}
                  itemStyle={{ color: "hsl(var(--primary))", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="pedidos" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#colorPedidos)" dot={false} />
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
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={STATUS_PIE} innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                  {STATUS_PIE.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-1.5 mt-2">
              {STATUS_PIE.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    <span className="text-muted-foreground">{s.name}</span>
                  </div>
                  <span className="font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
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
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={BAR_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="tipo" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                />
                <Bar dataKey="qtd" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.id} · {formatDateShort(order.updatedAt)}
                    </p>
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
