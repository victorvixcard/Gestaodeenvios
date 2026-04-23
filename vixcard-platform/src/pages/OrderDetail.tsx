import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Play, CheckCircle2, Wrench, PackageCheck,
  XCircle, MessageSquarePlus, Send,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useOrders } from "../contexts/OrdersContext";
import { StatusBadge } from "../components/shared/StatusBadge";
import { OrderTimeline } from "../components/shared/OrderTimeline";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { formatDate } from "../lib/utils";
import type { OrderStatus } from "../types";

const STAGES: { key: OrderStatus; label: string; icon: React.ElementType }[] = [
  { key: "pending",    label: "Recebido",   icon: CheckCircle2 },
  { key: "started",    label: "Iniciado",   icon: Play },
  { key: "production", label: "Produção",   icon: Wrench },
  { key: "finishing",  label: "Acabamento", icon: PackageCheck },
  { key: "done",       label: "Entregue",   icon: CheckCircle2 },
];

const STAGE_ORDER = ["pending", "started", "production", "finishing", "done"];

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { getOrder, updateStatus, addNote } = useOrders();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);

  const order = getOrder(id!);
  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Pedido não encontrado.</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const currentStageIndex = STAGE_ORDER.indexOf(order.status);
  const isSuperAdmin = user?.role === "super_admin";
  const isCancelled = order.status === "cancelled";
  const isDone = order.status === "done";

  const handleAdvance = () => {
    const nextIndex = STAGE_ORDER.indexOf(order.status) + 1;
    if (nextIndex >= STAGE_ORDER.length) return;
    const nextStatus = STAGE_ORDER[nextIndex] as OrderStatus;
    updateStatus(order.id, nextStatus, undefined, user?.name);
    toast.success(`Status atualizado para: ${nextStatus}`);
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) { toast.error("Informe o motivo do cancelamento."); return; }
    updateStatus(order.id, "cancelled", cancelReason, user?.name);
    setShowCancelForm(false);
    setCancelReason("");
    toast.success("Pedido cancelado.");
  };

  const handleAddNote = () => {
    if (!note.trim()) return;
    addNote(order.id, note, user?.name ?? "Usuário", user?.role ?? "operator");
    setNote("");
    toast.success("Anotação adicionada.");
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Back + header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {order.id}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <h1 className="font-display text-xl lg:text-2xl font-extrabold truncate">{order.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solicitado por {order.requestedBy} · {formatDate(order.createdAt)}
          </p>
        </div>
      </div>

      {/* Stepper */}
      {!isCancelled && (
        <Card className="p-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STAGES.map((stage, i) => {
              const done = currentStageIndex > i;
              const active = currentStageIndex === i;
              const StageIcon = stage.icon;
              return (
                <div key={stage.key} className="flex items-center gap-1 min-w-0">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div
                      className={[
                        "h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs transition-all border-2",
                        done    ? "bg-success text-white border-success"             : "",
                        active  ? "bg-accent text-accent-foreground border-accent animate-pulse-ring" : "",
                        !done && !active ? "bg-secondary text-muted-foreground border-transparent" : "",
                      ].join(" ")}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : <StageIcon className="h-4 w-4" />}
                    </div>
                    <span className={[
                      "text-[10px] font-medium hidden sm:block whitespace-nowrap",
                      active ? "text-foreground" : "text-muted-foreground",
                    ].join(" ")}>
                      {stage.label}
                    </span>
                  </div>
                  {i < STAGES.length - 1 && (
                    <div className={[
                      "flex-1 h-0.5 rounded-full min-w-[16px]",
                      done ? "bg-success" : "bg-border",
                    ].join(" ")} />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Cancel banner */}
      {isCancelled && (
        <div className="flex gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/5">
          <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Pedido cancelado</p>
            {order.cancelReason && (
              <p className="text-xs text-muted-foreground mt-1">{order.cancelReason}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Main */}
        <div className="lg:col-span-3 space-y-5">
          {/* Items */}
          <Card>
            <CardHeader><CardTitle>Itens do Pedido</CardTitle></CardHeader>
            <CardContent className="pt-3">
              <div className="space-y-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{item.productName}</p>
                      {item.specifications && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.specifications}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0 font-mono text-xs">
                      {item.quantity.toLocaleString("pt-BR")} un
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4 text-primary" />
                <CardTitle>Anotações ({order.notes.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.notes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma anotação.</p>
              )}
              {order.notes.map((n) => (
                <div key={n.id} className="p-3 rounded-lg bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold">{n.authorName}</span>
                    <span className="text-xs text-muted-foreground/50">·</span>
                    <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
                  </div>
                  <p className="text-sm">{n.content}</p>
                </div>
              ))}

              {!isCancelled && (
                <div className="space-y-2 pt-2">
                  <Textarea
                    placeholder="Adicionar anotação interna..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                  <Button size="sm" onClick={handleAddNote} disabled={!note.trim()}>
                    <Send className="h-3.5 w-3.5" />
                    Adicionar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-2 space-y-5">
          {/* Actions (super admin only) */}
          {isSuperAdmin && !isCancelled && !isDone && (
            <Card>
              <CardHeader><CardTitle>Ações</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full"
                  variant="brand"
                  onClick={handleAdvance}
                  disabled={currentStageIndex >= STAGE_ORDER.length - 1}
                >
                  <Play className="h-4 w-4" />
                  {currentStageIndex === 0 ? "▶ START — Iniciar Produção" : "Avançar Etapa"}
                </Button>
                <Separator />
                {!showCancelForm ? (
                  <Button
                    variant="outline"
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/5"
                    onClick={() => setShowCancelForm(true)}
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar Pedido
                  </Button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-2"
                  >
                    <Textarea
                      placeholder="Motivo do cancelamento..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={handleCancel} className="flex-1">
                        Confirmar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowCancelForm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <Card>
            <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tenant</span>
                <span className="font-medium">{order.tenantName}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Solicitante</span>
                <span className="font-medium">{order.requestedBy}</span>
              </div>
              {order.assignedTo && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Responsável</span>
                    <span className="font-medium">{order.assignedTo}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado em</span>
                <span className="font-medium">{formatDate(order.createdAt)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Atualizado</span>
                <span className="font-medium">{formatDate(order.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader><CardTitle>Linha do Tempo</CardTitle></CardHeader>
            <CardContent>
              <OrderTimeline events={order.events} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
