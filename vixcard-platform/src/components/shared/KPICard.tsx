import { motion } from "framer-motion";
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";

interface KPICardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  color?: "primary" | "accent" | "success" | "warning" | "destructive";
  delay?: number;
}

const colorMap = {
  primary:     "text-primary bg-primary/10",
  accent:      "text-accent bg-accent/10",
  success:     "text-success bg-success/10",
  warning:     "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
};

export function KPICard({ label, value, icon: Icon, trend, trendLabel, color = "primary", delay = 0 }: KPICardProps) {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="p-5 bg-gradient-card hover:shadow-brand transition-all duration-300 hover:-translate-y-0.5 cursor-default">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0", colorMap[color])}>
            <Icon className="h-5 w-5" />
          </div>
          {trend !== undefined && (
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border",
              isPositive
                ? "bg-success/10 text-success border-success/20"
                : "bg-destructive/10 text-destructive border-destructive/20"
            )}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="font-display text-3xl font-extrabold text-foreground leading-none mb-1">
          {value}
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {trendLabel && (
          <div className="mt-2 text-xs text-muted-foreground/70">{trendLabel}</div>
        )}
      </Card>
    </motion.div>
  );
}
