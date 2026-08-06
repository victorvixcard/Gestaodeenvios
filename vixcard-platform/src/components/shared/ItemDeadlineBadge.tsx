import { Siren, Clock, AlertTriangle } from "lucide-react";
import type { OrderItem } from "../../types";
import { itemStatus, formatDeadline, formatDeadlineCurto, summarize, type ItemStatus } from "../../lib/itemDeadline";
import { cn } from "../../lib/utils";

const STYLE: Record<ItemStatus, string> = {
  overdue: "border-red-400 bg-red-50 text-red-700",
  today:   "border-amber-400 bg-amber-50 text-amber-700",
  soon:    "border-amber-300 bg-amber-50/60 text-amber-700",
  ok:      "border-emerald-200 bg-emerald-50 text-emerald-700",
  done:    "border-border bg-muted/40 text-muted-foreground",
};

function suffix(item: OrderItem, status: ItemStatus): string | null {
  if (status === "overdue") return `${item.overdueDays}d atraso`;
  if (status === "today")   return "vence hoje";
  if (status === "done")    return null;
  return item.deadlineDays ? `${item.deadlineDays}d` : null;
}

/**
 * Badge do produto dentro do card do pedido. O nome do produto já aparecia
 * ali — agora ele mesmo carrega a cor e o prazo, em vez de um alerta único
 * para o pedido inteiro que não dizia qual item atrasou.
 */
export function ItemDeadlineBadge({
  item, orderStatus, className,
}: { item: OrderItem; orderStatus: string; className?: string }) {
  const status = itemStatus(item, orderStatus);
  const extra  = suffix(item, status);

  return (
    <span
      title={`${item.productName} ×${item.quantity.toLocaleString("pt-BR")}${
        item.deadline ? ` — prazo: ${formatDeadline(item.deadline)}` : ""
      }`}
      className={cn(
        // max-w-full + min-w-0: sem isso o badge cresce com o conteudo e
        // vaza para a coluna vizinha no Kanban, que e estreita.
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium max-w-full min-w-0",
        STYLE[status],
        className
      )}
    >
      {status === "overdue" && <Siren className="h-3 w-3 flex-shrink-0" />}
      {status === "today"   && <AlertTriangle className="h-3 w-3 flex-shrink-0" />}
      {/* Só o nome encolhe; quantidade e prazo sao curtos e ficam inteiros */}
      <span className="truncate min-w-0">{item.productName}</span>
      <span className="opacity-60 flex-shrink-0">×{item.quantity.toLocaleString("pt-BR")}</span>
      {extra && <span className="opacity-80 flex-shrink-0 whitespace-nowrap">· {extra}</span>}
    </span>
  );
}

const LABEL: Record<ItemStatus, string> = {
  overdue: "Em atraso",
  today:   "Vence hoje",
  soon:    "Perto do prazo",
  ok:      "No prazo",
  done:    "Encerrado",
};

/** Selo compacto de situação, usado no detalhe do pedido. */
export function ItemDeadlineStatus({
  item, orderStatus,
}: { item: OrderItem; orderStatus: string }) {
  const status = itemStatus(item, orderStatus);
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
      STYLE[status]
    )}>
      {status === "overdue" && <Siren className="h-3 w-3" />}
      {status === "today"   && <AlertTriangle className="h-3 w-3" />}
      {LABEL[status]}
      {status === "overdue" && <span className="font-normal">· {item.overdueDays}d</span>}
    </span>
  );
}

/** Chip de resumo: quantos itens atrasaram e qual é o pior. */
export function OrderDeadlineSummary({
  items, orderStatus, className,
}: { items: OrderItem[]; orderStatus: string; className?: string }) {
  const s = summarize(items, orderStatus);

  if (s.total === 0) return null;

  // max-w-full + min-w-0 em todos: o chip precisa caber na coluna estreita do
  // Kanban. O trecho variável (nome do produto) trunca; o resto fica inteiro.
  const base = "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold max-w-full min-w-0";

  if (s.status === "done") {
    return (
      <span className={cn(base, "border-border bg-muted/40 text-muted-foreground", className)}>
        <Clock className="h-3 w-3 flex-shrink-0" />Encerrado
      </span>
    );
  }

  if (s.status === "overdue" && s.worst) {
    return (
      <span
        title={`Pior atraso: ${s.worst.productName} (${s.worst.overdueDays} dias)`}
        className={cn(base, "border-2 border-red-400 bg-red-50 text-red-700 font-bold", className)}
      >
        <Siren className="h-3.5 w-3.5 flex-shrink-0 text-red-600" />
        <span className="flex-shrink-0 whitespace-nowrap">
          {s.overdue === s.total
            ? `Todos os ${s.total} em atraso`
            : `${s.overdue} de ${s.total} em atraso`}
        </span>
        <span className="font-normal opacity-75 truncate min-w-0">
          · {s.worst.productName} ({s.worst.overdueDays}d)
        </span>
      </span>
    );
  }

  if (!s.nextDue) return null;

  const proximo = s.status === "today" || s.status === "soon";
  return (
    <span
      title={`Próximo vencimento: ${formatDeadline(s.nextDue.deadline)} — ${s.nextDue.productName}`}
      className={cn(
        base,
        proximo ? "border-amber-300 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
        className
      )}
    >
      {proximo
        ? <AlertTriangle className="h-3 w-3 flex-shrink-0" />
        : <Clock className="h-3 w-3 flex-shrink-0" />}
      {/* Data curta: por extenso nao cabe na coluna do Kanban. A completa
          esta no title, junto do nome do produto. */}
      <span className="flex-shrink-0 whitespace-nowrap">
        {formatDeadlineCurto(s.nextDue.deadline)}
      </span>
      <span className="font-normal opacity-70 truncate min-w-0">· {s.nextDue.productName}</span>
    </span>
  );
}
