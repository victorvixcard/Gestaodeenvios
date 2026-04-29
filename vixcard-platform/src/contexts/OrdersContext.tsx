import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Order, OrderStatus } from "../types";

interface OrdersContextValue {
  orders: Order[];
  addOrder: (order: Omit<Order, "id" | "createdAt" | "updatedAt" | "events">) => string;
  updateStatus: (id: string, status: OrderStatus, reason?: string, author?: string) => void;
  updateDeadline: (id: string, deadline: string | undefined, author?: string) => void;
  addNote: (orderId: string, content: string, authorName: string, authorRole: import("../types").UserRole) => void;
  getOrder: (id: string) => Order | undefined;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

const now = new Date().toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString();
const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const INITIAL_ORDERS: Order[] = [
  {
    id: "ORD-001",
    tenantSlug: "medsenior",
    tenantName: "MedSênior",
    title: "Cartões PVC — Lote Março",
    status: "production",
    items: [
      { productId: "p1", productName: "Cartão PVC", quantity: 5000, specifications: "Frente e verso, laminação fosca" },
    ],
    notes: [
      { id: "n1", authorName: "Ana Medsenior", authorRole: "tenant_admin", content: "Arquivo enviado com os dados atualizados.", createdAt: yesterday },
    ],
    events: [
      { id: "e1", type: "created", description: "Pedido criado", authorName: "Ana Medsenior", createdAt: twoDaysAgo },
      { id: "e2", type: "status_change", description: "Status alterado para Em Produção", authorName: "Victor Vixcard", status: "production", createdAt: yesterday },
    ],
    requestedBy: "Ana Medsenior",
    assignedTo: "Victor Vixcard",
    createdAt: twoDaysAgo,
    updatedAt: yesterday,
    deadline: addDays(twoDaysAgo, 10),
  },
  {
    id: "ORD-002",
    tenantSlug: "medsenior",
    tenantName: "MedSênior",
    title: "Carnê 2-4 lâminas — Abril",
    status: "pending",
    items: [
      { productId: "p2", productName: "Carnê 2-4 lâminas", quantity: 2000, specifications: "Com logotipo atualizado" },
    ],
    notes: [],
    events: [
      { id: "e1", type: "created", description: "Pedido criado", authorName: "Carlos Operador", createdAt: now },
    ],
    requestedBy: "Carlos Operador",
    createdAt: now,
    updatedAt: now,
    deadline: addDays(now, 12),
  },
  {
    id: "ORD-003",
    tenantSlug: "medsenior",
    tenantName: "MedSênior",
    title: "Etiquetas Adesivas — Fevereiro",
    status: "done",
    items: [
      { productId: "p5", productName: "Etiqueta", quantity: 10000, specifications: "100x50mm, fosca" },
    ],
    notes: [],
    events: [
      { id: "e1", type: "created", description: "Pedido criado", authorName: "Ana Medsenior", createdAt: twoDaysAgo },
      { id: "e2", type: "status_change", description: "Status alterado para Em Produção", authorName: "Victor Vixcard", status: "production", createdAt: twoDaysAgo },
      { id: "e3", type: "status_change", description: "Status alterado para Finalizado", authorName: "Victor Vixcard", status: "done", createdAt: yesterday },
    ],
    requestedBy: "Ana Medsenior",
    createdAt: twoDaysAgo,
    updatedAt: yesterday,
    deadline: addDays(twoDaysAgo, 7),
  },
  {
    id: "ORD-004",
    tenantSlug: "medsenior",
    tenantName: "MedSênior",
    title: "Impressão Carta Notificação",
    status: "cancelled",
    items: [
      { productId: "p7", productName: "Impressão Carta Notificação", quantity: 500, specifications: "A4, colorido" },
    ],
    notes: [],
    events: [
      { id: "e1", type: "created", description: "Pedido criado", authorName: "Carlos Operador", createdAt: twoDaysAgo },
      { id: "e2", type: "cancel", description: "Pedido cancelado", authorName: "Ana Medsenior", status: "cancelled", createdAt: yesterday },
    ],
    cancelReason: "Arquivo de layout precisa ser refeito. Novo pedido será aberto após aprovação interna.",
    requestedBy: "Carlos Operador",
    createdAt: twoDaysAgo,
    updatedAt: yesterday,
  },
  {
    id: "ORD-005",
    tenantSlug: "unimed",
    tenantName: "Unimed",
    title: "Cartões PVC Convênio Q1",
    status: "finishing",
    items: [
      { productId: "p1", productName: "Cartão PVC", quantity: 8000, specifications: "Chip + banda magnética" },
    ],
    notes: [],
    events: [
      { id: "e1", type: "created", description: "Pedido criado", authorName: "Admin Unimed", createdAt: twoDaysAgo },
      { id: "e2", type: "status_change", description: "Status alterado para Em Produção", authorName: "Victor Vixcard", status: "production", createdAt: yesterday },
      { id: "e3", type: "status_change", description: "Status alterado para Acabamento", authorName: "Victor Vixcard", status: "finishing", createdAt: now },
    ],
    requestedBy: "Admin Unimed",
    createdAt: twoDaysAgo,
    updatedAt: now,
    deadline: addDays(twoDaysAgo, 9),
  },
  {
    id: "ORD-006",
    tenantSlug: "medsenior",
    tenantName: "MedSênior",
    title: "Carnê 11-12 lâminas — Março",
    status: "production",
    items: [
      { productId: "p4", productName: "Carnê 11-12 lâminas", quantity: 3000, specifications: "Com perfuração e numeração sequencial" },
    ],
    notes: [],
    events: [
      { id: "e1", type: "created", description: "Pedido criado", authorName: "Ana Medsenior", createdAt: fifteenDaysAgo },
      { id: "e2", type: "status_change", description: "Status alterado para Iniciado", authorName: "Victor Vixcard", status: "started", createdAt: tenDaysAgo },
      { id: "e3", type: "status_change", description: "Status alterado para Em Produção", authorName: "Victor Vixcard", status: "production", createdAt: tenDaysAgo },
    ],
    requestedBy: "Ana Medsenior",
    assignedTo: "Victor Vixcard",
    createdAt: fifteenDaysAgo,
    updatedAt: tenDaysAgo,
    deadline: addDays(fifteenDaysAgo, 7),
  },
  {
    id: "ORD-007",
    tenantSlug: "medsenior",
    tenantName: "MedSênior",
    title: "Kit Campanha — Maio 2026",
    status: "pending",
    items: [
      { productId: "p1", productName: "Cartão PVC", quantity: 3000, specifications: "Frente e verso, laminação brilho" },
      { productId: "p2", productName: "Carnê 2-4 lâminas", quantity: 3000, specifications: "Numeração sequencial" },
      { productId: "p7", productName: "Impressão Carta Notificação", quantity: 3000, specifications: "A4, frente simples" },
      { productId: "p6", productName: "Serviço de Manuseio", quantity: 3000, specifications: "Montagem kit completo + envelope" },
    ],
    notes: [],
    events: [
      { id: "e1", type: "created", description: "Pedido criado", authorName: "Ana Medsenior", createdAt: now },
    ],
    requestedBy: "Ana Medsenior",
    createdAt: now,
    updatedAt: now,
    deadline: addDays(now, 20),
  },
];

const STORAGE_KEY = "vixcard_orders";

function loadOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_ORDERS;
    const parsed = JSON.parse(raw) as Order[];
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_ORDERS;
    return parsed;
  } catch {
    return INITIAL_ORDERS;
  }
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(() => loadOrders());

  useEffect(() => {
    // Strip blob: file URLs (não persistem entre reloads)
    const persistable = orders.map((o) => ({
      ...o,
      files: o.files?.filter((f) => !f.url.startsWith("blob:")) ?? [],
    }));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable)); } catch { /* quota */ }
  }, [orders]);

  const addOrder = (order: Omit<Order, "id" | "createdAt" | "updatedAt" | "events">) => {
    const id = `ORD-${String(orders.length + 1).padStart(3, "0")}`;
    const createdAt = new Date().toISOString();
    const newOrder: Order = {
      ...order,
      id,
      createdAt,
      updatedAt: createdAt,
      events: [
        {
          id: `e-${Date.now()}`,
          type: "created",
          description: "Pedido criado",
          authorName: order.requestedBy,
          createdAt,
        },
      ],
    };
    setOrders((prev) => [newOrder, ...prev]);
    return id;
  };

  const updateStatus = (id: string, status: OrderStatus, reason?: string, author = "Sistema") => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const event = {
          id: `e-${Date.now()}`,
          type: status === "cancelled" ? ("cancel" as const) : ("status_change" as const),
          description: status === "cancelled" ? `Pedido cancelado${reason ? ": " + reason : ""}` : `Status alterado`,
          authorName: author,
          status,
          createdAt: new Date().toISOString(),
        };
        return {
          ...o,
          status,
          cancelReason: status === "cancelled" ? reason : o.cancelReason,
          updatedAt: new Date().toISOString(),
          events: [...o.events, event],
        };
      })
    );
  };

  const updateDeadline = (id: string, deadline: string | undefined, author = "Sistema") => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const event = {
          id: `e-${Date.now()}`,
          type: "status_change" as const,
          description: deadline
            ? `Prazo de entrega ajustado para ${new Date(deadline).toLocaleDateString("pt-BR")}`
            : "Prazo de entrega removido (volta ao cálculo automático)",
          authorName: author,
          createdAt: new Date().toISOString(),
        };
        return {
          ...o,
          deadline,
          updatedAt: new Date().toISOString(),
          events: [...o.events, event],
        };
      })
    );
  };

  const addNote = (orderId: string, content: string, authorName: string, authorRole: import("../types").UserRole) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const note = {
          id: `n-${Date.now()}`,
          authorName,
          authorRole,
          content,
          createdAt: new Date().toISOString(),
        };
        const event = {
          id: `e-${Date.now()}`,
          type: "note" as const,
          description: `Anotação adicionada por ${authorName}`,
          authorName,
          createdAt: new Date().toISOString(),
        };
        return {
          ...o,
          notes: [...o.notes, note],
          events: [...o.events, event],
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const getOrder = (id: string) => orders.find((o) => o.id === id);

  return (
    <OrdersContext.Provider value={{ orders, addOrder, updateStatus, updateDeadline, addNote, getOrder }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
