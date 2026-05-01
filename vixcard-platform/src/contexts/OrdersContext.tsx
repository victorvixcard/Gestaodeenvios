import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Order, OrderStatus, UserRole } from "../types";
import { api } from "../lib/api";
import { mapOrder } from "../lib/mappers";
import { useAuth } from "./AuthContext";

interface OrdersContextValue {
  orders: Order[];
  addOrder: (order: Omit<Order, "id" | "createdAt" | "updatedAt" | "events">) => void;
  updateStatus: (id: string, status: OrderStatus, reason?: string, author?: string) => void;
  addNote: (orderId: string, content: string, authorName?: string, authorRole?: UserRole) => void;
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

  const addOrder = (order: Omit<Order, "id" | "createdAt" | "updatedAt" | "events">) => {
    api.post<Record<string, unknown>>('/orders', {
      title: order.title,
      items: order.items.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        specifications: item.specifications,
        selected_variations: item.selectedVariations,
      })),
    }).then((data) => setOrders((prev) => [mapOrder(data), ...prev]));
  };

  const updateStatus = (id: string, status: OrderStatus, reason?: string) => {
    if (status === 'cancelled') {
      api.post<Record<string, unknown>>(`/orders/${id}/cancel`, { reason: reason ?? '' })
        .then((data) => setOrders((prev) => prev.map((o) => (o.id === id ? mapOrder(data) : o))));
      return;
    }
    api.patch<Record<string, unknown>>(`/orders/${id}/status`, { status })
      .then((data) => setOrders((prev) => prev.map((o) => (o.id === id ? mapOrder(data) : o))));
  };

  const addNote = (orderId: string, content: string, _authorName?: string, _authorRole?: UserRole) => {
    api.post<Record<string, unknown>>(`/orders/${orderId}/notes`, { content })
      .then((data) => setOrders((prev) => prev.map((o) => (o.id === orderId ? mapOrder(data) : o))));
  };

  const getOrder = (id: string) => orders.find((o) => o.id === id);

  return (
    <OrdersContext.Provider value={{ orders, addOrder, updateStatus, addNote, getOrder }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
