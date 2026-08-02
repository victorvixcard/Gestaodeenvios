import { useState, useEffect } from "react";
import { Info, Building2, Timer } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "../../lib/api";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";

interface CompanyDeadline {
  slug: string;
  name: string;
  active: boolean;
  deadlineDays: number | null;
}

export interface DeadlineDraft {
  deadlineDays: string;
  companies: Record<string, string>;
}

interface Props {
  productId: string | null;
  draft: DeadlineDraft;
  onChange: (d: DeadlineDraft) => void;
}

/**
 * Aba "Prazo de alerta" do cadastro de produto.
 *
 * O prazo padrão vale para todas as empresas; as exceções por empresa existem
 * porque o mesmo produto pode ter prazo negociado diferente com cada cliente.
 * O estado sobe para o formulário do produto — quem grava é o Salvar do diálogo,
 * para não haver dois botões de salvar na mesma tela.
 */
export function ProductDeadlineTab({ productId, draft, onChange }: Props) {
  const [companies, setCompanies] = useState<CompanyDeadline[]>([]);
  const [defaultDays, setDefaultDays] = useState(7);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Produto novo ainda não tem empresas vinculadas nem id para consultar
    if (!productId) { setCompanies([]); return; }

    let cancelled = false;
    setLoading(true);

    api.get<{ defaultDays: number; deadlineDays: number | null; companies: CompanyDeadline[] }>(
      `/products/${productId}/deadlines`
    )
      .then((res) => {
        if (cancelled) return;
        setDefaultDays(res.defaultDays);
        setCompanies(res.companies);
        onChange({
          deadlineDays: res.deadlineDays?.toString() ?? "",
          companies: Object.fromEntries(
            res.companies.map((c) => [c.slug, c.deadlineDays?.toString() ?? ""])
          ),
        });
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.message : "Erro ao carregar prazos.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // onChange muda a cada render do pai; incluí-lo aqui recarregaria em loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const padraoEfetivo = draft.deadlineDays || String(defaultDays);

  if (!productId) {
    return (
      <Card className="p-8 text-center bg-gradient-card">
        <Timer className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium">Salve o produto primeiro</p>
        <p className="text-xs text-muted-foreground mt-1">
          O prazo por empresa fica disponível depois que o produto existe e é vinculado a alguma.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 bg-primary/5 border-primary/20 flex gap-2.5 items-start">
        <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Quantos dias úteis a produção leva. O alerta de atraso do pedido usa este valor.
          O prazo é <strong className="text-foreground">congelado quando o pedido é criado</strong> —
          alterar aqui não muda pedidos já abertos, só os próximos.
        </p>
      </Card>

      <div className="space-y-1.5">
        <Label>Prazo padrão deste produto</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number" min={1} max={365}
            placeholder={String(defaultDays)}
            value={draft.deadlineDays}
            onChange={(e) => onChange({ ...draft, deadlineDays: e.target.value })}
            className="w-24 text-center"
          />
          <span className="text-xs text-muted-foreground">
            dias úteis · em branco usa o padrão do sistema ({defaultDays})
          </span>
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Label className="mb-0">Exceções por empresa</Label>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Só preencha quem negociou prazo diferente. Em branco, a empresa usa os {padraoEfetivo} dias acima.
        </p>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <Card className="p-6 text-center bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Nenhuma empresa usa este produto ainda. Vincule em Cadastros → Empresas.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {companies.map((c) => (
              <div key={c.slug} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{c.name}</span>
                    {!c.active && <Badge variant="muted" className="text-[10px]">Inativa</Badge>}
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{c.slug}</span>
                </div>
                <Input
                  type="number" min={1} max={365}
                  placeholder={padraoEfetivo}
                  value={draft.companies[c.slug] ?? ""}
                  onChange={(e) => onChange({
                    ...draft,
                    companies: { ...draft.companies, [c.slug]: e.target.value },
                  })}
                  className="w-20 text-center flex-shrink-0"
                />
                <span className="text-[11px] text-muted-foreground w-16 flex-shrink-0">dias úteis</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
