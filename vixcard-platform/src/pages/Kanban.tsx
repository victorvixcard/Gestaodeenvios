import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  ClipboardCheck, Play, Wrench, PackageCheck, Truck, CheckCircle2, XCircle,
  Search, User, GripVertical, Building2, AlarmClock, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { useOrders } from "../contexts/OrdersContext";
import { useData } from "../contexts/DataContext";
import {
  CollaboratorsPanel, tenantPassaNoFiltro, empresasDoUsuario, useSelecaoColab,
} from "../components/shared/CollaboratorsPanel";
import {
  StatusFilterChips, STATUS_FILTER_LABELS, type StatusFilterValue,
} from "../components/shared/StatusFilterChips";
import { orderIsOverdue } from "../lib/itemDeadline";
import { orderTimeline } from "../lib/timeline";
import { ApiError } from "../lib/api";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import { cn } from "../lib/utils";
import type { Order, OrderStatus } from "../types";

const COLUNAS: { key: OrderStatus; label: string; Icon: React.ElementType; cor: string }[] = [
  { key: "pending",    label: "Recebido",   Icon: ClipboardCheck, cor: "border-t-slate-400" },
  { key: "started",    label: "Iniciado",   Icon: Play,           cor: "border-t-blue-400" },
  { key: "production", label: "Produção",   Icon: Wrench,         cor: "border-t-violet-400" },
  { key: "finishing",  label: "Acabamento", Icon: PackageCheck,   cor: "border-t-amber-400" },
  { key: "shipped",    label: "Enviado",    Icon: Truck,          cor: "border-t-cyan-400" },
  { key: "done",       label: "Entregue",   Icon: CheckCircle2,   cor: "border-t-emerald-400" },
  { key: "cancelled",  label: "Cancelado",  Icon: XCircle,        cor: "border-t-red-400" },
];

// ── Card ──────────────────────────────────────────────────────────────────────
function OrderCard({ order, isSuperAdmin, overlay }: {
  order: Order; isSuperAdmin: boolean; overlay?: boolean;
}) {
  const navigate = useNavigate();
  const tenant = useTenant();
  const atrasado = orderIsOverdue(order.items, order.statusFase);

  // Data limite da OS = o item mais demorado (dd/mm)
  const prazoMax = order.items
    .map((i) => i.deadline)
    .filter(Boolean)
    .sort()
    .at(-1)
    ?.split("-").reverse().slice(0, 2).join("/");

  // So a VIXCard move OS entre etapas; empresa cliente ve o quadro, nao arrasta
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
    disabled: overlay || !isSuperAdmin,
  });

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      className={cn(
        // overflow-hidden é a última barreira: nada dentro do card pode
        // transbordar para a coluna vizinha, por mais longo que seja o texto.
        "rounded-xl border bg-card p-3 space-y-2 transition-shadow overflow-hidden",
        atrasado ? "border-red-300 border-2" : "border-border",
        isDragging && "opacity-30",
        overlay && "shadow-2xl rotate-2 cursor-grabbing"
      )}
    >
      <div className="flex items-start gap-2">
        {isSuperAdmin && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
            aria-label={`Arrastar ordem ${order.id}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] font-bold text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded">
              {order.id}
            </span>
            {isSuperAdmin && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Building2 className="h-2.5 w-2.5" />{order.tenantName}
              </Badge>
            )}
          </div>
          <button
            onClick={() => navigate(`/${tenant.slug}/pedidos/${order.id}`)}
            className="text-left text-[13px] font-semibold leading-snug mt-1 hover:text-primary transition-colors line-clamp-2"
          >
            {order.title}
          </button>
        </div>
      </div>

      {/* Coluna estreita não comporta o detalhamento por item — em atraso vira
          um botão único que leva à OS; no prazo, só a data limite. O detalhe
          completo continua na tela do pedido. */}
      {atrasado ? (
        <button
          onClick={() => navigate(`/${tenant.slug}/pedidos/${order.id}`)}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-wider py-1.5 transition-colors"
        >
          <AlarmClock className="h-3.5 w-3.5" />
          Atraso
        </button>
      ) : (
        prazoMax && (
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
            <Clock className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">até {prazoMax}</span>
          </p>
        )
      )}

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1 border-t border-border/50">
        <User className="h-2.5 w-2.5" />
        <span className="truncate">{order.requestedBy}</span>
      </div>
    </div>
  );
}

// ── Coluna ────────────────────────────────────────────────────────────────────
function Coluna({ col, orders, isSuperAdmin }: {
  col: typeof COLUNAS[number]; orders: Order[]; isSuperAdmin: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  const Icon = col.Icon;
  const atrasados = orders.filter((o) => orderIsOverdue(o.items, o.statusFase)).length;

  return (
    // flex-1 com mínimo: as colunas dividem a largura disponível e só entram em
    // rolagem quando a tela é estreita demais. Largura fixa fazia a última coluna
    // ficar fora da tela, e arrastar para algo invisível é uma experiência ruim.
    <div className="flex flex-col flex-1 min-w-[148px] max-w-[300px]">
      <div className={cn("rounded-t-xl border-t-4 bg-muted/40 px-3 py-2.5", col.cor)}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-semibold">{col.label}</span>
          <span className="ml-auto text-xs font-bold text-muted-foreground bg-background px-1.5 py-0.5 rounded">
            {orders.length}
          </span>
        </div>
        {atrasados > 0 && (
          <p className="text-[10px] font-semibold text-red-600 mt-1">
            {atrasados} em atraso
          </p>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 p-2 rounded-b-xl border border-t-0 border-border min-h-[220px] transition-colors",
          isOver ? "bg-primary/10 border-primary/40" : "bg-muted/15"
        )}
      >
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} isSuperAdmin={isSuperAdmin} />
        ))}
        {orders.length === 0 && (
          <p className="text-[11px] text-muted-foreground/50 text-center py-8">
            {isOver ? "Solte aqui" : "Nenhuma OS"}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export function Kanban() {
  const { user } = useAuth();
  const tenant = useTenant();
  const { orders, updateStatus } = useOrders();
  const { companies, users } = useData();
  const isSuperAdmin = user?.role === "super_admin";
  const mostraPainel = isSuperAdmin && user?.tenantSlug === "vixcard";

  const [busca, setBusca] = useState("");
  const [colab, setColab] = useSelecaoColab();
  // "all" mostra as 6 colunas. Um status especifico mostra so aquela coluna —
  // e o equivalente a filtrar num quadro. "overdue" mantem as colunas mas so
  // com os cards em atraso.
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [arrastando, setArrastando] = useState<Order | null>(null);
  // Cancelar exige motivo, então o drop para "Cancelado" abre diálogo
  const [cancelando, setCancelando] = useState<Order | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const sensors = useSensors(
    // 6px de tolerância: sem isso, clicar no card já dispara arrasto
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const visiveis = useMemo(() => {
    const doTenant = isSuperAdmin ? orders : orders.filter((o) => o.tenantSlug === tenant.slug);
    const t = busca.toLowerCase().trim();

    return doTenant.filter((o) => {
      if (!tenantPassaNoFiltro(colab, o.tenantSlug, companies, users)) return false;
      if (statusFilter === "overdue" && !orderIsOverdue(o.items, o.statusFase)) return false;
      if (!t) return true;
      return o.id.toLowerCase().includes(t) ||
             o.title.toLowerCase().includes(t) ||
             o.tenantName.toLowerCase().includes(t) ||
             o.requestedBy.toLowerCase().includes(t);
    });
  }, [orders, isSuperAdmin, tenant.slug, busca, statusFilter, colab, companies, users]);

  // Filtrar por um status especifico esconde as outras colunas
  const colunasVisiveis = useMemo(() => {
    if (statusFilter === "all" || statusFilter === "overdue") return COLUNAS;
    return COLUNAS.filter((c) => c.key === statusFilter);
  }, [statusFilter]);

  // Agrupa pela FASE: etapas personalizadas caem na coluna da fase delas
  const porStatus = useMemo(() => {
    const m = {} as Record<OrderStatus, Order[]>;
    COLUNAS.forEach((c) => { m[c.key] = []; });
    visiveis.forEach((o) => { m[o.statusFase]?.push(o); });
    return m;
  }, [visiveis]);

  // Contagem por status para os chips — mesma leitura da tela de Pedidos.
  // Respeita o filtro de colaborador para os números baterem com o quadro.
  const statusCounts = useMemo(() => {
    const doTenant = (isSuperAdmin ? orders : orders.filter((o) => o.tenantSlug === tenant.slug))
      .filter((o) => tenantPassaNoFiltro(colab, o.tenantSlug, companies, users));
    const c: Partial<Record<StatusFilterValue, number>> = {
      all: doTenant.length,
      overdue: doTenant.filter((o) => orderIsOverdue(o.items, o.statusFase)).length,
    };
    doTenant.forEach((o) => { c[o.statusFase] = (c[o.statusFase] ?? 0) + 1; });
    return c;
  }, [orders, isSuperAdmin, tenant.slug, colab, companies, users]);

  // Badge de quantidade ao lado de cada nome no painel
  const contadorOs = (userId: string) => {
    const slugs = empresasDoUsuario(companies, userId);
    return orders.filter((o) => slugs.has(o.tenantSlug)).length;
  };

  const handleStart = (e: DragStartEvent) => {
    setArrastando(orders.find((o) => o.id === e.active.id) ?? null);
  };

  const handleEnd = async (e: DragEndEvent) => {
    setArrastando(null);
    const destino = e.over?.id as OrderStatus | undefined;
    const ordem = orders.find((o) => o.id === e.active.id);
    if (!destino || !ordem || ordem.statusFase === destino) return;

    if (destino === "cancelled") {
      if (!isSuperAdmin) {
        toast.error("Apenas o super admin pode cancelar uma OS.");
        return;
      }
      setCancelando(ordem);
      setMotivo("");
      return;
    }

    // A coluna e uma FASE; a OS transita por CHAVES do proprio fluxo.
    // Solta na coluna X -> primeira etapa do fluxo da OS cuja fase e X.
    const etapa = orderTimeline(ordem).find((s) => s.fase === destino);
    if (!etapa) {
      toast.error(`O fluxo da ${ordem.id} não tem etapa na fase "${COLUNAS.find((c) => c.key === destino)?.label}".`);
      return;
    }

    try {
      await updateStatus(ordem.id, etapa.key);
      toast.success(`${ordem.id} → ${etapa.label}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível mover a OS.");
    }
  };

  const confirmarCancelamento = async () => {
    if (!cancelando) return;
    if (motivo.trim().length < 5) {
      toast.error("Descreva o motivo com pelo menos 5 caracteres.");
      return;
    }
    setSalvando(true);
    try {
      await updateStatus(cancelando.id, "cancelled", motivo.trim());
      toast.success(`${cancelando.id} cancelada.`);
      setCancelando(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível cancelar.");
    } finally {
      setSalvando(false);
    }
  };

  const totalAtraso = visiveis.filter((o) => orderIsOverdue(o.items, o.statusFase)).length;

  return (
    <div className="flex gap-4 items-start">
      {mostraPainel && (
        <CollaboratorsPanel selecao={colab} onChange={setColab} contadorOs={contadorOs} />
      )}
      <div className="space-y-4 flex-1 min-w-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">Operação</p>
          <h1 className="font-display text-2xl font-extrabold">Kanban</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuperAdmin
              ? "Arraste os cards para mover a ordem de serviço entre as etapas."
              : "Acompanhe em que etapa está cada ordem de serviço."}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {totalAtraso > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-400 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
              {totalAtraso} OS em atraso
            </span>
          )}

          <div className="relative w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar OS, cliente..." value={busca}
                   onChange={(e) => setBusca(e.target.value)} className="pl-9" />
          </div>
        </div>
      </div>

      <StatusFilterChips value={statusFilter} onChange={setStatusFilter} counts={statusCounts} />

      <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd}>
        <div className="flex gap-2 overflow-x-auto pb-4">
          {colunasVisiveis.map((c) => (
            <Coluna key={c.key} col={c} orders={porStatus[c.key] ?? []} isSuperAdmin={isSuperAdmin} />
          ))}
        </div>

        {statusFilter !== "all" && (
          <p className="text-xs text-muted-foreground -mt-2">
            {statusFilter === "overdue"
              ? "Mostrando apenas as OS em atraso. Arrastar continua funcionando."
              : `Mostrando apenas "${STATUS_FILTER_LABELS[statusFilter as OrderStatus]}". Para mover entre etapas, volte para "Todos".`}
          </p>
        )}

        {/* O card segue o cursor durante o arrasto */}
        <DragOverlay dropAnimation={null}>
          {arrastando && (
            <div className="w-[254px]">
              <OrderCard order={arrastando} isSuperAdmin={isSuperAdmin} overlay />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Dialog open={!!cancelando} onOpenChange={(v) => !v && setCancelando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar {cancelando?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              O motivo fica registrado no histórico da OS e aparece para o cliente.
            </p>
            <Textarea
              placeholder="Por que esta ordem está sendo cancelada?"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCancelando(null)} disabled={salvando}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={confirmarCancelamento} disabled={salvando}>
              {salvando ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
