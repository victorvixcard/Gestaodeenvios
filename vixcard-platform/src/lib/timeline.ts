import type React from "react";
import {
  ClipboardCheck, Play, Wrench, PackageCheck, Truck, CheckCircle2,
} from "lucide-react";
import type { Order, OrderStatus, TimelineStep } from "../types";

/**
 * Fluxo padrão de etapas — o mesmo DEFAULT_TIMELINE do backend. Pedido sem
 * fluxo próprio (timeline null) usa este; pedido com fluxo congelado usa o
 * dele, sempre.
 */
export const DEFAULT_TIMELINE: TimelineStep[] = [
  { status: "pending",    label: "Recebido" },
  { status: "started",    label: "Iniciado" },
  { status: "production", label: "Produção" },
  { status: "finishing",  label: "Acabamento" },
  { status: "shipped",    label: "Envio ao cliente" },
  { status: "done",       label: "Entregue" },
];

/** Ordem canônica dos status de produção (sem cancelled). */
export const CANONICAL_ORDER: OrderStatus[] = [
  "pending", "started", "production", "finishing", "shipped", "done",
];

export const STATUS_ICON: Record<Exclude<OrderStatus, "cancelled">, React.ElementType> = {
  pending:    ClipboardCheck,
  started:    Play,
  production: Wrench,
  finishing:  PackageCheck,
  shipped:    Truck,
  done:       CheckCircle2,
};

/** Fluxo de um pedido (o congelado nele, ou o padrão). */
export function orderTimeline(order: Pick<Order, "timeline">): TimelineStep[] {
  return order.timeline?.length ? order.timeline : DEFAULT_TIMELINE;
}

/**
 * Posição de uma etapa em relação ao status atual do pedido, pela ordem
 * canônica — assim um status que não está no fluxo do pedido (ex.: OS antiga
 * num fluxo novo) ainda pinta as etapas anteriores como concluídas.
 */
export function stepState(step: TimelineStep, status: OrderStatus): "done" | "current" | "pending" {
  const atual = CANONICAL_ORDER.indexOf(status);
  const daEtapa = CANONICAL_ORDER.indexOf(step.status);
  if (daEtapa < atual) return "done";
  if (daEtapa === atual) return "current";
  return "pending";
}
