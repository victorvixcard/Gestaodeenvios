import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Order, OrderItem, UserRole } from "../types";
import { api } from "../lib/api";
import { mapOrder } from "../lib/mappers";
import { useAuth } from "./AuthContext";

interface OrdersContextValue {
  orders: Order[];
  addOrder: (order: Omit<Order, "id" | "createdAt" | "updatedAt" | "events">, files?: File[]) => Promise<Order>;
  updateStatus: (id: string, status: string, reason?: string, author?: string) => Promise<void>;
  addNote: (orderId: string, content: string, authorName?: string, authorRole?: UserRole) => void;
  updateItems: (id: string, items: OrderItem[]) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  getOrder: (id: string) => Order | undefined;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      if (!isAuthenticated) setOrders([]);
      return;
    }
    api.get<Record<string, unknown>[]>('/orders')
      .then((data) => setOrders(data.map(mapOrder)))
      .catch(() => {});
  }, [isAuthenticated, authLoading]);

  const addOrder = async (
    order: Omit<Order, "id" | "createdAt" | "updatedAt" | "events">,
    files?: File[]
  ): Promise<Order> => {
    const data = await api.post<Record<string, unknown>>('/orders', {
      title: order.title,
      items: order.items.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        specifications: item.specifications,
        selected_variations: item.selectedVariations,
      })),
    });

    let mapped = mapOrder(data);

    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const updated = await api.upload<Record<string, unknown>>(`/orders/${mapped.id}/files`, file);
          mapped = mapOrder(updated);
        } catch {
          // continue uploading remaining files
        }
      }
    }

    setOrders((prev) => [mapped, ...prev]);
    return mapped;
  };

  const updateStatus = async (id: string, status: string, reason?: string) => {
    // Quando o admin fornece motivo, usa o endpoint /cancel (que persiste o cancel_reason).
    // Sem motivo, usa /status — permite reabrir um pedido cancelado para qualquer outro status.
    if (status === 'cancelled' && reason) {
      const data = await api.post<Record<string, unknown>>(`/orders/${id}/cancel`, { reason });
      setOrders((prev) => prev.map((o) => (o.id === id ? mapOrder(data) : o)));
      return;
    }
    const data = await api.patch<Record<string, unknown>>(`/orders/${id}/status`, { status });
    setOrders((prev) => prev.map((o) => (o.id === id ? mapOrder(data) : o)));
  };

  const addNote = (orderId: string, content: string, _authorName?: string, _authorRole?: UserRole) => {
    api.post<Record<string, unknown>>(`/orders/${orderId}/notes`, { content })
      .then((data) => setOrders((prev) => prev.map((o) => (o.id === orderId ? mapOrder(data) : o))));
  };

  const updateItems = async (id: string, items: OrderItem[]) => {
    const data = await api.put<Record<string, unknown>>(`/orders/${id}/items`, {
      items: items.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        specifications: item.specifications,
        selected_variations: item.selectedVariations,
      })),
    });
    setOrders((prev) => prev.map((o) => (o.id === id ? mapOrder(data) : o)));
  };

  const deleteOrder = async (id: string) => {
    await api.delete(`/orders/${id}`);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const getOrder = (id: string) => orders.find((o) => o.id === id);

  return (
    <OrdersContext.Provider value={{ orders, addOrder, updateStatus, addNote, updateItems, deleteOrder, getOrder }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
