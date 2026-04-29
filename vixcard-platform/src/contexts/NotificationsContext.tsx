import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useOrders } from "./OrdersContext";
import { isOverdue } from "../components/shared/DeadlineChip";
import { getOrderDeadline, getDeadlineStatus } from "../lib/holidays";
import type { Order } from "../types";

export type NotificationKind =
  | "created"
  | "status_change"
  | "cancel"
  | "note"
  | "overdue"
  | "due_today";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  orderId: string;
  orderTitle: string;
  tenantSlug: string;
  tenantName: string;
  description: string;
  authorName?: string;
  timestamp: string; // ISO
  read: boolean;
}

interface NotificationsContextValue {
  items: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

function buildItems(orders: Order[]): Omit<NotificationItem, "read">[] {
  const out: Omit<NotificationItem, "read">[] = [];

  orders.forEach((o) => {
    o.events.forEach((e) => {
      if (e.type === "created" || e.type === "status_change" || e.type === "cancel" || e.type === "note") {
        out.push({
          id: `evt:${o.id}:${e.id}`,
          kind: e.type as NotificationKind,
          orderId: o.id,
          orderTitle: o.title,
          tenantSlug: o.tenantSlug,
          tenantName: o.tenantName,
          description: e.description,
          authorName: e.authorName,
          timestamp: e.createdAt,
        });
      }
    });
  });

  // Synthetic prazo notifications — recriadas a cada dia para ficarem como "novas"
  const dayKey = today();
  orders.forEach((o) => {
    if (o.status === "done" || o.status === "cancelled") return;
    const dl = o.deadline ? new Date(o.deadline) : getOrderDeadline(o.createdAt);
    const status = getDeadlineStatus(dl, o.status);
    if (status === "overdue" && isOverdue(o.createdAt, o.status, o.deadline)) {
      out.push({
        id: `overdue:${o.id}:${dayKey}`,
        kind: "overdue",
        orderId: o.id,
        orderTitle: o.title,
        tenantSlug: o.tenantSlug,
        tenantName: o.tenantName,
        description: "Pedido em atraso",
        timestamp: dl.toISOString(),
      });
    } else if (status === "danger") {
      out.push({
        id: `due:${o.id}:${dayKey}`,
        kind: "due_today",
        orderId: o.id,
        orderTitle: o.title,
        tenantSlug: o.tenantSlug,
        tenantName: o.tenantName,
        description: "Vence hoje",
        timestamp: dl.toISOString(),
      });
    }
  });

  out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return out.slice(0, 60);
}

function readKey(userId: string | undefined) {
  return `vixcard_notif_read_${userId ?? "anon"}`;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { orders } = useOrders();

  const accessible = useMemo(() => {
    if (!user) return [];
    return user.role === "super_admin"
      ? orders
      : orders.filter((o) => o.tenantSlug === user.tenantSlug);
  }, [orders, user]);

  const built = useMemo(() => buildItems(accessible), [accessible]);

  const [readSet, setReadSet] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(readKey(user?.id));
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as string[]);
    } catch { return new Set(); }
  });

  // Reload read set when user changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(readKey(user?.id));
      setReadSet(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch { setReadSet(new Set()); }
  }, [user?.id]);

  // Persist read set
  useEffect(() => {
    try { localStorage.setItem(readKey(user?.id), JSON.stringify([...readSet])); } catch { /* */ }
  }, [readSet, user?.id]);

  const items: NotificationItem[] = useMemo(
    () => built.map((it) => ({ ...it, read: readSet.has(it.id) })),
    [built, readSet]
  );

  const unreadCount = items.filter((i) => !i.read).length;

  const markAsRead = (id: string) => {
    setReadSet((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const markAllAsRead = () => {
    setReadSet((prev) => {
      const next = new Set(prev);
      items.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const clearAll = () => {
    markAllAsRead();
  };

  return (
    <NotificationsContext.Provider value={{ items, unreadCount, markAsRead, markAllAsRead, clearAll }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
