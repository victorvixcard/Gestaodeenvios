import { motion } from "framer-motion";
import { CheckCircle2, Clock, FileText, Upload, XCircle, Plus } from "lucide-react";
import type { OrderEvent } from "../../types";
import { formatDate } from "../../lib/utils";
import { cn } from "../../lib/utils";

const EVENT_ICONS = {
  created:       Plus,
  status_change: CheckCircle2,
  note:          FileText,
  file_upload:   Upload,
  cancel:        XCircle,
};

const EVENT_COLORS = {
  created:       "bg-primary/10 text-primary border-primary/20",
  status_change: "bg-success/10 text-success border-success/20",
  note:          "bg-secondary text-secondary-foreground border-border",
  file_upload:   "bg-accent/10 text-accent border-accent/20",
  cancel:        "bg-destructive/10 text-destructive border-destructive/20",
};

interface OrderTimelineProps {
  events: OrderEvent[];
}

export function OrderTimeline({ events }: OrderTimelineProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-4">
        {sorted.map((event, i) => {
          const Icon = EVENT_ICONS[event.type] ?? Clock;
          const colorClass = EVENT_COLORS[event.type] ?? EVENT_COLORS.note;
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex gap-4 relative"
            >
              <div className={cn(
                "relative z-10 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 border",
                colorClass
              )}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <p className="text-sm font-medium text-foreground">{event.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{event.authorName}</span>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
