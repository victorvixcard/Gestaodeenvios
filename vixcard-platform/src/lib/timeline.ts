import type React from "react";
import {
  ClipboardCheck, Play, Wrench, PackageCheck, Truck, CheckCircle2,
} from "lucide-react";
import type { Order, Fase, TimelineStep } from "../types";

/**
 * Fluxo padrão de etapas — o mesmo DEFAULT_TIMELINE do backend. Pedido sem
 * fluxo próprio (timeline null) usa este; pedido com fluxo congelado usa o
 * dele, sempre. Etapas padrão têm key igual ao nome da fase, o que mantém
 * compatível tudo que foi criado antes das etapas livres.
 */
export const DEFAULT_TIMELINE: TimelineStep[] = [
  { key: "pending",    label: "Recebido",         fase: "pending" },
  { key: "started",    label: "Iniciado",         fase: "started" },
  { key: "production", label: "Produção",         fase: "production" },
  { key: "finishing",  label: "Acabamento",       fase: "finishing" },
  { key: "shipped",    label: "Envio ao cliente", fase: "shipped" },
  { key: "done",       label: "Entregue",         fase: "done" },
];

/** Ordem canônica das fases de produção (sem cancelled). */
export const CANONICAL_ORDER: Fase[] = [
  "pending", "started", "production", "finishing", "shipped", "done",
];

/** Ícone por FASE — etapas personalizadas herdam o ícone da fase delas. */
export const STATUS_ICON: Record<Fase, React.ElementType> = {
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
 * Posição de uma etapa em relação ao ponto atual do pedido. Compara pela
 * posição das CHAVES dentro do próprio fluxo; se a chave atual não estiver
 * no fluxo (OS antiga, status canônico), cai na comparação por fase.
 */
export function stepState(
  step: TimelineStep,
  order: Pick<Order, "status" | "statusFase" | "timeline">
): "done" | "current" | "pending" {
  const steps = orderTimeline(order);
  const atualIdx = steps.findIndex((s) => s.key === order.status);
  const etapaIdx = steps.findIndex((s) => s.key === step.key);

  if (atualIdx >= 0 && etapaIdx >= 0) {
    if (etapaIdx < atualIdx) return "done";
    if (etapaIdx === atualIdx) return "current";
    return "pending";
  }

  // Fallback por fase canônica (chave atual fora do fluxo)
  const atualFase = CANONICAL_ORDER.indexOf(order.statusFase as Fase);
  const etapaFase = CANONICAL_ORDER.indexOf(step.fase);
  if (etapaFase < atualFase) return "done";
  if (etapaFase === atualFase) return "current";
  return "pending";
}
