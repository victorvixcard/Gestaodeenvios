import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Bell, BellOff, CheckCheck, X, Plus, Play, XCircle, MessageSquare,
  Siren, AlertTriangle,
} from "lucide-react";
import { useNotifications, type NotificationItem, type NotificationKind } from "../../contexts/NotificationsContext";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

const KIND_META: Record<NotificationKind, {
  icon: React.ElementType;
  label: string;
  color: string;
}> = {
  created:        { icon: Plus,           label: "Novo pedido",       color: "text-primary bg-primary/10" },
  status_change:  { icon: Play,           label: "Status alterado",   color: "text-accent bg-accent/10" },
  cancel:         { icon: XCircle,        label: "Pedido cancelado",  color: "text-destructive bg-destructive/10" },
  note:           { icon: MessageSquare,  label: "Nova anotação",     color: "text-indigo-600 bg-indigo-500/10" },
  overdue:        { icon: Siren,          label: "Pedido em atraso",  color: "text-red-600 bg-red-500/10" },
  due_today:      { icon: AlertTriangle,  label: "Vence hoje",        color: "text-amber-600 bg-amber-500/10" },
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "agora";
  const m = Math.floor(ms / 60000);
  if (m < 1)   return "agora";
  if (m < 60)  return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function NotificationsPanel() {
  const { items, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleClick = (item: NotificationItem) => {
    markAsRead(item.id);
    setOpen(false);
    navigate(`/${item.tenantSlug}/pedidos/${item.orderId}`);
  };

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon-sm"
        aria-label="Notificações"
        className="relative"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center border-2 border-background">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-popover text-popover-foreground border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <p className="text-sm font-semibold">Notificações</p>
                <p className="text-[11px] text-muted-foreground">
                  {unreadCount > 0
                    ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}`
                    : "Tudo em dia"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={markAllAsRead}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Marcar todas
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <BellOff className="h-8 w-8 opacity-30" />
                  <p className="text-xs">Nada por aqui ainda.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((item) => {
                    const meta = KIND_META[item.kind];
                    const Icon = meta.icon;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => handleClick(item)}
                          className={cn(
                            "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors",
                            !item.read && "bg-primary/5"
                          )}
                        >
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            meta.color
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground/80">
                                {meta.label}
                              </span>
                              {!item.read && (
                                <span className="h-1.5 w-1.5 rounded-full bg-accent flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-sm font-medium truncate mt-0.5">
                              {item.orderTitle}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              <span className="font-mono">{item.orderId}</span>
                              {item.authorName && <> · por {item.authorName}</>}
                              {" · "}
                              <span className="text-foreground/60">{timeAgo(item.timestamp)}</span>
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
