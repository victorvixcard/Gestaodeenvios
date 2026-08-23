import { cn } from "../../lib/utils";
import type { OrderStatus } from "../../types";

/**
 * Badge de status. A COR vem da fase canônica (variáveis --status-*); o
 * TEXTO vem do rótulo da etapa do pedido — que pode ser personalizado por
 * empresa ("Aprovação da arte"). Sem label, usa o nome padrão da fase.
 */
const FASE_CONFIG: Record<OrderStatus, { label: string; active: boolean }> = {
  pending:    { label: "Pendente",     active: false },
  started:    { label: "Iniciado",     active: true  },
  production: { label: "Em Produção",  active: true  },
  finishing:  { label: "Acabamento",   active: true  },
  shipped:    { label: "Enviado",      active: true  },
  done:       { label: "Finalizado",   active: false },
  cancelled:  { label: "Cancelado",    active: false },
};

interface StatusBadgeProps {
  fase: OrderStatus;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ fase, label, className, size = "md" }: StatusBadgeProps) {
  const config = FASE_CONFIG[fase] ?? FASE_CONFIG.pending;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold border",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        className
      )}
      style={{
        background: `hsl(var(--status-${fase}) / 0.1)`,
        borderColor: `hsl(var(--status-${fase}) / 0.3)`,
        color: `hsl(var(--status-${fase}))`,
      }}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", config.active && "animate-pulse")}
        style={{ background: `hsl(var(--status-${fase}))` }}
      />
      {label || config.label}
    </div>
  );
}
