import { useState, useEffect, useCallback } from "react";
import { Info, Search, Save, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "../../lib/api";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface ProdutoRow {
  id: string;
  code: string;
  name: string;
  category: string;
  active: boolean;
  defaultDeadline: number | null;
  defaultPrice: number | null;
  deadlineDays: number | null;
  price: number | null;
}

interface Resposta {
  companyName: string;
  defaultDays: number;
  total: number;
  products: ProdutoRow[];
  pagina: number;
  totalPaginas: number;
}

type Draft = Record<string, { deadlineDays: string; price: string }>;

/**
 * Aba "Prazos" dentro da empresa: prazo de cada produto liberado
 * para ela. É o fluxo inverso da aba do produto — aqui se configura o contrato
 * de um cliente inteiro numa tela só, que é como a negociação acontece.
 */
export function CompanyCatalogTab({ slug }: { slug: string }) {
  const [dados, setDados]     = useState<Resposta | null>(null);
  const [draft, setDraft]     = useState<Draft>({});
  const [busca, setBusca]     = useState("");
  const [pagina, setPagina]   = useState(1);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async (p: number, termo: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p) });
      if (termo) qs.set("search", termo);
      const res = await api.get<Resposta>(`/companies/${slug}/catalog?${qs}`);
      setDados(res);
      setDraft(Object.fromEntries(res.products.map((p) => [p.id, {
        deadlineDays: p.deadlineDays?.toString() ?? "",
        price: p.price?.toString() ?? "",
      }])));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar o catálogo.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { carregar(1, ""); }, [carregar]);

  useEffect(() => {
    const t = setTimeout(() => { setPagina(1); carregar(1, busca); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const alterados = dados
    ? dados.products.filter((p) => {
        const v = draft[p.id];
        if (!v) return false;
        return v.deadlineDays !== (p.deadlineDays?.toString() ?? "");
      }).length
    : 0;

  const salvar = async () => {
    if (!dados) return;
    setSalvando(true);
    try {
      const res = await api.put<Resposta>(`/companies/${slug}/catalog`, {
        products: dados.products.map((p) => ({
          product_id: Number(p.id),
          // Preco fora da interface por decisao do Victor: nao e enviado e o
          // backend so mexe nele quando a chave vem na requisicao
          deadline_days: draft[p.id]?.deadlineDays ? Number(draft[p.id].deadlineDays) : null,
        })),
      });
      setDados(res);
      setDraft(Object.fromEntries(res.products.map((p) => [p.id, {
        deadlineDays: p.deadlineDays?.toString() ?? "",
        price: p.price?.toString() ?? "",
      }])));
      toast.success("Catálogo salvo. Pedidos já abertos não foram alterados.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar o catálogo.");
    } finally {
      setSalvando(false);
    }
  };

  const set = (id: string, campo: "deadlineDays" | "price", valor: string) =>
    setDraft((d) => ({ ...d, [id]: { ...(d[id] ?? { deadlineDays: "", price: "" }), [campo]: valor } }));

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-3 bg-primary/5 border-primary/20 flex gap-2.5 items-start">
        <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Prazo de entrega que esta empresa pratica em cada produto. Em branco usa o
          padrão do produto. O prazo é <strong className="text-foreground">congelado no
          momento do pedido</strong> — mudar aqui só afeta os próximos.
        </p>
      </Card>

      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto por nome ou código..." value={busca}
                 onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
        {dados && <Badge variant="muted" className="text-[10px]">{dados.total} produto(s)</Badge>}
        <Button variant="brand" size="sm" onClick={salvar} disabled={salvando || alterados === 0}>
          <Save className="h-4 w-4" />
          {salvando ? "Salvando..." : alterados > 0 ? `Salvar (${alterados})` : "Salvar"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : !dados || dados.products.length === 0 ? (
        <Card className="p-10 text-center bg-gradient-card">
          <PackageSearch className="h-9 w-9 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">
            {busca ? "Nenhum produto encontrado." : "Nenhum produto liberado para esta empresa."}
          </p>
          {!busca && (
            <p className="text-xs text-muted-foreground mt-1">
              Libere produtos na aba Produtos antes de definir o prazo.
            </p>
          )}
        </Card>
      ) : (
        <>
          <div className="hidden sm:flex items-center gap-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <span className="flex-1">Produto</span>
            <span className="w-16 text-center">Prazo</span>
            <span className="w-8" />
          </div>

          <div className="space-y-1.5">
            {dados.products.map((p) => {
              const v = draft[p.id] ?? { deadlineDays: "", price: "" };
              const mudou = v.deadlineDays !== (p.deadlineDays?.toString() ?? "");
              return (
                <Card key={p.id} className={`p-2.5 flex items-center gap-2 bg-gradient-card ${mudou ? "border-primary/40" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      {!p.active && <Badge variant="muted" className="text-[9px]">Inativo</Badge>}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{p.code} · {p.category}</span>
                  </div>
                  <Input type="number" min={1} max={365}
                         placeholder={String(p.defaultDeadline ?? dados.defaultDays)}
                         value={v.deadlineDays}
                         onChange={(e) => set(p.id, "deadlineDays", e.target.value)}
                         className="w-16 text-center h-9 flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground w-8 flex-shrink-0">dias</span>
                </Card>
              );
            })}
          </div>

          {dados.totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={pagina <= 1}
                      onClick={() => { const p = pagina - 1; setPagina(p); carregar(p, busca); }}>
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">{dados.pagina} / {dados.totalPaginas}</span>
              <Button variant="outline" size="sm" disabled={pagina >= dados.totalPaginas}
                      onClick={() => { const p = pagina + 1; setPagina(p); carregar(p, busca); }}>
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
