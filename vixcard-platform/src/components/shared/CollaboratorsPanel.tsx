import { Users as UsersIcon, X } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import type { Company, User } from "../../types";

/**
 * Seleção do painel: um colaborador específico, um setor inteiro, ou nada
 * (todas as OS). Vive na página (Pedidos/Kanban) para o filtro acompanhar.
 */
export type SelecaoColab =
  | { tipo: "user"; id: string }
  | { tipo: "setor"; id: string }
  | null;

/** Empresas atendidas por um colaborador. */
export function empresasDoUsuario(companies: Company[], userId: string): Set<string> {
  return new Set(companies.filter((c) => c.attendantIds.includes(userId)).map((c) => c.slug));
}

/** Empresas atendidas por qualquer colaborador de um setor. */
export function empresasDoSetor(companies: Company[], users: User[], sectorId: string): Set<string> {
  const ids = users.filter((u) => u.sectors.some((s) => s.id === sectorId)).map((u) => u.id);
  return new Set(
    companies.filter((c) => c.attendantIds.some((a) => ids.includes(a))).map((c) => c.slug)
  );
}

/** Aplica a seleção do painel a uma lista de slugs de tenant. */
export function tenantPassaNoFiltro(
  selecao: SelecaoColab,
  tenantSlug: string,
  companies: Company[],
  users: User[]
): boolean {
  if (!selecao) return true;
  const slugs = selecao.tipo === "user"
    ? empresasDoUsuario(companies, selecao.id)
    : empresasDoSetor(companies, users, selecao.id);
  return slugs.has(tenantSlug);
}

/**
 * Painel lateral com os colaboradores agrupados por setor (o desenho do
 * Paint do Victor). Clicar num nome mostra só as OS das empresas que aquela
 * pessoa atende; "Visualizar todos" faz o mesmo para o setor inteiro.
 * Um colaborador em dois setores aparece nos dois — é o mesmo filtro.
 */
export function CollaboratorsPanel({ selecao, onChange, contadorOs }: {
  selecao: SelecaoColab;
  onChange: (s: SelecaoColab) => void;
  /** Quantas OS visíveis cada colaborador tem (por id). Opcional. */
  contadorOs?: (userId: string) => number;
}) {
  const { users, sectors } = useData();

  const colaboradores = users.filter((u) => u.tenantSlug === "vixcard" && u.active);

  const grupos = sectors
    .filter((s) => s.active)
    .map((s) => ({
      setor: s,
      pessoas: colaboradores.filter((u) => u.sectors.some((x) => x.id === s.id)),
    }))
    .filter((g) => g.pessoas.length > 0);

  const semSetor = colaboradores.filter((u) => u.sectors.length === 0);

  if (colaboradores.length === 0) return null;

  return (
    <aside className="hidden lg:block w-[200px] flex-shrink-0">
      <Card className="p-3 sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground flex items-center gap-1.5">
            <UsersIcon className="h-3 w-3" />
            Equipe
          </p>
          {selecao && (
            <button
              onClick={() => onChange(null)}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
            >
              <X className="h-2.5 w-2.5" />
              Limpar
            </button>
          )}
        </div>

        <div className="space-y-3">
          {grupos.map(({ setor, pessoas }) => {
            const setorAtivo = selecao?.tipo === "setor" && selecao.id === setor.id;
            return (
              <div key={setor.id}>
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wide mb-1">
                  {setor.name}
                </p>
                <div className="space-y-0.5">
                  {pessoas.map((u) => {
                    const ativo = selecao?.tipo === "user" && selecao.id === u.id;
                    const n = contadorOs?.(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => onChange(ativo ? null : { tipo: "user", id: u.id })}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-all",
                          ativo
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "hover:bg-muted text-foreground/80"
                        )}
                      >
                        <span className="truncate flex-1">{u.name.split(" ")[0]}</span>
                        {typeof n === "number" && n > 0 && (
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-px rounded-full tabular-nums flex-shrink-0",
                            ativo ? "bg-white/20" : "bg-muted text-muted-foreground"
                          )}>
                            {n}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => onChange(setorAtivo ? null : { tipo: "setor", id: setor.id })}
                    className={cn(
                      "w-full px-2 py-1 rounded-md text-left text-[10px] transition-all",
                      setorAtivo
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    Visualizar todos
                  </button>
                </div>
              </div>
            );
          })}

          {semSetor.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wide mb-1">
                Sem setor
              </p>
              <div className="space-y-0.5">
                {semSetor.map((u) => {
                  const ativo = selecao?.tipo === "user" && selecao.id === u.id;
                  const n = contadorOs?.(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => onChange(ativo ? null : { tipo: "user", id: u.id })}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-all",
                        ativo
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "hover:bg-muted text-foreground/80"
                      )}
                    >
                      <span className="truncate flex-1">{u.name.split(" ")[0]}</span>
                      {typeof n === "number" && n > 0 && (
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-px rounded-full tabular-nums flex-shrink-0",
                          ativo ? "bg-white/20" : "bg-muted text-muted-foreground"
                        )}>
                          {n}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Card>
    </aside>
  );
}
