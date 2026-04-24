import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import { OrdersProvider } from "./contexts/OrdersContext";
import { DataProvider } from "./contexts/DataContext";
import { AppShell } from "./components/layout/AppShell";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Orders } from "./pages/Orders";
import { OrderDetail } from "./pages/OrderDetail";
import { NewOrder } from "./pages/NewOrder";
import { Products } from "./pages/Products";
import { Users } from "./pages/Users";
import { Empresas } from "./pages/Empresas";
import { EmpresaDetalhe } from "./pages/EmpresaDetalhe";
import { Logs } from "./pages/Logs";
import { LogsProvider } from "./contexts/LogsContext";

function TenantRoutes() {
  return (
    <TenantProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pedidos" element={<Orders />} />
          <Route path="pedidos/novo" element={<NewOrder />} />
          <Route path="pedidos/:id" element={<OrderDetail />} />
          <Route path="empresas" element={<Empresas />} />
          <Route path="empresas/:slug" element={<EmpresaDetalhe />} />
          <Route path="produtos" element={<Products />} />
          <Route path="usuarios" element={<Users />} />
          <Route path="logs" element={<Logs />} />
        </Route>
      </Routes>
    </TenantProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <BrowserRouter>
        <LogsProvider>
        <DataProvider>
        <AuthProvider>
          <OrdersProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/medsenior/login" replace />} />
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
          </OrdersProvider>
        </AuthProvider>
        </DataProvider>
        </LogsProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
