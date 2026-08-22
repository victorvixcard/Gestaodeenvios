import { cn } from "../../lib/utils";
import type { OrderStatus } from "../../types";

export type StatusFilterValue = OrderStatus | "all" | "overdue";

/**
 * Filtro de status em botões, compartilhado por Pedidos e Kanban.
 *
 * Substituiu o dropdown: com 8 opções fixas, um clique direto é mais rápido
 * que abrir uma lista — e a cor de cada chip já diz o que ele filtra antes
 * de ler o rótulo. As cores seguem as colunas do Kanban.
 */
const CHIPS: { key: StatusFilterValue; label: string; ativo: string; dot?: string }[] = [
  { key: "all",        label: "Todos",       ativo: "bg-foreground text-background border-foreground" },
  { key: "overdue",    label: "Em Atraso",   ativo: "bg-red-600 text-white border-red-600",         dot: "bg-red-500" },
  { key: "pending",    label: "Pendente",    ativo: "bg-slate-600 text-white border-slate-600",     dot: "bg-slate-400" },
  { key: "started",    label: "Iniciado",    ativo: "bg-blue-600 text-white border-blue-600",       dot: "bg-blue-500" },
  { key: "production", label: "Em Produção", ativo: "bg-violet-600 text-white border-violet-600",   dot: "bg-violet-500" },
  { key: "finishing",  label: "Acabamento",  ativo: "bg-amber-500 text-white border-amber-500",     dot: "bg-amber-400" },
  { key: "shipped",    label: "Enviado",     ativo: "bg-cyan-600 text-white border-cyan-600",       dot: "bg-cyan-500" },
  { key: "done",       label: "Finalizado",  ativo: "bg-emerald-600 text-white border-emerald-600", dot: "bg-emerald-500" },
  { key: "cancelled",  label: "Cancelado",   ativo: "bg-zinc-600 text-white border-zinc-600",       dot: "bg-zinc-400" },
];

export const STATUS_FILTER_LABELS: Record<StatusFilterValue, string> =
  Object.fromEntries(CHIPS.map((c) => [c.key, c.label])) as Record<StatusFilterValue, string>;

export function StatusFilterChips({ value, onChange, counts }: {
  value: string;
  onChange: (v: StatusFilterValue) => void;
  counts?: Partial<Record<StatusFilterValue, number>>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CHIPS.map((chip) => {
        const n = counts?.[chip.key] ?? 0;
        const selecionado = value === chip.key;
        return (
          <button
            key={chip.key}
            onClick={() => onChange(chip.key)}
            aria-pressed={selecionado}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
              selecionado
                ? cn(chip.ativo, "shadow-sm")
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {chip.dot && (
              <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0",
                selecionado ? "bg-white/80" : chip.dot)} />
            )}
            {chip.label}
            {n > 0 && (
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-px rounded-full tabular-nums",
                selecionado ? "bg-white/20" : "bg-muted text-muted-foreground"
              )}>
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
