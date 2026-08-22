import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Play, CheckCircle2,
  XCircle, MessageSquarePlus, Send, Download, FileText, FileImage, File as FileIcon, Paperclip,
  MessageCircle, AlertTriangle, Undo2, RotateCcw, Trash2, Pencil, Plus, X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useOrders } from "../contexts/OrdersContext";
import { useData } from "../contexts/DataContext";
import { useLog } from "../contexts/LogsContext";
import { ApiError } from "../lib/api";
import { StatusBadge } from "../components/shared/StatusBadge";
import { OrderTimeline } from "../components/shared/OrderTimeline";
import { ItemDeadlineStatus } from "../components/shared/ItemDeadlineBadge";
import { formatDeadline } from "../lib/itemDeadline";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { formatDate } from "../lib/utils";
import { orderTimeline, STATUS_ICON } from "../lib/timeline";
import type { OrderItem, OrderStatus } from "../types";


export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { getOrder, updateStatus, addNote, updateItems, deleteOrder } = useOrders();
  const { products } = useData();
  const { addLog } = useLog();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edicao de itens (super admin)
  const [showItemsEditor, setShowItemsEditor] = useState(false);
  const [editingItems, setEditingItems] = useState<OrderItem[]>([]);
  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [savingItems, setSavingItems] = useState(false);

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

  // Fluxo do PROPRIO pedido, congelado na criacao. Avancar/voltar percorre
  // essas etapas — pedido de fluxo curto pula direto o que nao tem.
  const steps = orderTimeline(order);
  const stageOrder: OrderStatus[] = steps.map((s) => s.status);
  const rotulo = (status: string) =>
    steps.find((s) => s.status === status)?.label ?? status;

  const currentStageIndex = stageOrder.indexOf(order.status);
  const isSuperAdmin = user?.role === "super_admin";
  const isCancelled = order.status === "cancelled";
  const isDone = order.status === "done";
  const isPending = order.status === "pending";

  // Tenant user can cancel only while still pending
  const canTenantCancel = !isSuperAdmin && isPending && !isCancelled;
  // Tenant user sees WhatsApp contact when order already started
  const tenantNeedsWhatsapp = !isSuperAdmin && !isPending && !isCancelled && !isDone;

  const whatsappMsg = encodeURIComponent(
    `Olá! Preciso solicitar o cancelamento da OS *${order.id}* — "${order.title}". Por favor, poderia verificar?`
  );

  const actor = {
    userName: user?.name ?? "Usuário",
    userEmail: user?.email ?? "",
    userRole: user?.role ?? "operator" as const,
    tenantSlug: order.tenantSlug,
  };

  const handleAdvance = async () => {
    const nextIndex = stageOrder.indexOf(order.status) + 1;
    if (nextIndex >= stageOrder.length || nextIndex === 0) return;
    const nextStatus = stageOrder[nextIndex] as OrderStatus;
    const prevLabel = rotulo(order.status);
    const nextLabel = rotulo(nextStatus);
    try {
      await updateStatus(order.id, nextStatus, undefined, user?.name);
      addLog({ ...actor, action: "pedido_status", entityType: "Pedido", entityId: order.id, entityName: order.title, details: `Status: ${prevLabel} → ${nextLabel}` });
      toast.success(`Status atualizado para: ${nextLabel}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar status.");
    }
  };

  // Super admin: voltar uma etapa no fluxo
  const handleGoBack = async () => {
    const prevIndex = stageOrder.indexOf(order.status) - 1;
    if (prevIndex < 0) return;
    const prevStatus = stageOrder[prevIndex] as OrderStatus;
    const currentLabel = rotulo(order.status);
    const prevLabel = rotulo(prevStatus);
    try {
      await updateStatus(order.id, prevStatus, undefined, user?.name);
      addLog({ ...actor, action: "pedido_status", entityType: "Pedido", entityId: order.id, entityName: order.title, details: `Status revertido: ${currentLabel} → ${prevLabel}` });
      toast.success(`Status revertido para: ${prevLabel}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao voltar status.");
    }
  };

  // Super admin: reabre pedido cancelado/concluido voltando para o início do fluxo
  const handleReopen = async () => {
    try {
      await updateStatus(order.id, "pending", undefined, user?.name);
      addLog({ ...actor, action: "pedido_status", entityType: "Pedido", entityId: order.id, entityName: order.title, details: `Pedido reaberto (status anterior: ${order.status})` });
      toast.success("Pedido reaberto.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao reabrir pedido.");
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) { toast.error("Informe o motivo do cancelamento."); return; }
    try {
      await updateStatus(order.id, "cancelled", cancelReason, user?.name);
      addLog({ ...actor, action: "pedido_cancelado", entityType: "Pedido", entityId: order.id, entityName: order.title, details: `Motivo: ${cancelReason}` });
      setShowCancelForm(false);
      setCancelReason("");
      toast.success("Pedido cancelado.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao cancelar pedido.");
    }
  };

  // Super admin: exclusão definitiva
  const handleDelete = async () => {
    try {
      await deleteOrder(order.id);
      addLog({ ...actor, action: "pedido_status", entityType: "Pedido", entityId: order.id, entityName: order.title, details: "Pedido EXCLUÍDO definitivamente" });
      toast.success("Pedido excluído.");
      navigate(-1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir pedido.");
    }
  };

  // Super admin: editor de itens
  const openItemsEditor = () => {
    // Copia profunda para nao mexer no estado original ate o salvar
    setEditingItems(order.items.map((it) => ({ ...it })));
    setNewProductId("");
    setNewQuantity("");
    setShowItemsEditor(true);
  };

  const closeItemsEditor = () => {
    setShowItemsEditor(false);
    setEditingItems([]);
    setNewProductId("");
    setNewQuantity("");
  };

  const updateItemQty = (index: number, qty: number) => {
    setEditingItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity: Math.max(1, qty) } : it)));
  };

  const removeItemAt = (index: number) => {
    setEditingItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addNewItem = () => {
    if (!newProductId) { toast.error("Selecione um produto."); return; }
    const qty = parseInt(newQuantity || "0", 10);
    if (!qty || qty < 1) { toast.error("Informe a quantidade."); return; }
    const product = products.find((p) => p.id === newProductId);
    if (!product) return;
    setEditingItems((prev) => [
      ...prev,
      { productId: product.id, productName: product.name, quantity: qty, specifications: "" },
    ]);
    setNewProductId("");
    setNewQuantity("");
  };

  const handleSaveItems = async () => {
    if (editingItems.length === 0) { toast.error("O pedido deve ter pelo menos 1 item."); return; }
    setSavingItems(true);
    try {
      await updateItems(order.id, editingItems);
      const prevCount = order.items.length;
      const prevTotal = order.items.reduce((s, it) => s + it.quantity, 0);
      const newCount = editingItems.length;
      const newTotal = editingItems.reduce((s, it) => s + it.quantity, 0);
      addLog({
        ...actor,
        action: "pedido_nota",
        entityType: "Pedido",
        entityId: order.id,
        entityName: order.title,
        details: `Itens editados — de ${prevCount} item(s)/${prevTotal} un. para ${newCount} item(s)/${newTotal} un.`,
      });
      toast.success("Itens atualizados!");
      closeItemsEditor();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar itens.");
    } finally {
      setSavingItems(false);
    }
  };

  const handleAddNote = () => {
    if (!note.trim()) return;
    addNote(order.id, note, user?.name ?? "Usuário", user?.role ?? "operator");
    addLog({ ...actor, action: "pedido_nota", entityType: "Pedido", entityId: order.id, entityName: order.title, details: note.slice(0, 100) });
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
            {steps.map((stage, i) => {
              const done = currentStageIndex > i;
              const active = currentStageIndex === i;
              const StageIcon = STATUS_ICON[stage.status];
              return (
                <div key={stage.status} className="flex items-center gap-1 min-w-0">
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
                  {i < steps.length - 1 && (
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Itens do Pedido</CardTitle>
              {isSuperAdmin && !isCancelled && (
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={openItemsEditor}>
                  <Pencil className="h-3 w-3" />
                  Editar itens
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-3">
              <div className="space-y-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{item.productName}</p>
                      {item.selectedVariations && item.selectedVariations.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          {item.selectedVariations.map((sv) => (
                            <span key={sv.variationId} className="text-xs text-muted-foreground">
                              {sv.variationName}:{" "}
                              <span className="font-medium text-foreground">
                                {sv.optionLabel}{sv.extraText ? ` (${sv.extraText})` : ""}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                      {item.specifications && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.specifications}</p>
                      )}
                      {/* Prazo deste item — vem do backend, congelado na criação */}
                      {item.deadline && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <ItemDeadlineStatus item={item} orderStatus={order.status} />
                          <span className="text-[11px] text-muted-foreground">
                            Prazo: {formatDeadline(item.deadline)}
                            {item.deadlineDays ? ` · ${item.deadlineDays} dias úteis` : ""}
                          </span>
                        </div>
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

          {/* Arquivos para Produção */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                <CardTitle>Arquivos para Produção ({order.files?.length ?? 0})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {(!order.files || order.files.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum arquivo anexado.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {order.files.map((f, i) => {
                    const icon = f.type.startsWith("image/")
                      ? <FileImage className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      : f.type === "application/pdf"
                      ? <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                      : <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
                    const size = f.size < 1024 * 1024
                      ? `${(f.size / 1024).toFixed(1)} KB`
                      : `${(f.size / (1024 * 1024)).toFixed(1)} MB`;
                    return (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-muted/30">
                        {icon}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{size}</p>
                        </div>
                        <a
                          href={f.url}
                          download={f.name}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline flex-shrink-0"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Baixar
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
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
          {/* Actions — super admin (controle total, qualquer status) */}
          {isSuperAdmin && (
            <Card>
              <CardHeader><CardTitle>Ações</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {/* Avançar — fluxo ativo (pendente até acabamento) */}
                {!isCancelled && !isDone && (
                  <Button
                    className="w-full"
                    variant="brand"
                    onClick={handleAdvance}
                    disabled={currentStageIndex >= stageOrder.length - 1}
                  >
                    <Play className="h-4 w-4" />
                    {currentStageIndex === 0 ? "▶ START — Iniciar Produção" : "Avançar Etapa"}
                  </Button>
                )}

                {/* Voltar etapa — fluxo ativo a partir de started */}
                {!isCancelled && !isDone && currentStageIndex > 0 && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleGoBack}
                  >
                    <Undo2 className="h-4 w-4" />
                    Voltar Etapa
                  </Button>
                )}

                {/* Reabrir — quando cancelado ou concluído */}
                {(isCancelled || isDone) && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleReopen}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reabrir Pedido
                  </Button>
                )}

                {/* Cancelar — apenas se não estiver já cancelado */}
                {!isCancelled && (
                  <>
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
                  </>
                )}

                {/* Excluir definitivamente — sempre disponível para super admin, com confirmação dupla */}
                <Separator />
                {!showDeleteConfirm ? (
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir Pedido
                  </Button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                  >
                    <p className="text-xs text-destructive font-semibold">
                      Esta ação é irreversível.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      O pedido <span className="font-mono">{order.id}</span> e todos os anexos serão apagados permanentemente.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={handleDelete} className="flex-1">
                        Sim, excluir
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions — tenant user: can cancel while pending */}
          {canTenantCancel && (
            <Card>
              <CardHeader><CardTitle>Ações</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {!showCancelForm ? (
                  <Button
                    variant="outline"
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/5"
                    onClick={() => setShowCancelForm(true)}
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar Solicitação
                  </Button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-2"
                  >
                    <p className="text-xs text-muted-foreground">
                      Informe o motivo para cancelar esta solicitação.
                    </p>
                    <Textarea
                      placeholder="Ex: pedido feito por engano, dados incorretos..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={handleCancel} className="flex-1">
                        Confirmar Cancelamento
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowCancelForm(false)}>
                        Voltar
                      </Button>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Info — tenant user: order already started, contact via WhatsApp */}
          {tenantNeedsWhatsapp && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      Produção já iniciada
                    </p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-1 leading-relaxed">
                      Esta solicitação já foi iniciada pela equipe VIXCard. Para cancelar, entre em contato pelo WhatsApp.
                    </p>
                  </div>
                </div>
                <a
                  href={`https://wa.me/5527999999999?text=${whatsappMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#25D366] hover:bg-[#1da851] text-white text-sm font-semibold py-2 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar com VIXCard
                </a>
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

      {/* Dialog: editor de itens (super admin) */}
      <Dialog open={showItemsEditor} onOpenChange={(v) => !v && closeItemsEditor()}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Editar itens do pedido</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-mono">{order.id}</span> · {order.title}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {/* Lista atual */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Itens atuais ({editingItems.length})
              </p>
              {editingItems.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                  Nenhum item. Adicione ao menos um abaixo.
                </div>
              ) : (
                editingItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      {item.selectedVariations && item.selectedVariations.length > 0 && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {item.selectedVariations.map((sv) => `${sv.variationName}: ${sv.optionLabel}`).join(" · ")}
                        </p>
                      )}
                      {item.specifications && (
                        <p className="text-[10px] text-muted-foreground truncate">{item.specifications}</p>
                      )}
                    </div>
                    <Input
                      type="number"
                      min={1}
                      className="w-24 h-9 text-sm"
                      value={item.quantity}
                      onChange={(e) => updateItemQty(i, parseInt(e.target.value || "1", 10))}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeItemAt(i)}
                      title="Remover item"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <Separator />

            {/* Adicionar novo item */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Adicionar item
              </p>
              <div className="flex gap-2">
                <Select value={newProductId} onValueChange={setNewProductId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione o produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products
                      .filter((p) => p.active)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} <span className="text-muted-foreground text-[10px]">({p.code})</span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  placeholder="Qtd"
                  className="w-24"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                />
                <Button variant="brand" onClick={addNewItem}>
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Para variações/especificações, crie o item novo aqui e ajuste em uma nova OS se necessário.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-border">
            <Button variant="ghost" onClick={closeItemsEditor} disabled={savingItems}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={handleSaveItems} disabled={savingItems || editingItems.length === 0}>
              {savingItems ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
