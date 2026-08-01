import type { OrderItem } from "../types";

export type ItemStatus = "overdue" | "today" | "soon" | "ok" | "done";

/**
 * Situação do prazo de um item. Usa exclusivamente o que o backend mandou —
 * nada é recalculado aqui. Antes a tela refazia a conta a partir do createdAt
 * e divergia do banco por causa do fuso (servidor UTC, navegador BRT).
 */
export function itemStatus(item: OrderItem, orderStatus: string): ItemStatus {
  if (orderStatus === "done" || orderStatus === "cancelled") return "done";
  if (!item.deadline) return "ok";
  if (item.isOverdue) return "overdue";

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  // "2026-08-04" -> data local, sem passar pelo parser UTC do Date
  const [a, m, d] = item.deadline.split("-").map(Number);
  const prazo = new Date(a, m - 1, d);

  const dias = Math.round((prazo.getTime() - hoje.getTime()) / 86400000);
  if (dias <= 0) return "today";
  if (dias <= 2) return "soon";
  return "ok";
}

export function formatDeadline(iso?: string): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

/** Pedido está em atraso quando pelo menos um item passou do prazo. */
export function orderIsOverdue(
  items: OrderItem[], orderStatus: string
): boolean {
  if (orderStatus === "done" || orderStatus === "cancelled") return false;
  return items.some((i) => i.isOverdue);
}

export interface DeadlineSummary {
  total: number;
  overdue: number;
  worst: OrderItem | null;
  nextDue: OrderItem | null;
  status: ItemStatus;
}

/** Consolida os itens para o chip de resumo do card do pedido. */
export function summarize(items: OrderItem[], orderStatus: string): DeadlineSummary {
  const base: DeadlineSummary = {
    total: items.length, overdue: 0, worst: null, nextDue: null, status: "ok",
  };

  if (orderStatus === "done" || orderStatus === "cancelled") {
    return { ...base, status: "done" };
  }

  const atrasados = items.filter((i) => itemStatus(i, orderStatus) === "overdue");

  if (atrasados.length > 0) {
    const worst = atrasados.reduce((a, b) =>
      (b.overdueDays ?? 0) > (a.overdueDays ?? 0) ? b : a
    );
    return { ...base, overdue: atrasados.length, worst, status: "overdue" };
  }

  // Ninguém atrasado: o chip mostra o próximo vencimento
  const comPrazo = items.filter((i) => i.deadline);
  if (comPrazo.length === 0) return base;

  const nextDue = comPrazo.reduce((a, b) => (b.deadline! < a.deadline! ? b : a));
  return { ...base, nextDue, status: itemStatus(nextDue, orderStatus) };
}
