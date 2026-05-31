import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Product, Company, User, Permission, UserRole } from "../types";
import { api } from "../lib/api";
import { mapProduct, mapCompany, mapUser } from "../lib/mappers";
import { useAuth } from "./AuthContext";

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

// ── Context ───────────────────────────────────────────────────────────────────
interface DataContextValue {
  products: Product[];
  addProduct: (data: Omit<Product, "id" | "code">) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  companies: Company[];
  addCompany: (data: Omit<Company, "slug" | "createdAt">) => Promise<void>;
  updateCompany: (slug: string, updates: Partial<Company>) => Promise<void>;

  users: User[];
  addUser: (data: Omit<User, "id" | "avatarInitials">) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;

  getProductsForTenant: (tenantSlug: string) => Product[];
  getUsersForTenant: (tenantSlug: string) => User[];
  getCompanyBySlug: (slug: string) => Company | undefined;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [products, setProducts]   = useState<Product[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers]         = useState<User[]>([]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      if (!isAuthenticated) {
        setProducts([]);
        setCompanies([]);
        setUsers([]);
      }
      return;
    }

    const fetchAll = async () => {
      const [prods, comps, usrs] = await Promise.allSettled([
        api.get<Record<string, unknown>[]>('/products'),
        api.get<Record<string, unknown>[]>('/companies'),
        api.get<Record<string, unknown>[]>('/users'),
      ]);
      if (prods.status === 'fulfilled') setProducts(prods.value.map(mapProduct));
      if (comps.status === 'fulfilled') setCompanies(comps.value.map(mapCompany));
      if (usrs.status === 'fulfilled')  setUsers(usrs.value.map(mapUser));
    };

    fetchAll();
  }, [isAuthenticated, authLoading]);

  // ── Products ──────────────────────────────────────────────────────────────
  const addProduct = (data: Omit<Product, "id" | "code">): Promise<void> =>
    api.post<Record<string, unknown>>('/products', {
      name: data.name,
      category: data.category,
      description: data.description,
      image_url: data.imageUrl,
      video_url: data.videoUrl,
      price: data.price,
      stock: data.stock,
      variations: data.variations,
    }).then((p) => setProducts((prev) => [...prev, mapProduct(p)]));

  const updateProduct = (id: string, updates: Partial<Product>): Promise<void> =>
    api.put<Record<string, unknown>>(`/products/${id}`, {
      name: updates.name,
      category: updates.category,
      description: updates.description,
      image_url: updates.imageUrl,
      video_url: updates.videoUrl,
      price: updates.price,
      stock: updates.stock,
      variations: updates.variations,
      active: updates.active,
    }).then((p) => setProducts((prev) => prev.map((x) => (x.id === id ? mapProduct(p) : x))));

  const deleteProduct = (id: string): Promise<void> =>
    api.delete(`/products/${id}`)
      .then(() => setProducts((prev) => prev.filter((x) => x.id !== id)));

  // ── Companies ─────────────────────────────────────────────────────────────
  const addCompany = (data: Omit<Company, "slug" | "createdAt">): Promise<void> => {
    const slug = data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "");

    return api.post<Record<string, unknown>>('/companies', {
      slug,
      name: data.name,
      logo_color: data.logoColor,
      logo_initials: data.logoInitials,
      logo_url: data.logoUrl,
    }).then(async (c) => {
      if (data.allowedProductIds.length > 0) {
        await api.put(`/companies/${slug}/products`, { product_ids: data.allowedProductIds });
      }
      const fresh = await api.get<Record<string, unknown>>(`/companies/${slug}`);
      setCompanies((prev) => [...prev, mapCompany(fresh ?? c)]);
    });
  };

  const updateCompany = (slug: string, updates: Partial<Company>): Promise<void> => {
    const promises: Promise<unknown>[] = [];

    if (updates.name || updates.logoColor || updates.logoInitials || updates.logoUrl !== undefined || updates.active !== undefined) {
      promises.push(api.put(`/companies/${slug}`, {
        name: updates.name,
        logo_color: updates.logoColor,
        logo_initials: updates.logoInitials,
        logo_url: updates.logoUrl,
      }));
    }

    if (updates.allowedProductIds) {
      promises.push(api.put(`/companies/${slug}/products`, {
        product_ids: updates.allowedProductIds,
      }));
    }

    if (updates.active !== undefined && updates.name === undefined) {
      promises.push(api.patch(`/companies/${slug}/toggle`, {}));
    }

    return Promise.all(promises).then(async () => {
      const fresh = await api.get<Record<string, unknown>>(`/companies/${slug}`);
      setCompanies((prev) => prev.map((x) => (x.slug === slug ? mapCompany(fresh) : x)));
    });
  };

  // ── Users ─────────────────────────────────────────────────────────────────
  const addUser = (data: Omit<User, "id" | "avatarInitials">): Promise<void> =>
    api.post<Record<string, unknown>>('/users', {
      name: data.name,
      email: data.email,
      role: data.role,
      tenant_slug: data.tenantSlug,
      whatsapp: (data as Record<string, unknown>).whatsapp,
      avatar_url: data.avatarUrl,
    }).then((u) => setUsers((prev) => [...prev, mapUser(u)]));

  const updateUser = (id: string, updates: Partial<User>): Promise<void> => {
    if (updates.active !== undefined && Object.keys(updates).length === 1) {
      return api.patch<Record<string, unknown>>(`/users/${id}/toggle`, {})
        .then((u) => setUsers((prev) => prev.map((x) => (x.id === id ? mapUser(u) : x))));
    }
    return api.put<Record<string, unknown>>(`/users/${id}`, {
      name: updates.name,
      email: updates.email,
      role: updates.role,
      avatar_url: updates.avatarUrl,
    }).then((u) => setUsers((prev) => prev.map((x) => (x.id === id ? mapUser(u) : x))));
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
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
