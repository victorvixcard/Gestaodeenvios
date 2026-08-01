import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Timer, Save, Info, Search } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "../lib/api";
import { useData } from "../contexts/DataContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import type { ProductDeadline } from "../types";

interface DeadlinesResponse {
  companySlug: string;
  companyName: string;
  defaultDays: number;
  products: ProductDeadline[];
}

export function PrazosAlerta() {
  const { companies } = useData();
  const [slug, setSlug]         = useState("");
  const [data, setData]         = useState<DeadlinesResponse | null>(null);
  const [edits, setEdits]       = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState("");

  const empresasAtivas = companies.filter((c) => c.active);

  // Seleciona a primeira empresa assim que a lista chega
  useEffect(() => {
    if (!slug && empresasAtivas.length > 0) setSlug(empresasAtivas[0].slug);
  }, [empresasAtivas, slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);

    api.get<DeadlinesResponse>(`/companies/${slug}/deadlines`)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setEdits(Object.fromEntries(
          res.products.map((p) => [p.id, p.deadlineDays?.toString() ?? ""])
        ));
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof ApiError ? err.message : "Erro ao carregar prazos.");
        setData(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [slug]);

  const alterados = data
    ? data.products.filter((p) => (edits[p.id] ?? "") !== (p.deadlineDays?.toString() ?? "")).length
    : 0;

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await api.put<DeadlinesResponse>(`/companies/${slug}/deadlines`, {
        deadlines: data.products.map((p) => ({
          product_id: Number(p.id),
          deadline_days: edits[p.id] ? Number(edits[p.id]) : null,
        })),
      });
      setData(res);
      setEdits(Object.fromEntries(
        res.products.map((p) => [p.id, p.deadlineDays?.toString() ?? ""])
      ));
      toast.success("Prazos salvos. Pedidos já abertos não foram alterados.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar prazos.");
    } finally {
      setSaving(false);
    }
  };

  const visiveis = (data?.products ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Cadastros</p>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Timer className="h-6 w-6 text-primary" />
            Prazos de alerta
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prazo de entrega de cada produto, por empresa. O alerta de atraso usa este valor.
          </p>
        </div>
        <Button variant="brand" onClick={handleSave} disabled={saving || !data || alterados === 0}>
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : alterados > 0 ? `Salvar (${alterados})` : "Salvar"}
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <Select value={slug} onValueChange={setSlug}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Escolha a empresa" /></SelectTrigger>
          <SelectContent>
            {empresasAtivas.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search}
                 onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card className="p-3 bg-primary/5 border-primary/20 flex gap-2.5 items-start">
        <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Em branco significa <strong className="text-foreground">usar o padrão de {data?.defaultDays ?? 7} dias úteis</strong> —
          preencha só as exceções. O prazo é congelado quando o pedido é criado, então alterar aqui
          <strong className="text-foreground"> não muda pedidos já abertos</strong>, só os próximos.
        </p>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : !data || data.products.length === 0 ? (
        <Card className="p-10 text-center bg-gradient-card">
          <Timer className="h-9 w-9 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">Nenhum produto vinculado a esta empresa.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Vincule produtos em Cadastros → Empresas antes de definir prazos.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visiveis.map((p, i) => {
            const valor  = edits[p.id] ?? "";
            const mudou  = valor !== (p.deadlineDays?.toString() ?? "");
            return (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                <Card className={`p-3 flex items-center gap-3 bg-gradient-card ${mudou ? "border-primary/40" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-muted-foreground">{p.code}</span>
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      {!p.active && <Badge variant="muted" className="text-[10px]">Inativo</Badge>}
                    </div>
                    <span className="text-[11px] text-muted-foreground">{p.category}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Input
                      type="number" min={1} max={365}
                      placeholder={String(data.defaultDays)}
                      value={valor}
                      onChange={(e) => setEdits((s) => ({ ...s, [p.id]: e.target.value }))}
                      className="w-20 text-center"
                    />
                    <span className="text-[11px] text-muted-foreground w-16">dias úteis</span>
                  </div>
                </Card>
              </motion.div>
            );
          })}
          {visiveis.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum produto encontrado para "{search}".
            </p>
          )}
        </div>
      )}
    </div>
  );
}
