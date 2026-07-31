import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useParams, Navigate } from "react-router-dom";
import type { Tenant } from "../types";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

interface TenantContextValue {
  tenant: Tenant;
}

const TenantContext = createContext<TenantContextValue | null>(null);

type Status = "loading" | "ok" | "notfound";

/**
 * Resolve o tenant da URL consultando a API.
 *
 * Antes existia um objeto TENANTS hardcoded aqui. Isso fazia com que empresa
 * criada pela tela "Nova Empresa" caísse em /404 até alguém editar este arquivo
 * e publicar um build novo — o cadastro funcionava no banco mas não no sistema.
 */
export function TenantProvider({ children }: { children: ReactNode }) {
  const { tenant: slug } = useParams<{ tenant: string }>();
  const { user, loading: authLoading } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!slug) {
      setStatus("notfound");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    api.get<Record<string, unknown>>(`/tenants/${slug}`)
      .then((c) => {
        if (cancelled) return;
        setTenant({
          slug: String(c.slug),
          name: String(c.name),
          logoColor: String(c.logoColor ?? "#1C508A"),
          logoInitials: String(c.logoInitials ?? ""),
          logoUrl: (c.logoUrl as string | null) ?? undefined,
        });
        setStatus("ok");
      })
      .catch(() => {
        if (!cancelled) setStatus("notfound");
      });

    return () => { cancelled = true; };
  }, [slug]);

  // Espera a autenticação e o tenant resolverem antes de decidir qualquer
  // redirecionamento — sem isso o usuário via um 404 piscando antes da tela.
  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (status === "notfound" || !tenant) {
    return <Navigate to="/404" replace />;
  }

  // Quem não é super admin só acessa a própria empresa. A API já filtra os dados
  // pelo tenant do token, então isso não é a barreira de segurança — evita que o
  // usuário navegue para /outraempresa/dashboard e veja a marca errada na tela.
  if (user && user.role !== "super_admin" && user.tenantSlug !== slug) {
    return <Navigate to={`/${user.tenantSlug}/dashboard`} replace />;
  }

  return (
    <TenantContext.Provider value={{ tenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx.tenant;
}
