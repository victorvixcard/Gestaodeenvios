import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Mail, Shield, User, Power, PowerOff, Pencil, Check,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { useData, ALL_PERMISSIONS, DEFAULT_PERMISSIONS } from "../contexts/DataContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Separator } from "../components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { cn } from "../lib/utils";
import type { Permission, User as UserType, UserRole } from "../types";

const ROLE_LABELS: Record<UserRole, { label: string; variant: "default" | "accent" | "success" }> = {
  super_admin:  { label: "Super Admin",   variant: "accent" },
  tenant_admin: { label: "Administrador", variant: "default" },
  operator:     { label: "Operador",      variant: "success" },
};

const EMPTY_FORM = {
  name: "", email: "", role: "operator" as UserRole, tenantSlug: "", permissions: [] as Permission[], active: true,
};

export function Users() {
  const { user: currentUser } = useAuth();
  const tenant = useTenant();
  const { users, companies, addUser, updateUser } = useData();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isTenantAdmin = currentUser?.role === "tenant_admin";

  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, tenantSlug: tenant.slug });

  const visibleUsers = isSuperAdmin
    ? users.filter((u) => u.tenantSlug !== "sistemalegado")
    : users.filter((u) => u.tenantSlug === tenant.slug);

  const visibleCompanies = isSuperAdmin ? companies : companies.filter((c) => c.slug === tenant.slug);

  const openCreate = () => {
    const defaultSlug = isSuperAdmin ? (companies[0]?.slug ?? "") : tenant.slug;
    const defaultRole: UserRole = "operator";
    setForm({
      ...EMPTY_FORM,
      tenantSlug: defaultSlug,
      role: defaultRole,
      permissions: [...DEFAULT_PERMISSIONS[defaultRole]],
    });
    setEditId(null);
    setDialog("create");
  };

  const openEdit = (u: UserType) => {
    setForm({
      name: u.name, email: u.email, role: u.role,
      tenantSlug: u.tenantSlug, permissions: [...u.permissions], active: u.active,
    });
    setEditId(u.id);
    setDialog("edit");
  };

  const handleRoleChange = (role: UserRole) => {
    setForm((f) => ({ ...f, role, permissions: [...DEFAULT_PERMISSIONS[role]] }));
  };

  const togglePermission = (perm: Permission) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Informe o nome."); return; }
    if (!form.email.trim()) { toast.error("Informe o e-mail."); return; }
    if (!form.tenantSlug) { toast.error("Selecione a empresa."); return; }

    if (dialog === "create") {
      addUser(form);
      toast.success("Usuário criado!");
    } else if (editId) {
      updateUser(editId, form);
      toast.success("Usuário atualizado!");
    }
    setDialog(null);
  };

  const toggleActive = (u: UserType) => {
    updateUser(u.id, { active: !u.active });
    toast.success(u.active ? "Usuário desativado." : "Usuário ativado.");
  };

  // Group by company
  const groups = visibleCompanies.map((company) => ({
    company,
    users: visibleUsers.filter((u) => u.tenantSlug === company.slug),
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Cadastros</p>
          <h1 className="font-display text-2xl font-extrabold">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuperAdmin ? "Gerencie usuários de todas as empresas." : "Gerencie os usuários da sua empresa."}
          </p>
        </div>
        {(isSuperAdmin || isTenantAdmin) && (
          <Button variant="brand" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Novo Usuário
          </Button>
        )}
      </div>

      {/* Stats (super admin) */}
      {isSuperAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total",       value: visibleUsers.length,                                     icon: User,   color: "text-primary bg-primary/10" },
            { label: "Admins",      value: visibleUsers.filter((u) => u.role === "tenant_admin").length, icon: Shield, color: "text-accent bg-accent/10" },
            { label: "Operadores",  value: visibleUsers.filter((u) => u.role === "operator").length,      icon: User,   color: "text-success bg-success/10" },
            { label: "Ativos",      value: visibleUsers.filter((u) => u.active).length,                   icon: Power,  color: "text-warning bg-warning/10" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="p-4 bg-gradient-card">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div className="font-display text-2xl font-extrabold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* User groups */}
      {groups.map(({ company, users: compUsers }) => (
        <div key={company.slug}>
          {isSuperAdmin && (
            <div className="flex items-center gap-3 mb-3">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: company.logoColor }}>
                {company.logoInitials}
              </div>
              <h2 className="text-sm font-semibold">{company.name}</h2>
              <Badge variant="muted" className="text-[11px]">
                {compUsers.length} usuário{compUsers.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          )}

          {compUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
              <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum usuário nesta empresa.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              {compUsers.map((u, i) => {
                const roleConfig = ROLE_LABELS[u.role];
                return (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className={cn("p-4 bg-gradient-card transition-all hover:shadow-brand hover:-translate-y-0.5", !u.active && "opacity-60")}>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-sm">{u.avatarInitials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold truncate">{u.name}</p>
                            {!u.active && <Badge variant="muted" className="text-[9px]">Inativo</Badge>}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                      </div>

                      <Separator className="my-3" />

                      <div className="flex items-center justify-between mb-3">
                        <Badge variant={roleConfig.variant} className="text-[11px]">{roleConfig.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">{u.permissions.length} permissões</span>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEdit(u)}>
                          <Pencil className="h-3 w-3" />Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn("flex-1 text-xs", u.active ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : "text-success hover:bg-success/10 hover:text-success")}
                          onClick={() => toggleActive(u)}
                        >
                          {u.active ? <><PowerOff className="h-3 w-3" />Off</> : <><Power className="h-3 w-3" />On</>}
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}

          {isSuperAdmin && <Separator className="mb-5" />}
        </div>
      ))}

      {/* Dialog */}
      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "Novo Usuário" : "Editar Usuário"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input placeholder="Nome completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input placeholder="email@empresa.com" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label>Perfil</Label>
                <Select value={form.role} onValueChange={(v) => handleRoleChange(v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                    <SelectItem value="tenant_admin">Administrador</SelectItem>
                    <SelectItem value="operator">Operador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isSuperAdmin && (
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Select value={form.tenantSlug} onValueChange={(v) => setForm({ ...form, tenantSlug: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Separator />

            {/* Permissions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Permissões</Label>
                <div className="flex gap-2">
                  <button
                    className="text-[10px] text-primary hover:underline"
                    onClick={() => setForm((f) => ({ ...f, permissions: ALL_PERMISSIONS.map((p) => p.key) }))}
                  >
                    Todas
                  </button>
                  <span className="text-muted-foreground/40 text-[10px]">|</span>
                  <button
                    className="text-[10px] text-muted-foreground hover:underline"
                    onClick={() => setForm((f) => ({ ...f, permissions: [] }))}
                  >
                    Nenhuma
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {ALL_PERMISSIONS.map((perm) => {
                  const active = form.permissions.includes(perm.key);
                  return (
                    <button
                      key={perm.key}
                      onClick={() => togglePermission(perm.key)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border",
                        active ? "bg-primary/8 border-primary/30" : "border-border hover:bg-muted/60"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all",
                        active ? "bg-primary border-primary" : "border-border"
                      )}>
                        {active && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{perm.label}</p>
                        <p className="text-[10px] text-muted-foreground">{perm.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button variant="brand" onClick={handleSave}>
              {dialog === "create" ? "Criar Usuário" : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
