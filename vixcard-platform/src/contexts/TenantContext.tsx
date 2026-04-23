import { createContext, useContext, type ReactNode } from "react";
import { useParams, Navigate } from "react-router-dom";
import type { Tenant } from "../types";

interface TenantContextValue {
  tenant: Tenant;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export const TENANTS: Record<string, Tenant> = {
  sistemalegado: {
    slug: "sistemalegado",
    name: "VIXCard — Admin",
    logoColor: "#1C508A",
    logoInitials: "VX",
    products: [],
  },
  medsenior: {
    slug: "medsenior",
    name: "MedSênior",
    logoColor: "#0F7A5A",
    logoInitials: "MS",
    products: [
      { id: "p1", name: "Cartão PVC", description: "Cartão em PVC personalizado", category: "Cartões", active: true },
      { id: "p2", name: "Carnê 2-4 lâminas", description: "Carnê com 2 a 4 lâminas", category: "Carnês", active: true },
      { id: "p3", name: "Carnê 2-6 lâminas", description: "Carnê com 2 a 6 lâminas", category: "Carnês", active: true },
      { id: "p4", name: "Carnê 11-12 lâminas", description: "Carnê com 11 a 12 lâminas", category: "Carnês", active: true },
      { id: "p5", name: "Etiqueta", description: "Etiquetas personalizadas", category: "Etiquetas", active: true },
      { id: "p6", name: "Serviço de Manuseio", description: "Serviço completo de manuseio", category: "Serviços", active: true },
      { id: "p7", name: "Impressão Carta Notificação", description: "Impressão de cartas de notificação", category: "Impressão", active: true },
      { id: "p8", name: "Impressão Carta Timbrada", description: "Impressão de cartas timbradas", category: "Impressão", active: true },
    ],
  },
  unimed: {
    slug: "unimed",
    name: "Unimed",
    logoColor: "#00875A",
    logoInitials: "UN",
    products: [
      { id: "p1", name: "Cartão PVC", description: "Cartão em PVC personalizado", category: "Cartões", active: true },
      { id: "p2", name: "Etiqueta", description: "Etiquetas personalizadas", category: "Etiquetas", active: true },
    ],
  },
  sebrae: {
    slug: "sebrae",
    name: "SEBRAE",
    logoColor: "#003DA5",
    logoInitials: "SB",
    products: [
      { id: "p1", name: "Cartão PVC", description: "Cartão em PVC personalizado", category: "Cartões", active: true },
      { id: "p2", name: "Impressão Carta Timbrada", description: "Impressão de cartas timbradas", category: "Impressão", active: true },
    ],
  },
};

export function TenantProvider({ children }: { children: ReactNode }) {
  const { tenant: slug } = useParams<{ tenant: string }>();
  const tenant = slug ? TENANTS[slug] : null;
  if (!tenant) return <Navigate to="/404" replace />;
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
