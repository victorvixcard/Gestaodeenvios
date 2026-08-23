import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowDownCircle, ArrowUpCircle, Clock, Download, Plus, RotateCcw, TimerOff,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { api, ApiError } from "../../lib/api";
import { cn } from "../../lib/utils";
import { useTenant } from "../../contexts/TenantContext";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import type { Movimentacao, MovimentacaoTipo, SaldoProduto } from "../../types";

/**
 * Saldos e historico de creditos de uma empresa.
 *
 * slug === null  → a empresa do proprio token (visao somente leitura do
 *                  cliente, endpoints /movimentacoes*)
 * slug definido  → visao do super admin (endpoints /companies/{slug}/*),
 *                  com lancamento de entrada/saida quando podeLancar.
 */
interface Props {
  slug: string | null;
  podeLancar?: boolean;
}

const TIPO_INFO: Record<MovimentacaoTipo, { label: string; classe: string; Icon: typeof ArrowUpCircle }> = {
  entrada: { label: "Entrada", classe: "bg-success/15 text-success", Icon: ArrowUpCircle },
  saida:   { label: "Saída",   classe: "bg-primary/15 text-primary", Icon: ArrowDownCircle },
  estorno: { label: "Estorno", classe: "bg-accent/20 text-accent-foreground dark:text-accent", Icon: RotateCcw },
};

export function CreditosView({ slug, podeLancar = false }: Props) {
  const tenant = useTenant();
  const base = slug ? `/companies/${slug}` : "";

  const [saldos, setSaldos] = useState<SaldoProduto[]>([]);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);

  const [filtroProduto, setFiltroProduto] = useState("all");
  const [filtroTipo, setFiltroTipo] = useState("all");

  // Dialogo de lancamento (super admin)
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (filtroProduto !== "all") params.set("product_id", filtroProduto);
      if (filtroTipo !== "all") params.set("tipo", filtroTipo);
      const [s, m] = await Promise.all([
        api.get<{ saldos: SaldoProduto[] }>(`${base}/${slug ? "creditos" : "movimentacoes/saldos"}`),
        api.get<{ total: number; movimentacoes: Movimentacao[] }>(
          `${base}/movimentacoes${params.size ? `?${params}` : ""}`
        ),
      ]);
      setSaldos(s.saldos);
      setMovs(m.movimentacoes);
      setTotal(m.total);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível carregar as movimentações.");
    } finally {
      setCarregando(false);
    }
  }, [base, slug, filtroProduto, filtroTipo]);

  useEffect(() => { carregar(); }, [carregar]);

  const lancar = async () => {
    const qtd = parseInt(quantidade, 10);
    if (!produtoId || !qtd || qtd <= 0 || motivo.trim().length < 3) {
      toast.error("Preencha produto, quantidade e um motivo com pelo menos 3 letras.");
      return;
    }
    setSalvando(true);
    try {
      await api.post(`${base}/movimentacoes`, {
        product_id: parseInt(produtoId, 10), tipo, quantidade: qtd, motivo: motivo.trim(),
      });
      toast.success(tipo === "entrada" ? "Entrada lançada." : "Saída lançada.");
      setAberto(false);
      setQuantidade(""); setMotivo("");
      await carregar();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível lançar.");
    } finally {
      setSalvando(false);
    }
  };

  const exportar = async () => {
    const XLSX = await import("xlsx");
    const linhas = movs.map((m) => ({
      "Data":           m.createdAt ? format(parseISO(m.createdAt), "dd/MM/yyyy HH:mm") : "",
      "Tipo":           TIPO_INFO[m.tipo].label,
      "Origem":         m.origem === "manual" ? "Manual" : "Automática",
      "Produto":        m.productName ?? m.productId,
      "Quantidade":     m.quantidade,
      "Saldo anterior": m.saldoAnterior,
      "Saldo final":    m.saldoPosterior,
      "OS":             m.orderId ?? "",
      "Usuário":        m.userName ?? "",
      "Motivo":         m.motivo ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    ws["!cols"] = [{ wch: 16 }, { wch: 10 }, { wch: 11 }, { wch: 28 }, { wch: 11 }, { wch: 13 }, { wch: 11 }, { wch: 10 }, { wch: 18 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
    XLSX.writeFile(wb, `movimentacoes_${slug ?? tenant.slug}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const produtosComMovimento = useMemo(() => {
    const nomes = new Map<number, string>();
    saldos.forEach((s) => nomes.set(s.productId, s.productName));
    movs.forEach((m) => { if (m.productName) nomes.set(m.productId, m.productName); });
    return [...nomes.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [saldos, movs]);

  return (
    <div className="space-y-4">
      {/* Saldos por produto */}
      {saldos.length === 0 && !carregando ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhum produto vinculado a esta empresa ainda.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {saldos.map((s) => (
            <motion.div key={s.productId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={cn("p-4 h-full", s.saldo < 0 && "border-destructive/50")}>
                <p className="text-xs font-semibold text-muted-foreground truncate" title={s.productName}>
                  {s.productName}
                </p>
                <p className={cn(
                  "font-display text-2xl font-extrabold mt-1",
                  s.saldo < 0 ? "text-destructive" : "text-foreground"
                )}>
                  {s.saldo.toLocaleString("pt-BR")} <span className="text-xs font-semibold text-muted-foreground">un</span>
                </p>
                <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  <p>Consumo 30 dias: <span className="font-semibold text-foreground">{s.consumo30Dias.toLocaleString("pt-BR")}</span></p>
                  {s.proximoVencimento && (
                    <p className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {s.proximoVencimento.restante.toLocaleString("pt-BR")} un com prazo até{" "}
                      {format(parseISO(s.proximoVencimento.validade), "dd/MM/yyyy")}
                    </p>
                  )}
                  {s.restanteVencido > 0 && (
                    <p className="flex items-center gap-1 text-warning font-semibold">
                      <TimerOff className="h-3 w-3" />
                      {s.restanteVencido.toLocaleString("pt-BR")} un com prazo vencido
                    </p>
                  )}
                  {s.saldo < 0 && <p className="text-destructive font-semibold">Consumo além do crédito</p>}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Relatorio de prazos vencidos: acompanhamento — o saldo NAO muda */}
      {saldos.some((s) => s.restanteVencido > 0) && (
        <Card className="p-4 border-warning/50">
          <p className="text-xs font-semibold flex items-center gap-1.5 text-warning">
            <TimerOff className="h-3.5 w-3.5" />
            Prazos de uso vencidos
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
            Créditos comprados há mais de 18 meses e ainda não usados. O saldo continua valendo — este quadro é só acompanhamento.
          </p>
          <div className="space-y-1">
            {saldos.flatMap((s) =>
              s.lotesVencidos.map((l) => (
                <p key={l.id} className="text-xs flex flex-wrap items-center gap-x-2">
                  <span className="font-semibold">{s.productName}</span>
                  <span>{l.restante.toLocaleString("pt-BR")} un restantes</span>
                  <span className="text-muted-foreground">
                    prazo venceu em {format(parseISO(l.validade), "dd/MM/yyyy")}
                    {l.motivo ? ` — ${l.motivo}` : ""}
                  </span>
                </p>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Filtros + acoes */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Produto</Label>
          <Select value={filtroProduto} onValueChange={setFiltroProduto}>
            <SelectTrigger className="w-[190px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {produtosComMovimento.map(([id, nome]) => (
                <SelectItem key={id} value={String(id)}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(Object.keys(TIPO_INFO) as MovimentacaoTipo[]).map((t) => (
                <SelectItem key={t} value={t}>{TIPO_INFO[t].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={exportar} disabled={movs.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Excel
        </Button>
        {podeLancar && (
          <Button size="sm" onClick={() => setAberto(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Lançar movimentação
          </Button>
        )}
      </div>

      {/* Historico */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Data</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Produto</th>
                <th className="px-3 py-2 font-semibold text-right">Qtd</th>
                <th className="px-3 py-2 font-semibold text-right">Saldo</th>
                <th className="px-3 py-2 font-semibold">OS</th>
                <th className="px-3 py-2 font-semibold">Usuário / motivo</th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m) => {
                const info = TIPO_INFO[m.tipo];
                return (
                  <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {m.createdAt ? format(parseISO(m.createdAt), "dd/MM/yyyy HH:mm") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", info.classe)}>
                        <info.Icon className="h-3 w-3" />
                        {info.label}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {m.origem === "manual" ? "Manual" : "Automática"}
                      </p>
                    </td>
                    <td className="px-3 py-2 max-w-[180px] truncate" title={m.productName ?? undefined}>
                      {m.productName ?? "—"}
                    </td>
                    <td className={cn(
                      "px-3 py-2 text-right font-semibold tabular-nums",
                      m.quantidade > 0 ? "text-success" : "text-foreground"
                    )}>
                      {m.quantidade > 0 ? `+${m.quantidade.toLocaleString("pt-BR")}` : m.quantidade.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-xs">
                      {m.saldoAnterior.toLocaleString("pt-BR")}
                      {" → "}
                      <span className={cn("font-semibold", m.saldoPosterior < 0 && "text-destructive")}>
                        {m.saldoPosterior.toLocaleString("pt-BR")}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {m.orderId ? (
                        <Link to={`/${tenant.slug}/pedidos/${m.orderId}`} className="text-primary hover:underline font-mono text-xs">
                          {m.orderId}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 max-w-[260px]">
                      <p className="text-xs truncate" title={m.motivo ?? undefined}>
                        {m.userName && <span className="font-semibold">{m.userName}</span>}
                        {m.userName && m.motivo && " — "}
                        <span className="text-muted-foreground">{m.motivo}</span>
                        {m.cobriuDescoberto > 0 && (
                          <span className="text-muted-foreground"> · quitou {m.cobriuDescoberto} do negativo</span>
                        )}
                      </p>
                    </td>
                  </tr>
                );
              })}
              {movs.length === 0 && !carregando && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Nenhuma movimentação ainda. As entradas são lançadas pela VIXCard e as saídas acontecem a cada OS.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {total > movs.length && (
          <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
            Mostrando {movs.length} de {total} — use os filtros ou o Excel para ver o restante.
          </p>
        )}
      </Card>

      {/* Dialogo de lancamento */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Lançar movimentação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo("entrada")}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  tipo === "entrada" ? "border-success bg-success/10" : "border-border hover:bg-muted"
                )}
              >
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <ArrowUpCircle className="h-4 w-4 text-success" /> Entrada
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Compra de crédito — vale 18 meses</p>
              </button>
              <button
                type="button"
                onClick={() => setTipo("saida")}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  tipo === "saida" ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                )}
              >
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <ArrowDownCircle className="h-4 w-4 text-primary" /> Saída
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Desconto manual, fora de OS</p>
              </button>
            </div>
            <div className="space-y-1.5">
              <Label>Produto</Label>
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger><SelectValue placeholder="Escolha o produto" /></SelectTrigger>
                <SelectContent>
                  {saldos.map((s) => (
                    <SelectItem key={s.productId} value={String(s.productId)}>
                      {s.productName} (saldo {s.saldo.toLocaleString("pt-BR")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input type="number" min="1" placeholder="0" value={quantidade}
                     onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Input placeholder={tipo === "entrada" ? "Ex: NF 1234 — compra de 100 cartões" : "Ex: reimpressão por erro da gráfica"}
                     value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={lancar} disabled={salvando}>
              {salvando ? "Lançando..." : "Lançar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
