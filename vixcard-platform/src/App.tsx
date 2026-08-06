import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import { OrdersProvider } from "./contexts/OrdersContext";
import { DataProvider } from "./contexts/DataContext";
import { LogsProvider } from "./contexts/LogsContext";
import { AppShell } from "./components/layout/AppShell";
import { Login } from "./pages/Login";
import { LoginUniversal } from "./pages/LoginUniversal";
import { Dashboard } from "./pages/Dashboard";
import { Orders } from "./pages/Orders";
import { OrderDetail } from "./pages/OrderDetail";
import { NewOrder } from "./pages/NewOrder";
import { Kanban } from "./pages/Kanban";
import { Products } from "./pages/Products";
import { Categorias } from "./pages/Categorias";
import { Users } from "./pages/Users";
import { Empresas } from "./pages/Empresas";
import { EmpresaDetalhe } from "./pages/EmpresaDetalhe";
import { Logs } from "./pages/Logs";
import { Reports } from "./pages/Reports";

function TenantRoutes() {
  return (
    <TenantProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pedidos" element={<Orders />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="pedidos/novo" element={<NewOrder />} />
          <Route path="pedidos/:id" element={<OrderDetail />} />
          <Route path="empresas" element={<Empresas />} />
          <Route path="empresas/:slug" element={<EmpresaDetalhe />} />
          <Route path="produtos" element={<Products />} />
          <Route path="categorias" element={<Categorias />} />
          <Route path="usuarios" element={<Users />} />
          <Route path="relatorios" element={<Reports />} />
          <Route path="logs" element={<Logs />} />
        </Route>
      </Routes>
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
