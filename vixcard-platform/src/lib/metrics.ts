import { parseISO, differenceInMinutes } from "date-fns";
import type { Order, OrderStatus } from "../types";

/**
 * Métricas de tempo calculadas a partir dos eventos da OS. Cada mudança de
 * status gera um evento com timestamp, então dá para medir quanto tempo o
 * pedido levou entre quaisquer dois marcos sem coluna nova no banco.
 */

/** Momento do primeiro evento que levou a OS para o status dado. */
function quandoEntrouEm(order: Order, status: OrderStatus): Date | null {
  const ev = order.events.find(
    (e) => e.type === "status_change" && e.status === status
  );
  return ev ? parseISO(ev.createdAt) : null;
}

/** Horas entre a abertura da OS e a entrega (status done). Null se não entregue. */
export function horasAteEntrega(order: Order): number | null {
  const entregue = quandoEntrouEm(order, "done");
  if (!entregue) return null;
  return differenceInMinutes(entregue, parseISO(order.createdAt)) / 60;
}

/**
 * Horas entre o envio ao cliente (status shipped) e a entrega. Null quando a
 * OS não passou pelos dois marcos — fluxos sem a etapa de envio ficam de fora
 * da média em vez de puxá-la para zero.
 */
export function horasEnvioAteEntrega(order: Order): number | null {
  const enviado = quandoEntrouEm(order, "shipped");
  const entregue = quandoEntrouEm(order, "done");
  if (!enviado || !entregue) return null;
  return differenceInMinutes(entregue, enviado) / 60;
}

/** Média simples ignorando nulls; null quando não há amostras. */
export function media(valores: (number | null)[]): number | null {
  const validos = valores.filter((v): v is number => v !== null && v >= 0);
  if (validos.length === 0) return null;
  return validos.reduce((s, v) => s + v, 0) / validos.length;
}

/** "3d 4h", "18h", "45min" — ou "—" sem amostra. */
export function formatDuracao(horas: number | null): string {
  if (horas === null) return "—";
  if (horas < 1) return `${Math.round(horas * 60)}min`;
  const dias = Math.floor(horas / 24);
  const resto = Math.round(horas % 24);
  if (dias === 0) return `${resto}h`;
  return resto === 0 ? `${dias}d` : `${dias}d ${resto}h`;
}
