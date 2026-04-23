import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useTenant } from "../../contexts/TenantContext";
import { useAuth } from "../../contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const tenant = useTenant();

  if (!isAuthenticated) {
    return <Navigate to={`/${tenant.slug}/login`} replace />;
  }

  // Block wrong tenant access
  if (user && user.tenantSlug !== tenant.slug && user.role !== "super_admin") {
    return <Navigate to={`/${user.tenantSlug}/dashboard`} replace />;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-5 lg:py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
