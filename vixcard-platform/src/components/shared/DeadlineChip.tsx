import { Clock, CheckCircle2, AlertTriangle, Siren } from "lucide-react";
import {
  getOrderDeadline, getDeadlineStatus, getBusinessDaysUntil,
} from "../../lib/holidays";
import { cn } from "../../lib/utils";

interface DeadlineChipProps {
  createdAt: string;
  orderStatus: string;
  showDays?: boolean;
  className?: string;
}

export function getOverdueDays(createdAt: string): number {
  const deadline = getOrderDeadline(createdAt);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline); dl.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((now.getTime() - dl.getTime()) / 86400000));
}

export function isOverdue(createdAt: string, orderStatus: string): boolean {
  const deadline = getOrderDeadline(createdAt);
  return getDeadlineStatus(deadline, orderStatus) === "overdue";
}

export function DeadlineChip({ createdAt, orderStatus, showDays = true, className }: DeadlineChipProps) {
  const deadline = getOrderDeadline(createdAt);
  const status = getDeadlineStatus(deadline, orderStatus);
  const dateStr = deadline.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  // ── ATRASADO — alerta em destaque ──────────────────────────────────────────
  if (status === "overdue") {
    const overdueDays = getOverdueDays(createdAt);
    return (
      <div className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-red-400 bg-red-50 text-red-700 font-bold text-[12px] animate-pulse",
        className
      )}>
        <Siren className="h-4 w-4 flex-shrink-0 text-red-600" />
        <span>
          EM ATRASO —{" "}
          <span className="text-red-600 font-extrabold text-[13px]">
            {overdueDays} dia{overdueDays !== 1 ? "s" : ""}
          </span>
          {" "}em atraso
        </span>
        {showDays && (
          <span className="font-normal opacity-70 text-[11px]">· Prazo era {dateStr}</span>
        )}
      </div>
    );
  }

  // ── VENCE HOJE ─────────────────────────────────────────────────────────────
  if (status === "danger") {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border-2 border-red-400 bg-red-50 text-red-700 font-bold text-[12px]",
        className
      )}>
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 animate-bounce" />
        <span>Prazo: {dateStr}</span>
        <span className="font-normal opacity-80">· vence hoje!</span>
      </div>
    );
  }

  // ── ATENÇÃO ────────────────────────────────────────────────────────────────
  if (status === "warning") {
    const days = getBusinessDaysUntil(deadline);
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-amber-300 bg-amber-50 text-amber-700 font-semibold text-[11px]",
        className
      )}>
        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
        <span>Prazo: {dateStr}</span>
        {showDays && <span className="font-normal opacity-70">· {days} dia{days !== 1 ? "s" : ""} útil{days !== 1 ? "eis" : ""}</span>}
      </div>
    );
  }

  // ── CONCLUÍDO / CANCELADO ──────────────────────────────────────────────────
  if (status === "done") {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-400 font-semibold text-[11px]",
        className
      )}>
        <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
        <span>Prazo: {dateStr}</span>
      </div>
    );
  }

  // ── NO PRAZO ──────────────────────────────────────────────────────────────
  const days = getBusinessDaysUntil(deadline);
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold text-[11px]",
      className
    )}>
      <Clock className="h-3 w-3 flex-shrink-0" />
      <span>Prazo: {dateStr}</span>
      {showDays && <span className="font-normal opacity-70">· {days} dia{days !== 1 ? "s" : ""} útil{days !== 1 ? "eis" : ""}</span>}
    </div>
  );
}
