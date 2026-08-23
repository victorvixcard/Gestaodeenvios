import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, XCircle, Check, X, Clock, Building2, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "../lib/api";
import { useOrders } from "../contexts/OrdersContext";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import { formatDate } from "../lib/utils";
import { cn } from "../lib/utils";
import type { CancelRequest } from "../types";

/**
 * Fila de solicitações de cancelamento (super admin). A empresa cliente só
 * cancela por conta própria nos primeiros 15 minutos; depois disso ela pede
 * e a VIXCard decide aqui, com um motivo que vai para o histórico da OS.
 */
export function CancelRequests() {
  const navigate = useNavigate();
  const { refresh } = useOrders();
  const [lista, setLista] = useState<CancelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisao, setDecisao] = useState<{ pedido: CancelRequest; tipo: "approve" | "reject" } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setLista(await api.get<CancelRequest[]>("/cancel-requests?status=all"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar solicitações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const pendentes = lista.filter((r) => r.status === "pending");
  const historico = lista.filter((r) => r.status !== "pending");

  const confirmar = async () => {
    if (!decisao) return;
    if (decisao.tipo === "reject" && motivo.trim().length < 5) {
      toast.error("Explique o motivo da rejeição (mínimo 5 caracteres).");
      return;
    }
    setSalvando(true);
    try {
      await api.post(`/cancel-requests/${decisao.pedido.id}/${decisao.tipo}`, { reason: motivo.trim() || undefined });
      toast.success(decisao.tipo === "approve"
        ? `OS ${decisao.pedido.orderId} cancelada.`
        : `Solicitação da OS ${decisao.pedido.orderId} rejeitada.`);
      setDecisao(null);
      setMotivo("");
      await carregar();
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao registrar a decisão.");
    } finally {
      setSalvando(false);
    }
  };

  const Linha = ({ r, i }: { r: CancelRequest; i: number }) => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
      <Card className={cn("p-4 bg-gradient-card", r.status === "pending" && "border-amber-300/60")}>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate(`/vixcard/pedidos/${r.orderId}`)}
                className="font-mono text-xs font-bold text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded hover:bg-primary/15"
              >
                OS {r.orderId}
              </button>
              <Badge variant="outline" className="text-[10px] gap-1">
                <Building2 className="h-2.5 w-2.5" />{r.tenantName}
              </Badge>
              {r.status === "approved" && <Badge variant="success" className="text-[10px]">Aprovada</Badge>}
              {r.status === "rejected" && <Badge variant="muted" className="text-[10px]">Rejeitada</Badge>}
              {r.status === "pending" && (
                <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-400/40 gap-1">
                  <Clock className="h-2.5 w-2.5" />Aguardando
                </Badge>
              )}
            </div>
            <p className="text-sm font-semibold mt-1.5">{r.orderTitle}</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              <UserIcon className="h-3 w-3 inline mr-1" />
              <span className="font-medium text-foreground">{r.requestedBy}</span> em {formatDate(r.createdAt)}:{" "}
              "{r.reason}"
            </p>
            {r.status !== "pending" && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                <span className="font-medium text-foreground">{r.decidedBy}</span>
                {r.decidedAt && <> em {formatDate(r.decidedAt)}</>}
                {r.decisionReason ? <>: "{r.decisionReason}"</> : <> — sem observação</>}
              </p>
            )}
          </div>

          {r.status === "pending" && (
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/5"
                      onClick={() => { setDecisao({ pedido: r, tipo: "reject" }); setMotivo(""); }}>
                <X className="h-3.5 w-3.5" />Rejeitar
              </Button>
              <Button size="sm" variant="brand"
                      onClick={() => { setDecisao({ pedido: r, tipo: "approve" }); setMotivo(""); }}>
                <Check className="h-3.5 w-3.5" />Aprovar
              </Button>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate("/vixcard/pedidos")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> Pedidos
          </button>
          <h1 className="font-display text-2xl font-extrabold flex items-center gap-2">
            <XCircle className="h-6 w-6 text-destructive" />
            Solicitações de cancelamento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Empresa cliente pede o cancelamento depois dos 15 minutos; você aprova ou rejeita aqui.
          </p>
        </div>
        {pendentes.length > 0 && (
          <Badge className="bg-amber-500/15 text-amber-600 border-amber-400/40 text-xs py-1 px-3">
            {pendentes.length} aguardando
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Aguardando resposta</h2>
            {pendentes.length === 0 ? (
              <Card className="p-8 text-center bg-gradient-card">
                <Check className="h-8 w-8 mx-auto text-success/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
              </Card>
            ) : pendentes.map((r, i) => <Linha key={r.id} r={r} i={i} />)}
          </section>

          {historico.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Histórico</h2>
              {historico.map((r, i) => <Linha key={r.id} r={r} i={i} />)}
            </section>
          )}
        </>
      )}

      <Dialog open={!!decisao} onOpenChange={(v) => !v && setDecisao(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisao?.tipo === "approve" ? "Aprovar cancelamento" : "Rejeitar solicitação"} — OS {decisao?.pedido.orderId}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-xs text-muted-foreground">
              {decisao?.tipo === "approve"
                ? "A OS será cancelada. Se quiser, deixe uma observação — ela aparece no histórico da OS."
                : "Explique o motivo. A empresa vê a resposta na tela da OS."}
            </p>
            <Textarea
              placeholder={decisao?.tipo === "approve" ? "Observação (opcional)" : "Ex: produção já iniciada, material cortado..."}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDecisao(null)} disabled={salvando}>Voltar</Button>
            <Button variant={decisao?.tipo === "approve" ? "destructive" : "brand"} onClick={confirmar} disabled={salvando}>
              {salvando ? "Salvando..." : decisao?.tipo === "approve" ? "Confirmar cancelamento" : "Confirmar rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
