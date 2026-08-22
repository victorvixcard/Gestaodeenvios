import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  LogOut, ChevronRight, X, Shield, Building2,
  FolderOpen, ChevronDown, ClipboardList, BarChart3, KanbanSquare, Tags, Network, ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTenant } from "../../contexts/TenantContext";
import { cn } from "../../lib/utils";
import type { MenuKey } from "../../types";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const tenant = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = isSuperAdmin || user?.role === "tenant_admin";

  // O papel so RESTRINGE a navegacao por cima do nivel de acesso: menus null
  // significa "tudo que o nivel ja permite". A seguranca continua nas rotas
  // da API — esconder menu aqui e conforto visual, nao barreira.
  const menuVisivel = (key: MenuKey): boolean =>
    user?.papel?.menus == null || user.papel.menus.includes(key);

  const cadastrosRoutes = [`/${tenant.slug}/empresas`, `/${tenant.slug}/produtos`, `/${tenant.slug}/categorias`, `/${tenant.slug}/usuarios`, `/${tenant.slug}/setores`, `/${tenant.slug}/papeis`];
  const algumCadastroVisivel = (["cadastros.empresas", "cadastros.produtos", "cadastros.categorias", "cadastros.usuarios", "cadastros.setores", "cadastros.papeis"] as MenuKey[]).some(menuVisivel);
  const cadastrosActive = cadastrosRoutes.some((r) => location.pathname.startsWith(r));
  const [cadastrosOpen, setCadastrosOpen] = useState(cadastrosActive);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
      isActive
        ? "bg-sidebar-accent text-white"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
    );

  const subNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
      isActive
        ? "bg-sidebar-accent text-white"
        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
    );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ background: tenant.logoColor }}
        >
          {tenant.logoInitials}
        </div>
        <div className="min-w-0">
          <p className="text-sidebar-foreground text-sm font-semibold truncate">{tenant.name}</p>
          <p className="text-[11px] text-sidebar-foreground/50 truncate">{user?.email}</p>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden ml-auto text-sidebar-foreground/50 hover:text-sidebar-foreground"
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Super admin badge */}
      {isSuperAdmin && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/25">
          <Shield className="h-3.5 w-3.5 text-accent flex-shrink-0" />
          <span className="text-xs font-semibold text-accent">Super Admin</span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] uppercase tracking-widest font-semibold text-sidebar-foreground/40">
          Menu
        </p>

        {menuVisivel("dashboard") && (
        <NavLink to={`/${tenant.slug}/dashboard`} onClick={onClose} className={navLinkClass}>
          {({ isActive }) => (
            <>
              <LayoutDashboard className={cn("h-4 w-4 flex-shrink-0", isActive && "text-sidebar-primary")} />
              <span>Dashboard</span>
              {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary/70" />}
            </>
          )}
        </NavLink>
        )}

        {menuVisivel("pedidos") && (
        <NavLink to={`/${tenant.slug}/pedidos`} onClick={onClose} className={navLinkClass}>
          {({ isActive }) => (
            <>
              <ShoppingCart className={cn("h-4 w-4 flex-shrink-0", isActive && "text-sidebar-primary")} />
              <span>Pedidos</span>
              {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary/70" />}
            </>
          )}
        </NavLink>
        )}

        {menuVisivel("kanban") && (
        <NavLink to={`/${tenant.slug}/kanban`} onClick={onClose} className={navLinkClass}>
          {({ isActive }) => (
            <>
              <KanbanSquare className={cn("h-4 w-4 flex-shrink-0", isActive && "text-sidebar-primary")} />
              <span>Kanban</span>
              {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary/70" />}
            </>
          )}
        </NavLink>
        )}

        {(user?.permissions.includes("view_reports") || isSuperAdmin) && menuVisivel("relatorios") && (
          <NavLink to={`/${tenant.slug}/relatorios`} onClick={onClose} className={navLinkClass}>
            {({ isActive }) => (
              <>
                <BarChart3 className={cn("h-4 w-4 flex-shrink-0", isActive && "text-sidebar-primary")} />
                <span>Relatórios</span>
                {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary/70" />}
              </>
            )}
          </NavLink>
        )}

        {/* Cadastros section */}
        {isAdmin && algumCadastroVisivel && (
          <div className="pt-3">
            <p className="px-3 pb-2 text-[10px] uppercase tracking-widest font-semibold text-sidebar-foreground/40">
              Cadastros
            </p>

            <button
              onClick={() => setCadastrosOpen((v) => !v)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                cadastrosActive
                  ? "text-sidebar-foreground bg-sidebar-accent/40"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <FolderOpen className="h-4 w-4 flex-shrink-0" />
              <span>Cadastros</span>
              <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform duration-200", cadastrosOpen && "rotate-180")} />
            </button>

            <AnimatePresence initial={false}>
              {cadastrosOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pl-3 mt-0.5 space-y-0.5"
                >
                  {isSuperAdmin && menuVisivel("cadastros.empresas") && (
                    <NavLink to={`/${tenant.slug}/empresas`} onClick={onClose} className={subNavLinkClass}>
                      {({ isActive }) => (
                        <>
                          <Building2 className={cn("h-3.5 w-3.5 flex-shrink-0", isActive && "text-sidebar-primary")} />
                          <span>Empresas</span>
                        </>
                      )}
                    </NavLink>
                  )}
                  {menuVisivel("cadastros.produtos") && (
                  <NavLink to={`/${tenant.slug}/produtos`} onClick={onClose} className={subNavLinkClass}>
                    {({ isActive }) => (
                      <>
                        <Package className={cn("h-3.5 w-3.5 flex-shrink-0", isActive && "text-sidebar-primary")} />
                        <span>Produtos</span>
                      </>
                    )}
                  </NavLink>
                  )}
                  {isSuperAdmin && menuVisivel("cadastros.categorias") && (
                    <NavLink to={`/${tenant.slug}/categorias`} onClick={onClose} className={subNavLinkClass}>
                      {({ isActive }) => (
                        <>
                          <Tags className={cn("h-3.5 w-3.5 flex-shrink-0", isActive && "text-sidebar-primary")} />
                          <span>Categorias</span>
                        </>
                      )}
                    </NavLink>
                  )}
                  {menuVisivel("cadastros.usuarios") && (
                  <NavLink to={`/${tenant.slug}/usuarios`} onClick={onClose} className={subNavLinkClass}>
                    {({ isActive }) => (
                      <>
                        <Users className={cn("h-3.5 w-3.5 flex-shrink-0", isActive && "text-sidebar-primary")} />
                        <span>Usuários</span>
                      </>
                    )}
                  </NavLink>
                  )}
                  {isSuperAdmin && menuVisivel("cadastros.setores") && (
                    <NavLink to={`/${tenant.slug}/setores`} onClick={onClose} className={subNavLinkClass}>
                      {({ isActive }) => (
                        <>
                          <Network className={cn("h-3.5 w-3.5 flex-shrink-0", isActive && "text-sidebar-primary")} />
                          <span>Setores</span>
                        </>
                      )}
                    </NavLink>
                  )}
                  {isSuperAdmin && menuVisivel("cadastros.papeis") && (
                    <NavLink to={`/${tenant.slug}/papeis`} onClick={onClose} className={subNavLinkClass}>
                      {({ isActive }) => (
                        <>
                          <ShieldCheck className={cn("h-3.5 w-3.5 flex-shrink-0", isActive && "text-sidebar-primary")} />
                          <span>Papéis</span>
                        </>
                      )}
                    </NavLink>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {/* Logs — super admin only */}
        {isSuperAdmin && menuVisivel("logs") && (
          <div className="pt-3">
            <p className="px-3 pb-2 text-[10px] uppercase tracking-widest font-semibold text-sidebar-foreground/40">
              Sistema
            </p>
            <NavLink to={`/${tenant.slug}/logs`} onClick={onClose} className={navLinkClass}>
              {({ isActive }) => (
                <>
                  <ClipboardList className={cn("h-4 w-4 flex-shrink-0", isActive && "text-sidebar-primary")} />
                  <span>Logs de Auditoria</span>
                  {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary/70" />}
                </>
              )}
            </NavLink>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-[260px] bg-sidebar text-sidebar-foreground flex flex-col"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
