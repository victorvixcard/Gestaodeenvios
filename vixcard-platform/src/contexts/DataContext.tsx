import { createContext, useContext, useState, type ReactNode } from "react";
import type { Product, Company, User, Permission, UserRole } from "../types";

// ── Defaults por papel ────────────────────────────────────────────────────────
export const DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin:  ["view_dashboard","view_orders","create_orders","manage_orders","view_products","view_reports","manage_users"],
  tenant_admin: ["view_dashboard","view_orders","create_orders","manage_orders","view_products","view_reports","manage_users"],
  operator:     ["view_dashboard","view_orders","create_orders","view_products"],
};

export const ALL_PERMISSIONS: { key: Permission; label: string; description: string }[] = [
  { key: "view_dashboard",  label: "Ver Dashboard",       description: "Acessar visão geral e KPIs" },
  { key: "view_orders",     label: "Ver Pedidos",          description: "Listar e visualizar pedidos" },
  { key: "create_orders",   label: "Criar Pedidos",        description: "Abrir novos pedidos" },
  { key: "manage_orders",   label: "Gerenciar Pedidos",    description: "Avançar etapas e cancelar" },
  { key: "view_products",   label: "Ver Produtos",         description: "Acessar catálogo de produtos" },
  { key: "view_reports",    label: "Ver Relatórios",       description: "Acessar página de relatórios" },
  { key: "manage_users",    label: "Gerenciar Usuários",   description: "Criar e editar usuários" },
];

// ── Catálogo inicial ──────────────────────────────────────────────────────────
const INITIAL_PRODUCTS: Product[] = [
  { id: "p1", code: "VIX-CAR-001", name: "Cartão PVC",                      description: "Cartão em PVC personalizado",               category: "Cartões",   price: 0.50, stock: 0,  active: true },
  { id: "p2", code: "VIX-CRN-001", name: "Carnê 2-4 lâminas",               description: "Carnê com 2 a 4 lâminas",                   category: "Carnês",    price: 3.50, stock: 0,  active: true },
  { id: "p3", code: "VIX-CRN-002", name: "Carnê 2-6 lâminas",               description: "Carnê com 2 a 6 lâminas",                   category: "Carnês",    price: 5.00, stock: 0,  active: true },
  { id: "p4", code: "VIX-CRN-003", name: "Carnê 11-12 lâminas",             description: "Carnê com 11 a 12 lâminas",                 category: "Carnês",    price: 8.50, stock: 0,  active: true },
  { id: "p5", code: "VIX-ETI-001", name: "Etiqueta",                         description: "Etiquetas personalizadas",                  category: "Etiquetas", price: 0.12, stock: 0,  active: true },
  { id: "p6", code: "VIX-SRV-001", name: "Serviço de Manuseio",             description: "Serviço completo de manuseio e envio",      category: "Serviços",  price: 2.00, stock: 0,  active: true },
  { id: "p7", code: "VIX-IMP-001", name: "Impressão Carta Notificação",      description: "Impressão de cartas de notificação",        category: "Impressão", price: 0.35, stock: 0,  active: true },
  { id: "p8", code: "VIX-IMP-002", name: "Impressão Carta Timbrada",         description: "Impressão de cartas timbradas",             category: "Impressão", price: 0.40, stock: 0,  active: true },
];

const INITIAL_COMPANIES: Company[] = [
  { slug: "medsenior", name: "MedSênior",  logoColor: "#0F7A5A", logoInitials: "MS", active: true, allowedProductIds: ["p1","p2","p3","p4","p5","p6","p7","p8"], createdAt: "2024-01-10T00:00:00Z" },
  { slug: "unimed",    name: "Unimed",     logoColor: "#00875A", logoInitials: "UN", active: true, allowedProductIds: ["p1","p5"],                               createdAt: "2024-02-15T00:00:00Z" },
  { slug: "sebrae",    name: "SEBRAE",     logoColor: "#003DA5", logoInitials: "SB", active: true, allowedProductIds: ["p1","p8"],                               createdAt: "2024-03-01T00:00:00Z" },
];

const INITIAL_USERS: User[] = [
  { id: "u1", name: "Victor Vixcard",  email: "admin@vixcard.com.br",      role: "super_admin",  tenantSlug: "sistemalegado", avatarInitials: "VV", active: true, permissions: DEFAULT_PERMISSIONS.super_admin },
  { id: "u2", name: "Ana Medsenior",   email: "admin@medsenior.com.br",    role: "tenant_admin", tenantSlug: "medsenior",     avatarInitials: "AM", active: true, permissions: DEFAULT_PERMISSIONS.tenant_admin },
  { id: "u3", name: "Carlos Operador", email: "operador@medsenior.com.br", role: "operator",     tenantSlug: "medsenior",     avatarInitials: "CO", active: true, permissions: DEFAULT_PERMISSIONS.operator },
  { id: "u4", name: "Admin Unimed",    email: "admin@unimed.com.br",       role: "tenant_admin", tenantSlug: "unimed",        avatarInitials: "AU", active: true, permissions: DEFAULT_PERMISSIONS.tenant_admin },
  { id: "u5", name: "Admin SEBRAE",    email: "admin@sebrae.com.br",       role: "tenant_admin", tenantSlug: "sebrae",        avatarInitials: "AS", active: true, permissions: DEFAULT_PERMISSIONS.tenant_admin },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const CATEGORY_CODES: Record<string, string> = {
  "Cartões":   "CAR",
  "Carnês":    "CRN",
  "Etiquetas": "ETI",
  "Impressão": "IMP",
  "Serviços":  "SRV",
  "Outros":    "OUT",
};

function generateProductCode(category: string, products: Product[]): string {
  const cat = CATEGORY_CODES[category] ?? "OUT";
  const count = products.filter((p) => p.code.includes(`VIX-${cat}-`)).length;
  return `VIX-${cat}-${String(count + 1).padStart(3, "0")}`;
}

// ── Context ───────────────────────────────────────────────────────────────────
interface DataContextValue {
  // Products
  products: Product[];
  addProduct: (data: Omit<Product, "id" | "code">) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Companies
  companies: Company[];
  addCompany: (data: Omit<Company, "slug" | "createdAt">) => void;
  updateCompany: (slug: string, updates: Partial<Company>) => void;

  // Users
  users: User[];
  addUser: (data: Omit<User, "id" | "avatarInitials">) => void;
  updateUser: (id: string, updates: Partial<User>) => void;

  // Helpers
  getProductsForTenant: (tenantSlug: string) => Product[];
  getUsersForTenant: (tenantSlug: string) => User[];
  getCompanyBySlug: (slug: string) => Company | undefined;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);

  const addProduct = (data: Omit<Product, "id" | "code">) => {
    const code = generateProductCode(data.category, products);
    setProducts((p) => [...p, { ...data, id: `p-${Date.now()}`, code }]);
  };

  const updateProduct = (id: string, updates: Partial<Product>) =>
    setProducts((p) => p.map((x) => (x.id === id ? { ...x, ...updates } : x)));

  const deleteProduct = (id: string) =>
    setProducts((p) => p.filter((x) => x.id !== id));

  const addCompany = (data: Omit<Company, "slug" | "createdAt">) => {
    const slug = data.name.toLowerCase().replace(/\s+/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    setCompanies((c) => [...c, { ...data, slug, createdAt: new Date().toISOString() }]);
  };

  const updateCompany = (slug: string, updates: Partial<Company>) =>
    setCompanies((c) => c.map((x) => (x.slug === slug ? { ...x, ...updates } : x)));

  const addUser = (data: Omit<User, "id" | "avatarInitials">) => {
    const avatarInitials = data.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    setUsers((u) => [...u, { ...data, id: `u-${Date.now()}`, avatarInitials }]);
  };

  const updateUser = (id: string, updates: Partial<User>) =>
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, ...updates } : x)));

  const getProductsForTenant = (tenantSlug: string) => {
    const company = companies.find((c) => c.slug === tenantSlug);
    if (!company) return products.filter((p) => p.active);
    return products.filter((p) => p.active && company.allowedProductIds.includes(p.id));
  };

  const getUsersForTenant = (tenantSlug: string) =>
    users.filter((u) => u.tenantSlug === tenantSlug);

  const getCompanyBySlug = (slug: string) =>
    companies.find((c) => c.slug === slug);

  return (
    <DataContext.Provider value={{
      products, addProduct, updateProduct, deleteProduct,
      companies, addCompany, updateCompany,
      users, addUser, updateUser,
      getProductsForTenant, getUsersForTenant, getCompanyBySlug,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
