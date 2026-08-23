import { lazy, Suspense } from "react";
import type React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import { OrdersProvider } from "./contexts/OrdersContext";
import { DataProvider } from "./contexts/DataContext";
import { LogsProvider } from "./contexts/LogsContext";
import { AppShell } from "./components/layout/AppShell";
import { useAuth } from "./contexts/AuthContext";
import { useTenant } from "./contexts/TenantContext";
import { Login } from "./pages/Login";
import { LoginUniversal } from "./pages/LoginUniversal";

// Cada tela vira um pedaco separado do bundle, baixado so quando aberta.
// O bundle unico passava de 2,7 MB e tudo era carregado no primeiro acesso;
// agora o login e o shell chegam primeiro e o resto vem por demanda.
const pagina = <T extends Record<string, unknown>>(carregar: () => Promise<T>, nome: keyof T) =>
  lazy(async () => ({ default: (await carregar())[nome] as React.ComponentType }));

const Dashboard = pagina(() => import("./pages/Dashboard"), "Dashboard");
const Orders = pagina(() => import("./pages/Orders"), "Orders");
const OrderDetail = pagina(() => import("./pages/OrderDetail"), "OrderDetail");
const NewOrder = pagina(() => import("./pages/NewOrder"), "NewOrder");
const Kanban = pagina(() => import("./pages/Kanban"), "Kanban");
const Products = pagina(() => import("./pages/Products"), "Products");
const Categorias = pagina(() => import("./pages/Categorias"), "Categorias");
const Setores = pagina(() => import("./pages/Setores"), "Setores");
const Papeis = pagina(() => import("./pages/Papeis"), "Papeis");
const CancelRequests = pagina(() => import("./pages/CancelRequests"), "CancelRequests");
const Users = pagina(() => import("./pages/Users"), "Users");
const Empresas = pagina(() => import("./pages/Empresas"), "Empresas");
const EmpresaDetalhe = pagina(() => import("./pages/EmpresaDetalhe"), "EmpresaDetalhe");
const Logs = pagina(() => import("./pages/Logs"), "Logs");
const Reports = pagina(() => import("./pages/Reports"), "Reports");

/**
 * Telas exclusivas da VIXCard. A API ja recusa os dados (403) para quem nao
 * e super admin, mas sem isto a casca da tela abria por URL — vazia e
 * confusa. Quem nao pode, volta ao dashboard da propria empresa.
 */
function SoSuperAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const tenant = useTenant();
  if (user && user.role !== "super_admin") {
    return <Navigate to={`/${tenant.slug}/dashboard`} replace />;
  }
  return <>{children}</>;
}

const Carregando = () => (
  <div className="flex justify-center py-20">
    <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

function TenantRoutes() {
  return (
    <TenantProvider>
      <Suspense fallback={<Carregando />}>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pedidos" element={<Orders />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="pedidos/novo" element={<NewOrder />} />
          <Route path="pedidos/cancelamentos" element={<SoSuperAdmin><CancelRequests /></SoSuperAdmin>} />
          <Route path="pedidos/:id" element={<OrderDetail />} />
          <Route path="empresas" element={<SoSuperAdmin><Empresas /></SoSuperAdmin>} />
          <Route path="empresas/:slug" element={<SoSuperAdmin><EmpresaDetalhe /></SoSuperAdmin>} />
          <Route path="produtos" element={<SoSuperAdmin><Products /></SoSuperAdmin>} />
          <Route path="categorias" element={<SoSuperAdmin><Categorias /></SoSuperAdmin>} />
          <Route path="setores" element={<SoSuperAdmin><Setores /></SoSuperAdmin>} />
          <Route path="papeis" element={<SoSuperAdmin><Papeis /></SoSuperAdmin>} />
          <Route path="usuarios" element={<Users />} />
          <Route path="relatorios" element={<Reports />} />
          <Route path="logs" element={<SoSuperAdmin><Logs /></SoSuperAdmin>} />
        </Route>
      </Routes>
      </Suspense>
    </TenantProvider>
  );
}

export default function App() {
  // Escuro é o padrão. O botão na barra superior continua alternando para
  // claro, e a escolha de cada usuário fica salva no navegador dele.
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <BrowserRouter>
        <AuthProvider>
          <DataProvider>
            <OrdersProvider>
              <LogsProvider>
                <Routes>
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/login" element={<LoginUniversal />} />
                  <Route path="/:tenant/*" element={<TenantRoutes />} />
                  <Route path="/404" element={
                    <div className="min-h-screen flex items-center justify-center">
                      <div className="text-center">
                        <p className="font-display text-6xl font-extrabold text-primary/20">404</p>
                        <p className="text-muted-foreground mt-2">Tenant não encontrado.</p>
                      </div>
                    </div>
                  } />
                </Routes>
                <Toaster position="top-right" richColors closeButton />
              </LogsProvider>
            </OrdersProvider>
          </DataProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
