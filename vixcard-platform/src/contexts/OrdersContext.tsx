import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Order, OrderItem, UserRole } from "../types";
import { api } from "../lib/api";
import { mapOrder } from "../lib/mappers";
import { useAuth } from "./AuthContext";

interface OrdersContextValue {
  orders: Order[];
  addOrder: (order: Omit<Order, "id" | "createdAt" | "updatedAt" | "events">, files?: File[]) => Promise<Order>;
  updateStatus: (id: string, status: string, reason?: string, author?: string) => Promise<void>;
  requestCancel: (id: string, reason: string) => Promise<void>;
  refresh: () => Promise<void>;
  /** true quando o historico completo ja foi carregado (alem da janela de 90 dias). */
  todasCarregadas: boolean;
  /** Carrega o historico completo (uma vez; depois e no-op). */
  carregarTodas: () => Promise<void>;
  addNote: (orderId: string, content: string, authorName?: string, authorRole?: UserRole) => void;
  updateItems: (id: string, items: OrderItem[]) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  getOrder: (id: string) => Order | undefined;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  // A API entrega por padrao so OS abertas + ultimos 90 dias (rapido de
  // abrir). Telas analiticas pedem o historico completo com carregarTodas().
  const [todasCarregadas, setTodasCarregadas] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      if (!isAuthenticated) { setOrders([]); setTodasCarregadas(false); }
      return;
    }
    api.get<Record<string, unknown>[]>('/orders')
      .then((data) => setOrders(data.map(mapOrder)))
      .catch(() => {});
  }, [isAuthenticated, authLoading]);

  // Recarrega tudo — usado depois de decisoes tomadas fora do contexto
  // (ex.: fila de cancelamentos aprova uma OS)
  const refresh = async () => {
    const data = await api.get<Record<string, unknown>[]>(todasCarregadas ? '/orders?all=1' : '/orders');
    setOrders(data.map(mapOrder));
  };

  // useCallback: Dashboard/Relatorios chamam num useEffect; sem identidade
  // estavel o efeito rodaria a cada render
  const carregarTodas = useCallback(async () => {
    if (todasCarregadas) return;
    const data = await api.get<Record<string, unknown>[]>('/orders?all=1');
    setOrders(data.map(mapOrder));
    setTodasCarregadas(true);
  }, [todasCarregadas]);

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

  // Empresa cliente fora da janela de 15 min: pede o cancelamento e a VIXCard decide
  const requestCancel = async (id: string, reason: string) => {
    const data = await api.post<Record<string, unknown>>(`/orders/${id}/cancel-request`, { reason });
    const mapped = mapOrder(data);
    setOrders((prev) => prev.map((o) => (o.id === id ? mapped : o)));
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
    <OrdersContext.Provider value={{ orders, addOrder, updateStatus, requestCancel, refresh, todasCarregadas, carregarTodas, addNote, updateItems, deleteOrder, getOrder }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
