import { Siren, Clock, AlertTriangle } from "lucide-react";
import type { OrderItem } from "../../types";
import { itemStatus, formatDeadline, summarize, type ItemStatus } from "../../lib/itemDeadline";
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
      title={item.deadline ? `Prazo: ${formatDeadline(item.deadline)}` : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        STYLE[status],
        className
      )}
    >
      {status === "overdue" && <Siren className="h-3 w-3 flex-shrink-0" />}
      {status === "today"   && <AlertTriangle className="h-3 w-3 flex-shrink-0" />}
      <span className="truncate max-w-[190px]">{item.productName}</span>
      <span className="opacity-60">×{item.quantity.toLocaleString("pt-BR")}</span>
      {extra && <span className="opacity-80">· {extra}</span>}
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

  if (s.status === "done") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground", className)}>
        <Clock className="h-3 w-3" />Encerrado
      </span>
    );
  }

  if (s.status === "overdue" && s.worst) {
    return (
      <span className={cn("inline-flex items-center gap-2 rounded-lg border-2 border-red-400 bg-red-50 px-3 py-1.5 text-[12px] font-bold text-red-700", className)}>
        <Siren className="h-4 w-4 flex-shrink-0 text-red-600" />
        {s.overdue === s.total
          ? <>TODOS os {s.total} itens em atraso</>
          : <>{s.overdue} de {s.total} {s.total === 1 ? "item" : "itens"} em atraso</>}
        <span className="font-normal opacity-75">
          · pior: {s.worst.productName} ({s.worst.overdueDays}d)
        </span>
      </span>
    );
  }

  if (!s.nextDue) return null;

  const proximo = s.status === "today" || s.status === "soon";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold",
      proximo ? "border-amber-300 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
      className
    )}>
      {proximo ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      Próximo: {formatDeadline(s.nextDue.deadline)}
      <span className="font-normal opacity-70">· {s.nextDue.productName}</span>
    </span>
  );
}
