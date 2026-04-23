import { cn } from "../../lib/utils";
import type { OrderStatus } from "../../types";

const STATUS_CONFIG: Record<OrderStatus, { label: string; active: boolean }> = {
  pending:    { label: "Pendente",     active: false },
  started:    { label: "Iniciado",     active: true  },
  production: { label: "Em Produção",  active: true  },
  finishing:  { label: "Acabamento",   active: true  },
  done:       { label: "Finalizado",   active: false },
  cancelled:  { label: "Cancelado",    active: false },
};

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, className, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold border",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        className
      )}
      style={{
        background: `hsl(var(--status-${status}) / 0.1)`,
        borderColor: `hsl(var(--status-${status}) / 0.3)`,
        color: `hsl(var(--status-${status}))`,
      }}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", config.active && "animate-pulse")}
        style={{ background: `hsl(var(--status-${status}))` }}
      />
      {config.label}
    </div>
  );
}
