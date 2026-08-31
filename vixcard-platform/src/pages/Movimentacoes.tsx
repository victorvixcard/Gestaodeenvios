import { useMemo, useState } from "react";
import { ArrowLeftRight, Search, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useOrders } from "../contexts/OrdersContext";
import { CreditosView } from "../components/shared/CreditosView";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

/**
 * Menu Movimentações — creditos de produto.
 *
 * Usuário de empresa: vê os saldos e o histórico da própria empresa
 * (somente leitura; quem lança é a VIXCard).
 * Super admin: escolhe a empresa (mais ativas + busca, mesmo padrão dos
 * relatórios) e pode lançar entradas e saídas.
 */
export function Movimentacoes() {
  const { user } = useAuth();
  const { companies } = useData();
  const { orders } = useOrders();
  const isSuperAdmin = user?.role === "super_admin";

  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // Empresas com mais pedidos primeiro — as que mais movimentam credito
  const TOP = 8;
  const maisAtivas = useMemo(() => {
    const contagem = new Map<string, number>();
    orders.forEach((o) => contagem.set(o.tenantSlug, (contagem.get(o.tenantSlug) ?? 0) + 1));
    return [...companies]
      .filter((c) => c.slug !== "vixcard")
      .sort((a, b) => (contagem.get(b.slug) ?? 0) - (contagem.get(a.slug) ?? 0))
      .slice(0, TOP);
  }, [companies, orders]);

  const encontradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q.length < 2) return [];
    return companies
      .filter((c) => c.slug !== "vixcard")
      .filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q))
      .slice(0, 8);
  }, [busca, companies]);

  const empresaAtual = companies.find((c) => c.slug === selecionada);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-extrabold flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-primary" />
          Movimentações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isSuperAdmin
            ? "Créditos de produto por empresa: entradas, saídas por OS e saldos."
            : "Seus créditos de produto: cada OS desconta do saldo; as entradas são lançadas pela VIXCard."}
        </p>
      </div>

      {isSuperAdmin && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {maisAtivas.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setSelecionada(selecionada === c.slug ? null : c.slug)}
                className={
                  selecionada === c.slug
                    ? "flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"
                    : "flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
                }
              >
                <span
                  className="h-5 w-5 rounded text-[9px] font-bold text-white flex items-center justify-center"
                  style={{ background: c.logoColor }}
                >
                  {c.logoInitials}
                </span>
                {c.name}
                {selecionada === c.slug && <X className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar outra empresa pelo nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {encontradas.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                {encontradas.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => { setSelecionada(c.slug); setBusca(""); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <span className="h-5 w-5 rounded text-[9px] font-bold text-white flex items-center justify-center flex-shrink-0"
                          style={{ background: c.logoColor }}>
                      {c.logoInitials}
                    </span>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {busca.trim().length >= 2 && encontradas.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">Nenhuma empresa com esse nome.</p>
            )}
          </div>
        </Card>
      )}

      {isSuperAdmin ? (
        selecionada ? (
          <div className="space-y-2">
            <button type="button" onClick={() => setSelecionada(null)} title="Remover seleção" className="inline-flex">
              <Badge variant="outline" className="px-3 py-1 gap-1.5 hover:bg-muted cursor-pointer">
                {empresaAtual?.name ?? selecionada}
                <X className="h-3 w-3" />
              </Badge>
            </button>
            <CreditosView key={selecionada} slug={selecionada} podeLancar />
          </div>
        ) : (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Escolha uma empresa acima para ver os saldos e o histórico.
          </Card>
        )
      ) : (
        <CreditosView slug={null} />
      )}
    </div>
  );
}
