import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Product, Company, User, Sector, Papel, Permission, UserRole, Fase } from "../types";
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
  addCompany: (data: Omit<Company, "slug" | "createdAt" | "attendantIds" | "timeline">) => Promise<void>;
  updateCompany: (slug: string, updates: Partial<Company>) => Promise<void>;
  setCompanyTimeline: (slug: string, steps: { label: string; fase: Fase }[] | null) => Promise<void>;

  users: User[];
  addUser: (data: Omit<User, "id" | "avatarInitials" | "sectors"> & { password?: string; sectorIds?: string[]; roleId?: string }) => Promise<Record<string, unknown>>;
  updateUser: (id: string, updates: Partial<Omit<User, "sectors">> & { sectorIds?: string[]; roleId?: string }) => Promise<void>;

  sectors: Sector[];
  reloadSectors: () => Promise<void>;

  papeis: Papel[];
  reloadPapeis: () => Promise<void>;

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
  const [sectors, setSectors]     = useState<Sector[]>([]);
  const [papeis, setPapeis]       = useState<Papel[]>([]);

  const reloadSectors = async () => {
    const data = await api.get<Sector[]>('/sectors?all=1');
    setSectors(data);
  };

  const reloadPapeis = async () => {
    const data = await api.get<Papel[]>('/roles?all=1');
    setPapeis(data);
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      if (!isAuthenticated) {
        setProducts([]);
        setCompanies([]);
        setUsers([]);
        setSectors([]);
        setPapeis([]);
      }
      return;
    }

    const fetchAll = async () => {
      const [prods, comps, usrs, secs, rols] = await Promise.allSettled([
        api.get<Record<string, unknown>[]>('/products'),
        api.get<Record<string, unknown>[]>('/companies'),
        api.get<Record<string, unknown>[]>('/users'),
        api.get<Sector[]>('/sectors?all=1'),
        api.get<Papel[]>('/roles?all=1'),
      ]);
      if (prods.status === 'fulfilled') setProducts(prods.value.map(mapProduct));
      if (comps.status === 'fulfilled') setCompanies(comps.value.map(mapCompany));
      if (usrs.status === 'fulfilled')  setUsers(usrs.value.map(mapUser));
      if (secs.status === 'fulfilled')  setSectors(secs.value);
      if (rols.status === 'fulfilled')  setPapeis(rols.value);
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
  const addCompany = (data: Omit<Company, "slug" | "createdAt" | "attendantIds" | "timeline">): Promise<void> => {
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

    if (updates.attendantIds) {
      promises.push(api.put(`/companies/${slug}/attendants`, {
        user_ids: updates.attendantIds.map(Number),
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

  // Linha do tempo da empresa: null volta ao fluxo padrao. So afeta OS
  // futuras — o pedido congela o fluxo vigente na criacao.
  const setCompanyTimeline = async (slug: string, steps: { label: string; fase: Fase }[] | null): Promise<void> => {
    const fresh = await api.put<Record<string, unknown>>(`/companies/${slug}/timeline`, { timeline: steps });
    setCompanies((prev) => prev.map((x) => (x.slug === slug ? mapCompany(fresh) : x)));
  };

  // ── Users ─────────────────────────────────────────────────────────────────
  const addUser = async (data: Omit<User, "id" | "avatarInitials" | "sectors"> & { password?: string; sectorIds?: string[]; roleId?: string }): Promise<Record<string, unknown>> => {
    const u = await api.post<Record<string, unknown>>('/users', {
      name: data.name,
      email: data.email,
      role: data.role,
      tenant_slug: data.tenantSlug,
      password: data.password,
      whatsapp: data.whatsapp,
      avatar_url: data.avatarUrl,
      permissions: data.permissions,
      sector_ids: data.sectorIds?.map(Number),
      role_id: data.roleId ? Number(data.roleId) : undefined,
    });
    setUsers((prev) => [...prev, mapUser(u)]);
    return u;
  };

  const updateUser = async (id: string, updates: Partial<Omit<User, "sectors">> & { sectorIds?: string[]; roleId?: string }): Promise<void> => {
    if (updates.active !== undefined && Object.keys(updates).length === 1) {
      const u = await api.patch<Record<string, unknown>>(`/users/${id}/toggle`, {});
      setUsers((prev) => prev.map((x) => (x.id === id ? mapUser(u) : x)));
      return;
    }
    const u = await api.put<Record<string, unknown>>(`/users/${id}`, {
      name: updates.name,
      email: updates.email,
      role: updates.role,
      whatsapp: updates.whatsapp,
      avatar_url: updates.avatarUrl,
      permissions: updates.permissions,
      sector_ids: updates.sectorIds?.map(Number),
      role_id: updates.roleId ? Number(updates.roleId) : undefined,
    });
    setUsers((prev) => prev.map((x) => (x.id === id ? mapUser(u) : x)));
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
      companies, addCompany, updateCompany, setCompanyTimeline,
      users, addUser, updateUser,
      sectors, reloadSectors,
      papeis, reloadPapeis,
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
