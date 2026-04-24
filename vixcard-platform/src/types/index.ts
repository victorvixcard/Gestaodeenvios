export type UserRole = "super_admin" | "tenant_admin" | "operator";

export type Permission =
  | "view_dashboard"
  | "view_orders"
  | "create_orders"
  | "manage_orders"
  | "view_products"
  | "view_reports"
  | "manage_users";

export type OrderStatus =
  | "pending"
  | "started"
  | "production"
  | "finishing"
  | "done"
  | "cancelled";

export interface Tenant {
  slug: string;
  name: string;
  logoColor: string;
  logoInitials: string;
  products: Product[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantSlug: string;
  avatarInitials: string;
  avatarUrl?: string;
  active: boolean;
  permissions: Permission[];
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  imageUrl?: string;
  videoUrl?: string;
  stock: number;
  active: boolean;
}

export interface Company {
  slug: string;
  name: string;
  logoColor: string;
  logoInitials: string;
  logoUrl?: string;
  active: boolean;
  allowedProductIds: string[];
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  specifications: string;
}

export interface OrderNote {
  id: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export interface OrderEvent {
  id: string;
  type: "status_change" | "note" | "file_upload" | "created" | "cancel";
  description: string;
  authorName: string;
  status?: OrderStatus;
  createdAt: string;
}

export interface OrderFile {
  name: string;
  size: number;
  type: string;
  url: string; // object URL para download
}

export interface Order {
  id: string;
  tenantSlug: string;
  tenantName: string;
  title: string;
  status: OrderStatus;
  items: OrderItem[];
  notes: OrderNote[];
  events: OrderEvent[];
  cancelReason?: string;
  requestedBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  files?: OrderFile[];
}
