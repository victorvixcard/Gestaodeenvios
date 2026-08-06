import { useState, useEffect, useCallback } from "react";
import { Info, Building2, Timer, Search } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "../../lib/api";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface CompanyRow {
  slug: string;
  name: string;
  active: boolean;
  deadlineDays: number | null;
  price: number | null;
}

interface Resposta {
  defaultDays: number;
  deadlineDays: number | null;
  price: number | null;
  totalVinculos: number;
  totalExcecoes: number;
  companies: CompanyRow[];
  pagina: number;
  totalPaginas: number;
}

export interface DeadlineDraft {
  deadlineDays: string;
  price: string;
  companies: Record<string, { deadlineDays: string; price: string }>;
}

export const DRAFT_VAZIO: DeadlineDraft = { deadlineDays: "", price: "", companies: {} };

interface Props {
  productId: string | null;
  draft: DeadlineDraft;
  onChange: (d: DeadlineDraft) => void;
}

/**
 * Aba "Prazo de alerta" do cadastro de produto.
 *
 * Padrão do produto no topo; abaixo, o que cada empresa negociou. A lista é
 * paginada e filtrável porque o mesmo produto pode estar liberado para
 * milhares de empresas — carregar todas travaria a tela.
 *
 * O estado sobe para o formulário do produto: quem grava é o Salvar do
 * diálogo, para não haver dois botões de salvar na mesma tela.
 */
export function ProductDeadlineTab({ productId, draft, onChange }: Props) {
  const [dados, setDados]     = useState<Resposta | null>(null);
  const [busca, setBusca]     = useState("");
  const [soExcecoes, setSoExcecoes] = useState(false);
  const [pagina, setPagina]   = useState(1);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async (p: number, termo: string, apenasExc: boolean) => {
    if (!productId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p) });
      if (termo) qs.set("search", termo);
      if (apenasExc) qs.set("only_overrides", "1");

      const res = await api.get<Resposta>(`/products/${productId}/deadlines?${qs}`);
      setDados(res);

      // Só semeia o rascunho com o que ainda não foi editado nesta sessão,
      // para não descartar alteração pendente ao trocar de página.
      onChange({
        deadlineDays: draft.deadlineDays || (res.deadlineDays?.toString() ?? ""),
        price: draft.price || (res.price?.toString() ?? ""),
        companies: {
          ...Object.fromEntries(res.companies.map((c) => [c.slug, {
            deadlineDays: c.deadlineDays?.toString() ?? "",
            price: c.price?.toString() ?? "",
          }])),
          ...draft.companies,
        },
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar prazos.");
    } finally {
      setLoading(false);
    }
    // draft entra desatualizado de proposito: incluí-lo recarregaria a cada tecla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => { carregar(1, "", false); }, [carregar]);

  // Busca com atraso, para não disparar uma requisição por tecla digitada
  useEffect(() => {
    if (!productId) return;
    const t = setTimeout(() => { setPagina(1); carregar(1, busca, soExcecoes); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, soExcecoes]);

  const setEmpresa = (slug: string, campo: "deadlineDays" | "price", valor: string) =>
    onChange({
      ...draft,
      companies: {
        ...draft.companies,
        [slug]: { ...(draft.companies[slug] ?? { deadlineDays: "", price: "" }), [campo]: valor },
      },
    });

  if (!productId) {
    return (
      <Card className="p-8 text-center bg-gradient-card">
        <Timer className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium">Salve o produto primeiro</p>
        <p className="text-xs text-muted-foreground mt-1">
          Prazo e preço por empresa ficam disponíveis depois que o produto existe.
        </p>
      </Card>
    );
  }

  const padraoDias  = draft.deadlineDays || String(dados?.defaultDays ?? 7);
  const padraoPreco = draft.price || (dados?.price?.toString() ?? "");

  return (
    <div className="space-y-4">
      <Card className="p-3 bg-primary/5 border-primary/20 flex gap-2.5 items-start">
        <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Prazo e preço são <strong className="text-foreground">congelados quando o pedido é criado</strong> —
          alterar aqui não muda pedidos já abertos, só os próximos.
        </p>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Prazo padrão</Label>
          <div className="flex items-center gap-2">
            <Input type="number" min={1} max={365} className="w-24 text-center"
                   placeholder={String(dados?.defaultDays ?? 7)}
                   value={draft.deadlineDays}
                   onChange={(e) => onChange({ ...draft, deadlineDays: e.target.value })} />
            <span className="text-xs text-muted-foreground">dias úteis</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Preço padrão</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">R$</span>
            <Input type="number" min={0} step="0.01" className="w-28 text-center"
                   placeholder="0,00"
                   value={draft.price}
                   onChange={(e) => onChange({ ...draft, price: e.target.value })} />
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Valem para todas as empresas que não tenham valor próprio abaixo.
      </p>

      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Label className="mb-0">Por empresa</Label>
          {dados && (
            <Badge variant="muted" className="text-[10px]">
              {dados.totalExcecoes} de {dados.totalVinculos} com valor próprio
            </Badge>
          )}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[170px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar empresa..." value={busca}
                   onChange={(e) => setBusca(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          <Button type="button" variant={soExcecoes ? "brand" : "outline"} size="sm"
                  onClick={() => setSoExcecoes((v) => !v)}>
            Só as negociadas
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !dados || dados.companies.length === 0 ? (
          <Card className="p-6 text-center bg-muted/30">
            <p className="text-xs text-muted-foreground">
              {busca || soExcecoes
                ? "Nenhuma empresa encontrada com esse filtro."
                : "Nenhuma empresa usa este produto ainda. Vincule em Cadastros → Empresas."}
            </p>
          </Card>
        ) : (
          <>
            <div className="space-y-1.5">
              {dados.companies.map((c) => {
                const v = draft.companies[c.slug] ?? { deadlineDays: "", price: "" };
                return (
                  <div key={c.slug} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{c.name}</span>
                        {!c.active && <Badge variant="muted" className="text-[9px]">Inativa</Badge>}
                      </div>
                    </div>
                    <Input type="number" min={1} max={365} placeholder={padraoDias}
                           value={v.deadlineDays}
                           onChange={(e) => setEmpresa(c.slug, "deadlineDays", e.target.value)}
                           className="w-16 text-center h-8 text-sm flex-shrink-0" />
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">dias</span>
                    <Input type="number" min={0} step="0.01" placeholder={padraoPreco || "0,00"}
                           value={v.price}
                           onChange={(e) => setEmpresa(c.slug, "price", e.target.value)}
                           className="w-24 text-center h-8 text-sm flex-shrink-0" />
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">R$</span>
                  </div>
                );
              })}
            </div>

            {dados.totalPaginas > 1 && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" disabled={pagina <= 1}
                        onClick={() => { const p = pagina - 1; setPagina(p); carregar(p, busca, soExcecoes); }}>
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  {dados.pagina} / {dados.totalPaginas}
                </span>
                <Button type="button" variant="outline" size="sm" disabled={pagina >= dados.totalPaginas}
                        onClick={() => { const p = pagina + 1; setPagina(p); carregar(p, busca, soExcecoes); }}>
                  Próxima
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
