import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Users as UsersIcon, Building2, Mail, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useTenant, TENANTS } from "../contexts/TenantContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Separator } from "../components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import type { User as UserType, UserRole } from "../types";

const ROLE_LABELS: Record<UserRole, { label: string; variant: "default" | "accent" | "success" }> = {
  super_admin:  { label: "Super Admin",    variant: "accent"  },
  tenant_admin: { label: "Administrador",  variant: "default" },
  operator:     { label: "Operador",       variant: "success" },
};

const MOCK_USERS: (UserType & { tenantName: string })[] = [
  { id: "1", name: "Victor Vixcard",  email: "admin@vixcard.com.br",        role: "super_admin",  tenantSlug: "sistemalegado", avatarInitials: "VV", tenantName: "VIXCard" },
  { id: "2", name: "Ana Medsenior",   email: "admin@medsenior.com.br",       role: "tenant_admin", tenantSlug: "medsenior",     avatarInitials: "AM", tenantName: "MedSênior" },
  { id: "3", name: "Carlos Operador", email: "operador@medsenior.com.br",    role: "operator",     tenantSlug: "medsenior",     avatarInitials: "CO", tenantName: "MedSênior" },
  { id: "4", name: "Admin Unimed",    email: "admin@unimed.com.br",          role: "tenant_admin", tenantSlug: "unimed",        avatarInitials: "AU", tenantName: "Unimed" },
  { id: "5", name: "Admin SEBRAE",    email: "admin@sebrae.com.br",          role: "tenant_admin", tenantSlug: "sebrae",        avatarInitials: "AS", tenantName: "SEBRAE" },
];

export function Users() {
  const { user } = useAuth();
  const tenant = useTenant();
  const isSuperAdmin = user?.role === "super_admin";

  const [users, setUsers] = useState(MOCK_USERS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "tenant_admin" as UserRole, tenantSlug: tenant.slug });

  const visibleUsers = isSuperAdmin
    ? users
    : users.filter((u) => u.tenantSlug === tenant.slug);

  const tenants = Object.values(TENANTS);
  const tenantGroups = isSuperAdmin
    ? tenants.map((t) => ({ tenant: t, users: visibleUsers.filter((u) => u.tenantSlug === t.slug) }))
    : [{ tenant, users: visibleUsers }];

  const addUser = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Preencha nome e e-mail.");
      return;
    }
    const t = TENANTS[form.tenantSlug];
    const initials = form.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    setUsers((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, name: form.name, email: form.email, role: form.role, tenantSlug: form.tenantSlug, avatarInitials: initials, tenantName: t?.name ?? "" },
    ]);
    setForm({ name: "", email: "", role: "tenant_admin", tenantSlug: tenant.slug });
    setShowForm(false);
    toast.success("Usuário criado!");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Administração</p>
          <h1 className="font-display text-2xl font-extrabold">Usuários & Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuperAdmin ? "Gerencie todos os tenants e usuários da plataforma." : "Gerencie os usuários do seu tenant."}
          </p>
        </div>
        <Button variant="brand" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Stats (super admin only) */}
      {isSuperAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Tenants", value: tenants.length, icon: Building2, color: "text-primary bg-primary/10" },
            { label: "Total Usuários", value: users.length, icon: UsersIcon, color: "text-accent bg-accent/10" },
            { label: "Admins", value: users.filter(u => u.role === "tenant_admin").length, icon: Shield, color: "text-success bg-success/10" },
            { label: "Operadores", value: users.filter(u => u.role === "operator").length, icon: User, color: "text-warning bg-warning/10" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="p-4 bg-gradient-card">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div className="font-display text-2xl font-extrabold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
          <Card className="border-primary/20 bg-primary/3">
            <CardContent className="pt-5 space-y-4">
              <p className="font-semibold text-sm">Criar Novo Usuário</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input placeholder="Nome completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail *</Label>
                  <Input placeholder="email@empresa.com.br" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Perfil de acesso</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tenant_admin">Administrador</SelectItem>
                      <SelectItem value="operator">Operador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isSuperAdmin && (
                  <div className="space-y-1.5">
                    <Label>Tenant / Cliente</Label>
                    <Select value={form.tenantSlug} onValueChange={(v) => setForm({ ...form, tenantSlug: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {tenants.filter(t => t.slug !== "sistemalegado").map((t) => (
                          <SelectItem key={t.slug} value={t.slug}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="brand" onClick={addUser}>Criar Usuário</Button>
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* User groups by tenant */}
      {tenantGroups.map(({ tenant: t, users: tenantUsers }) => {
        if (tenantUsers.length === 0) return null;
        return (
          <div key={t.slug}>
            {isSuperAdmin && (
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: t.logoColor }}
                >
                  {t.logoInitials}
                </div>
                <h2 className="text-sm font-semibold">{t.name}</h2>
                <Badge variant="muted" className="text-[11px]">{tenantUsers.length} usuário{tenantUsers.length > 1 ? "s" : ""}</Badge>
              </div>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tenantUsers.map((u, i) => {
                const roleConfig = ROLE_LABELS[u.role];
                return (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="p-4 bg-gradient-card hover:shadow-brand hover:-translate-y-0.5 transition-all">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-sm">{u.avatarInitials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{u.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <div className="flex items-center justify-between">
                        <Badge variant={roleConfig.variant} className="text-[11px]">
                          {roleConfig.label}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground"
                          onClick={() => toast.info("Edição de usuário: integrar com backend.")}
                        >
                          Editar
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
            {isSuperAdmin && <div className="mt-4 mb-2"><Separator /></div>}
          </div>
        );
      })}
    </div>
  );
}
