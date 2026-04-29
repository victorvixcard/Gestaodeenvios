import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus, Mail, Shield, User, Power, PowerOff, Pencil, Check, Briefcase,
  Phone, Info, Search, Filter, Sparkles, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useLog } from "../contexts/LogsContext";
import { useTenant } from "../contexts/TenantContext";
import {
  useData, ALL_PERMISSIONS, DEFAULT_PERMISSIONS, INTERNAL_TENANT,
} from "../contexts/DataContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { AvatarUpload } from "../components/shared/AvatarUpload";
import { Separator } from "../components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { cn } from "../lib/utils";
import type { Permission, User as UserType, UserRole } from "../types";

const ROLE_META: Record<UserRole, { label: string; short: string; description: string; badgeVariant: "default" | "accent" | "success"; color: string }> = {
  super_admin:  { label: "Super Admin",   short: "Super", description: "Acesso total à plataforma. Vê todas as empresas, gerencia produtos e usuários.", badgeVariant: "accent",  color: "text-accent" },
  tenant_admin: { label: "Administrador", short: "Admin", description: "Administra a empresa: vê pedidos, gerencia usuários e relatórios.",            badgeVariant: "default", color: "text-primary" },
  operator:     { label: "Operador",      short: "Op.",   description: "Cria e acompanha pedidos. Não administra usuários.",                            badgeVariant: "success", color: "text-success" },
};

const POSITION_SUGGESTIONS = [
  "Assistente Administrativa",
  "Atendente",
  "Designer",
  "Coordenador(a) de Produção",
  "Vendedor(a)",
  "Diretor(a)",
  "Auxiliar de Logística",
];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  position: "",
  role: "operator" as UserRole,
  tenantSlug: "",
  permissions: [] as Permission[],
  active: true,
  avatarUrl: "",
};

export function Users() {
  const { user: currentUser } = useAuth();
  const tenant = useTenant();
  const { users, companies, addUser, updateUser } = useData();
  const { addLog } = useLog();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isTenantAdmin = currentUser?.role === "tenant_admin";

  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, tenantSlug: tenant.slug });

  // Filtros da listagem
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Empresas disponíveis: clientes + (para super) o tenant interno VIXCard
  const allTenants = useMemo(() => {
    const internal = {
      slug: INTERNAL_TENANT.slug,
      name: INTERNAL_TENANT.name,
      shortName: INTERNAL_TENANT.shortName,
      logoColor: INTERNAL_TENANT.logoColor,
      logoInitials: INTERNAL_TENANT.logoInitials,
      isInternal: true as const,
    };
    const clientCompanies = companies.map((c) => ({
      slug: c.slug, name: c.name, shortName: c.name,
      logoColor: c.logoColor, logoInitials: c.logoInitials,
      isInternal: false as const,
    }));
    return isSuperAdmin ? [internal, ...clientCompanies] : clientCompanies;
  }, [companies, isSuperAdmin]);

  const visibleUsers = useMemo(() => {
    const base = isSuperAdmin
      ? users
      : users.filter((u) => u.tenantSlug === tenant.slug);

    return base.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "active"   && !u.active) return false;
      if (statusFilter === "inactive" && u.active)  return false;
      if (search) {
        const q = search.toLowerCase();
        if (!u.name.toLowerCase().includes(q) &&
            !u.email.toLowerCase().includes(q) &&
            !(u.position ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [users, isSuperAdmin, tenant.slug, search, roleFilter, statusFilter]);

  const visibleTenants = isSuperAdmin
    ? allTenants
    : allTenants.filter((t) => t.slug === tenant.slug);

  const groups = visibleTenants.map((t) => ({
    tenant: t,
    users: visibleUsers.filter((u) => u.tenantSlug === t.slug),
  })).filter((g) => g.users.length > 0 || (isSuperAdmin && search === "" && roleFilter === "all" && statusFilter === "all"));

  const openCreate = (preselectedTenantSlug?: string) => {
    const defaultSlug = preselectedTenantSlug
      ?? (isSuperAdmin ? INTERNAL_TENANT.slug : tenant.slug);
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
      name: u.name,
      email: u.email,
      phone: u.phone ?? "",
      position: u.position ?? "",
      role: u.role,
      tenantSlug: u.tenantSlug,
      permissions: [...u.permissions],
      active: u.active,
      avatarUrl: u.avatarUrl ?? "",
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
    if (!form.name.trim())  { toast.error("Informe o nome.");        return; }
    if (!form.email.trim()) { toast.error("Informe o e-mail.");      return; }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      toast.error("E-mail inválido."); return;
    }
    if (!form.tenantSlug)   { toast.error("Selecione a empresa.");   return; }

    // Bloqueia atribuir super_admin para tenants que não são o interno
    if (form.role === "super_admin" && form.tenantSlug !== INTERNAL_TENANT.slug) {
      toast.error("Super Admin só pode ser atribuído à equipe interna VIXCard.");
      return;
    }

    const actor = {
      userName:  currentUser?.name  ?? "",
      userEmail: currentUser?.email ?? "",
      userRole:  currentUser?.role  ?? ("super_admin" as const),
      tenantSlug: currentUser?.tenantSlug ?? INTERNAL_TENANT.slug,
    };

    const targetCompany = allTenants.find((t) => t.slug === form.tenantSlug);

    if (dialog === "create") {
      addUser({ ...form, name: form.name.trim(), email: form.email.trim() });
      addLog({
        ...actor,
        action: "usuario_criado",
        entityType: "Usuário",
        entityId: `new-${Date.now()}`,
        entityName: form.name,
        details: `Cargo: ${form.position || ROLE_META[form.role].label} — Papel: ${ROLE_META[form.role].label} — ${targetCompany?.name ?? form.tenantSlug} — ${form.permissions.length} permissão(ões)`,
      });
      toast.success(`Usuário criado em ${targetCompany?.shortName ?? form.tenantSlug}.`);
    } else if (editId) {
      updateUser(editId, { ...form, name: form.name.trim(), email: form.email.trim() });
      addLog({
        ...actor,
        action: "usuario_atualizado",
        entityType: "Usuário",
        entityId: editId,
        entityName: form.name,
        details: `Cargo: ${form.position || ROLE_META[form.role].label} — Papel: ${ROLE_META[form.role].label} — ${form.permissions.length} permissão(ões)`,
      });
      toast.success("Usuário atualizado.");
    }
    setDialog(null);
  };

  const toggleActive = (u: UserType) => {
    updateUser(u.id, { active: !u.active });
    const actor = {
      userName:  currentUser?.name  ?? "",
      userEmail: currentUser?.email ?? "",
      userRole:  currentUser?.role  ?? ("super_admin" as const),
      tenantSlug: currentUser?.tenantSlug ?? INTERNAL_TENANT.slug,
    };
    addLog({
      ...actor,
      action: u.active ? "usuario_desativado" : "usuario_ativado",
      entityType: "Usuário",
      entityId: u.id,
      entityName: u.name,
      details: u.email,
    });
    toast.success(u.active ? "Usuário desativado." : "Usuário ativado.");
  };

  const allowedRolesForTenant = (tenantSlug: string): UserRole[] => {
    if (tenantSlug === INTERNAL_TENANT.slug) {
      return isSuperAdmin ? ["super_admin", "tenant_admin", "operator"] : [];
    }
    // tenant cliente
    return isSuperAdmin
      ? ["tenant_admin", "operator"]
      : ["tenant_admin", "operator"];
  };

  const targetTenantInForm = allTenants.find((t) => t.slug === form.tenantSlug);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Cadastros</p>
          <h1 className="font-display text-2xl font-extrabold">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuperAdmin
              ? "Gerencie a equipe interna VIXCard e os usuários de todas as empresas-cliente."
              : "Gerencie os usuários da sua empresa."}
          </p>
        </div>
        {(isSuperAdmin || isTenantAdmin) && (
          <Button variant="brand" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            Novo Usuário
          </Button>
        )}
      </div>

      {/* Banner explicativo */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground mb-1">Como funciona:</p>
            <ul className="space-y-1 list-disc pl-4">
              <li><strong>Cargo</strong> é o título do usuário (ex: "Assistente Administrativa", "Designer") — apenas descritivo.</li>
              <li><strong>Papel</strong> define o nível de acesso: <em>Super Admin</em> (VIXCard), <em>Administrador</em> (gestor da empresa) ou <em>Operador</em> (cria pedidos).</li>
              <li>Cada papel já vem com um <strong>conjunto sugerido de permissões</strong>, mas você pode ajustar individualmente para o usuário.</li>
              {isSuperAdmin && (
                <li>Para sua <strong>assistente da VIXCard</strong>: clique em <em>Novo Usuário</em> com a empresa <strong>VIXCard — Equipe Interna</strong> selecionada e papel <em>Operador</em>.</li>
              )}
            </ul>
          </div>
        </div>
      </Card>

      {/* Stats (super admin) */}
      {isSuperAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total",       value: visibleUsers.length,                                                    icon: User,    color: "text-primary bg-primary/10" },
            { label: "Equipe VIXCard", value: visibleUsers.filter((u) => u.tenantSlug === INTERNAL_TENANT.slug).length, icon: Sparkles, color: "text-accent bg-accent/10" },
            { label: "Admins",      value: visibleUsers.filter((u) => u.role === "tenant_admin").length,           icon: Shield,  color: "text-indigo-600 bg-indigo-500/10" },
            { label: "Ativos",      value: visibleUsers.filter((u) => u.active).length,                            icon: Power,   color: "text-success bg-success/10" },
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

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou cargo..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole | "all")}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os papéis</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="tenant_admin">Administrador</SelectItem>
            <SelectItem value="operator">Operador</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Ativos + Inativos</SelectItem>
            <SelectItem value="active">Apenas ativos</SelectItem>
            <SelectItem value="inactive">Apenas inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User groups */}
      {groups.map(({ tenant: t, users: compUsers }) => {
        const isInternal = t.slug === INTERNAL_TENANT.slug;
        return (
          <div key={t.slug}>
            {(isSuperAdmin || isInternal) && (
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0",
                    isInternal && "ring-2 ring-accent/40 ring-offset-2 ring-offset-background"
                  )}
                  style={{ background: t.logoColor }}
                >
                  {t.logoInitials}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold">{t.name}</h2>
                  {isInternal && (
                    <Badge variant="accent" className="text-[10px] gap-1">
                      <Sparkles className="h-2.5 w-2.5" />
                      Equipe interna
                    </Badge>
                  )}
                  <Badge variant="muted" className="text-[11px]">
                    {compUsers.length} usuário{compUsers.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                {(isSuperAdmin || (isTenantAdmin && t.slug === tenant.slug)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-xs"
                    onClick={() => openCreate(t.slug)}
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar aqui
                  </Button>
                )}
              </div>
            )}

            {compUsers.length === 0 ? (
              <Card className="p-8 flex flex-col items-center gap-2 border-dashed">
                <User className="h-8 w-8 opacity-30" />
                <p className="text-sm text-muted-foreground">Nenhum usuário nesta empresa.</p>
                {(isSuperAdmin || (isTenantAdmin && t.slug === tenant.slug)) && (
                  <Button variant="outline" size="sm" onClick={() => openCreate(t.slug)}>
                    <Plus className="h-3 w-3" />
                    Criar primeiro usuário
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                {compUsers.map((u, i) => {
                  const meta = ROLE_META[u.role];
                  return (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Card className={cn("p-4 bg-gradient-card transition-all hover:shadow-brand hover:-translate-y-0.5", !u.active && "opacity-60")}>
                        <div className="flex items-center gap-3">
                          <AvatarUpload
                            size="sm"
                            shape="round"
                            currentUrl={u.avatarUrl}
                            initials={u.avatarInitials}
                            color={t.logoColor}
                            title="Foto do usuário"
                            hint="Use uma foto nítida com rosto centralizado."
                            onSave={(url) => updateUser(u.id, { avatarUrl: url })}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold truncate">{u.name}</p>
                              {!u.active && <Badge variant="muted" className="text-[9px]">Inativo</Badge>}
                            </div>
                            {u.position && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Briefcase className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                                <p className="text-[11px] text-muted-foreground truncate">{u.position}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </div>
                        </div>

                        <Separator className="my-3" />

                        <div className="flex items-center justify-between mb-3">
                          <Badge variant={meta.badgeVariant} className="text-[11px]">{meta.label}</Badge>
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
                            {u.active ? <><PowerOff className="h-3 w-3" />Desativar</> : <><Power className="h-3 w-3" />Reativar</>}
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
        );
      })}

      {/* Estado vazio total */}
      {groups.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhum usuário encontrado com esses filtros.</p>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog === "create" ? "Novo Usuário" : "Editar Usuário"}
            </DialogTitle>
            {dialog === "create" && targetTenantInForm && (
              <p className="text-xs text-muted-foreground">
                Será criado em{" "}
                <span className="font-semibold text-foreground inline-flex items-center gap-1">
                  <span
                    className="inline-block h-3 w-3 rounded"
                    style={{ background: targetTenantInForm.logoColor }}
                  />
                  {targetTenantInForm.name}
                </span>
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Avatar */}
            <div className="flex justify-center pb-2">
              <AvatarUpload
                size="md"
                shape="round"
                currentUrl={form.avatarUrl || undefined}
                initials={form.name ? form.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "??"}
                color={targetTenantInForm?.logoColor ?? "#6366f1"}
                title="Foto do usuário"
                hint="Use uma foto nítida com rosto centralizado."
                onSave={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
              />
            </div>

            {/* Identificação */}
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                Identificação
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome completo *</Label>
                  <Input
                    placeholder="Ex: Maria Silva"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3 text-muted-foreground" />
                    Cargo
                  </Label>
                  <Input
                    placeholder="Ex: Assistente Administrativa"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    list="position-suggestions"
                  />
                  <datalist id="position-suggestions">
                    {POSITION_SUGGESTIONS.map((p) => <option key={p} value={p} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    E-mail *
                  </Label>
                  <Input
                    placeholder="email@empresa.com"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    Telefone
                  </Label>
                  <Input
                    placeholder="(27) 99999-9999"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Empresa + Papel */}
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                Acesso
              </p>

              {isSuperAdmin && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    Empresa *
                  </Label>
                  <Select
                    value={form.tenantSlug}
                    onValueChange={(v) => {
                      const allowed = allowedRolesForTenant(v);
                      const newRole = allowed.includes(form.role) ? form.role : allowed[0] ?? "operator";
                      setForm({
                        ...form,
                        tenantSlug: v,
                        role: newRole,
                        permissions: [...DEFAULT_PERMISSIONS[newRole]],
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {allTenants.map((t) => (
                        <SelectItem key={t.slug} value={t.slug}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded"
                              style={{ background: t.logoColor }}
                            />
                            {t.name}
                            {t.isInternal && (
                              <span className="text-[9px] uppercase font-bold text-accent ml-1">VIXCard</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Papel *</Label>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(ROLE_META) as UserRole[]).map((role) => {
                    const meta = ROLE_META[role];
                    const isAllowed = allowedRolesForTenant(form.tenantSlug).includes(role);
                    const isSelected = form.role === role;
                    if (!isAllowed) return null;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleRoleChange(role)}
                        className={cn(
                          "flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all border",
                          isSelected
                            ? "bg-primary/8 border-primary ring-1 ring-primary/20"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        <div className={cn(
                          "h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all mt-0.5",
                          isSelected ? "bg-primary border-primary" : "border-border"
                        )}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-semibold", isSelected ? meta.color : "")}>
                            {meta.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                            {meta.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            Acesso padrão: {DEFAULT_PERMISSIONS[role].length} permissões
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <Separator />

            {/* Permissions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Permissões individuais</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {form.permissions.length} de {ALL_PERMISSIONS.length} permissões marcadas
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[10px] text-primary hover:underline"
                    onClick={() => setForm((f) => ({ ...f, permissions: [...DEFAULT_PERMISSIONS[f.role]] }))}
                  >
                    Padrão do papel
                  </button>
                  <span className="text-muted-foreground/40 text-[10px]">|</span>
                  <button
                    type="button"
                    className="text-[10px] text-primary hover:underline"
                    onClick={() => setForm((f) => ({ ...f, permissions: ALL_PERMISSIONS.map((p) => p.key) }))}
                  >
                    Todas
                  </button>
                  <span className="text-muted-foreground/40 text-[10px]">|</span>
                  <button
                    type="button"
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
                  const isDefault = DEFAULT_PERMISSIONS[form.role].includes(perm.key);
                  return (
                    <button
                      key={perm.key}
                      type="button"
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-medium">{perm.label}</p>
                          {isDefault && !active && (
                            <Badge variant="muted" className="text-[8px] uppercase">padrão</Badge>
                          )}
                          {!isDefault && active && (
                            <Badge variant="accent" className="text-[8px] uppercase">extra</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{perm.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active toggle on edit */}
            {dialog === "edit" && (
              <>
                <Separator />
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-xs font-semibold">Status do usuário</p>
                    <p className="text-[10px] text-muted-foreground">
                      Usuários inativos não conseguem fazer login.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={form.active ? "outline" : "destructive"}
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                  >
                    {form.active ? <><Power className="h-3 w-3" />Ativo</> : <><PowerOff className="h-3 w-3" />Inativo</>}
                  </Button>
                </div>
              </>
            )}
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
