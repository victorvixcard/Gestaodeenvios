import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Mail, Shield, User, Power, PowerOff, Pencil, Check, KeyRound, Eye, EyeOff,
  Sparkles, Copy, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useLog } from "../contexts/LogsContext";
import { useTenant } from "../contexts/TenantContext";
import { useData, ALL_PERMISSIONS, DEFAULT_PERMISSIONS } from "../contexts/DataContext";
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
import { api, ApiError } from "../lib/api";
import type { Permission, User as UserType, UserRole } from "../types";

const ROLE_LABELS: Record<UserRole, { label: string; variant: "default" | "accent" | "success" }> = {
  super_admin:  { label: "Super Admin",   variant: "accent" },
  tenant_admin: { label: "Administrador", variant: "default" },
  operator:     { label: "Operador",      variant: "success" },
};

const EMPTY_FORM = {
  name: "", email: "", role: "operator" as UserRole, tenantSlug: "", permissions: [] as Permission[], active: true, avatarUrl: "", password: "",
  whatsapp: "", sectorIds: [] as string[], roleId: "",
};

export function Users() {
  const { user: currentUser } = useAuth();
  const tenant = useTenant();
  const { users, companies, sectors, papeis, addUser, updateUser } = useData();
  const { addLog } = useLog();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isTenantAdmin = currentUser?.role === "tenant_admin";

  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, tenantSlug: tenant.slug });
  const [saving, setSaving] = useState(false);

  // Reset de senha
  const [pwUser, setPwUser] = useState<UserType | null>(null);
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  // Após salvar, mostra tela com a senha definida + botões de copiar/whatsapp
  const [pwSuccessPwd, setPwSuccessPwd] = useState<string | null>(null);

  // Gera senha aleatoria forte e legivel (sem caracteres ambiguos como 0/O, 1/l/I)
  const generatePassword = (length = 12): string => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%";
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    let out = "";
    for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
    return out;
  };

  const openPasswordReset = (u: UserType) => {
    setPwUser(u);
    setPwNew("");
    setPwConfirm("");
    setShowPw(false);
    setPwSuccessPwd(null);
  };

  const closePasswordReset = () => {
    setPwUser(null);
    setPwNew("");
    setPwConfirm("");
    setPwSuccessPwd(null);
  };

  const handleGeneratePassword = () => {
    const generated = generatePassword();
    setPwNew(generated);
    setPwConfirm(generated);
    setShowPw(true);
  };

  const handlePasswordReset = async () => {
    if (!pwUser) return;
    if (pwNew.length < 8) { toast.error("Senha deve ter no mínimo 8 caracteres."); return; }
    if (pwNew !== pwConfirm) { toast.error("As senhas não conferem."); return; }
    setSavingPw(true);
    try {
      await api.patch(`/users/${pwUser.id}/password`, {
        password: pwNew,
        password_confirmation: pwConfirm,
      });
      addLog({
        userName: currentUser?.name ?? "", userEmail: currentUser?.email ?? "",
        userRole: currentUser?.role ?? "super_admin", tenantSlug: currentUser?.tenantSlug ?? "sistemalegado",
        action: "senha_alterada", entityType: "Usuário", entityId: pwUser.id, entityName: pwUser.name,
        details: `Senha redefinida pelo administrador para ${pwUser.email}`,
      });
      // Mostra a tela de sucesso com a senha em texto claro para o admin copiar e enviar
      setPwSuccessPwd(pwNew);
      setShowPw(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Erro ao redefinir senha.";
      toast.error(message);
    } finally {
      setSavingPw(false);
    }
  };

  const copyCredentials = async () => {
    if (!pwUser || !pwSuccessPwd) return;
    const text = `Acesso ao sistema Gestão de Envios\n\nE-mail: ${pwUser.email}\nSenha: ${pwSuccessPwd}\n\nLink: https://gestaodenvios.com.br`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Credenciais copiadas! Cole no WhatsApp/e-mail.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  };

  const openWhatsApp = () => {
    if (!pwUser || !pwSuccessPwd) return;
    const text = encodeURIComponent(
      `Olá ${pwUser.name}! 👋\n\nSuas credenciais de acesso ao *Gestão de Envios*:\n\n📧 E-mail: ${pwUser.email}\n🔑 Senha: ${pwSuccessPwd}\n\n🔗 Acesse: https://gestaodenvios.com.br\n\nRecomendamos alterar a senha no primeiro acesso.`
    );
    // Abre o WhatsApp Web/Desktop sem numero pre-preenchido — o admin escolhe o contato
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const visibleUsers = isSuperAdmin
    ? users.filter((u) => u.tenantSlug !== "sistemalegado")
    : users.filter((u) => u.tenantSlug === tenant.slug);

  // Super admin usa a lista de empresas vinda da API.
  // Tenant admin / operador não tem permissão de listar empresas — monta um grupo sintético com o tenant atual.
  const visibleCompanies = isSuperAdmin
    ? companies
    : companies.length > 0
      ? companies.filter((c) => c.slug === tenant.slug)
      : [{
          slug: tenant.slug,
          name: tenant.name,
          logoColor: tenant.logoColor,
          logoInitials: tenant.logoInitials,
          allowedProductIds: [],
          active: true,
          createdAt: new Date().toISOString(),
        }];

  const openCreate = () => {
    const defaultSlug = isSuperAdmin ? (companies[0]?.slug ?? "") : tenant.slug;
    const papelPadrao = papeis.find((p) => p.active && p.baseRole === "operator");
    setForm({
      ...EMPTY_FORM,
      tenantSlug: defaultSlug,
      role: "operator",
      roleId: papelPadrao?.id ?? "",
      permissions: [...DEFAULT_PERMISSIONS.operator],
    });
    setEditId(null);
    setDialog("create");
  };

  const openEdit = (u: UserType) => {
    setForm({
      name: u.name, email: u.email, role: u.role,
      tenantSlug: u.tenantSlug, permissions: [...u.permissions], active: u.active, avatarUrl: u.avatarUrl ?? "",
      password: "",
      whatsapp: u.whatsapp ?? "",
      sectorIds: u.sectors.map((s) => s.id),
      roleId: u.papel?.id ?? "",
    });
    setEditId(u.id);
    setDialog("edit");
  };

  const toggleSector = (id: string) => {
    setForm((f) => ({
      ...f,
      sectorIds: f.sectorIds.includes(id)
        ? f.sectorIds.filter((s) => s !== id)
        : [...f.sectorIds, id],
    }));
  };

  // Escolher um papel define o nivel de acesso (baseRole) e as permissoes padrao
  const handlePapelChange = (roleId: string) => {
    const papel = papeis.find((p) => p.id === roleId);
    if (!papel) return;
    setForm((f) => ({
      ...f, roleId, role: papel.baseRole,
      permissions: [...DEFAULT_PERMISSIONS[papel.baseRole]],
    }));
  };

  const togglePermission = (perm: Permission) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome."); return; }
    if (!form.email.trim()) { toast.error("Informe o e-mail."); return; }
    if (!form.tenantSlug) { toast.error("Selecione a empresa."); return; }
    if (!form.roleId) { toast.error("Selecione o papel do usuário."); return; }
    if (dialog === "create" && form.password && form.password.length < 8) {
      toast.error("Senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setSaving(true);
    const actor = { userName: currentUser?.name ?? "", userEmail: currentUser?.email ?? "", userRole: currentUser?.role ?? "super_admin" as const, tenantSlug: currentUser?.tenantSlug ?? "sistemalegado" };
    try {
      if (dialog === "create") {
        const created = await addUser(form);
        addLog({ ...actor, action: "usuario_criado", entityType: "Usuário", entityId: String(created.id ?? `new-${Date.now()}`), entityName: form.name, details: `Perfil: ${form.role} — Empresa: ${form.tenantSlug}` });
        const plainPassword = created.plain_password as string | undefined;
        if (plainPassword) {
          toast.success(`Usuário criado! Senha inicial: ${plainPassword}`, { duration: 15000 });
        } else {
          toast.success("Usuário criado!");
        }
      } else if (editId) {
        await updateUser(editId, form);
        addLog({ ...actor, action: "usuario_atualizado", entityType: "Usuário", entityId: editId, entityName: form.name, details: `Perfil: ${form.role} — Empresa: ${form.tenantSlug}` });
        toast.success("Usuário atualizado!");
      }
      setDialog(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Erro ao salvar usuário.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (u: UserType) => {
    updateUser(u.id, { active: !u.active });
    const actor = { userName: currentUser?.name ?? "", userEmail: currentUser?.email ?? "", userRole: currentUser?.role ?? "super_admin" as const, tenantSlug: currentUser?.tenantSlug ?? "sistemalegado" };
    addLog({ ...actor, action: u.active ? "usuario_desativado" : "usuario_ativado", entityType: "Usuário", entityId: u.id, entityName: u.name, details: u.email });
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
                        <AvatarUpload
                          size="sm"
                          shape="round"
                          currentUrl={u.avatarUrl}
                          initials={u.avatarInitials}
                          color="#6366f1"
                          title="Foto do usuário"
                          hint="Use uma foto nítida com rosto centralizado."
                          onSave={(url) => updateUser(u.id, { avatarUrl: url })}
                        />
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
                        <Badge variant={roleConfig.variant} className="text-[11px]">{u.papel?.name ?? roleConfig.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">{u.permissions.length} permissões</span>
                      </div>

                      {u.sectors.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3 -mt-1">
                          {u.sectors.map((s) => (
                            <Badge key={s.id} variant="muted" className="text-[10px]">{s.name}</Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEdit(u)}>
                          <Pencil className="h-3 w-3" />Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-amber-300/40 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30"
                          onClick={() => openPasswordReset(u)}
                          title="Redefinir senha"
                        >
                          <KeyRound className="h-3 w-3" />
                          Senha
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn("text-xs", u.active ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : "text-success hover:bg-success/10 hover:text-success")}
                          onClick={() => toggleActive(u)}
                          title={u.active ? "Desativar usuário" : "Ativar usuário"}
                        >
                          {u.active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
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
            {/* Avatar */}
            <div className="flex justify-center pb-2">
              <AvatarUpload
                size="md"
                shape="round"
                currentUrl={form.avatarUrl || undefined}
                initials={form.name ? form.name.substring(0, 2).toUpperCase() : "??"}
                color="#6366f1"
                title="Foto do usuário"
                hint="Use uma foto nítida com rosto centralizado."
                onSave={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
              />
            </div>

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
                <Label>Telefone / WhatsApp</Label>
                <Input placeholder="(27) 99999-9999" type="tel" value={form.whatsapp}
                       onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select value={form.roleId} onValueChange={handlePapelChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione o papel..." /></SelectTrigger>
                  <SelectContent>
                    {papeis
                      .filter((p) => p.active)
                      .filter((p) => isSuperAdmin || p.baseRole !== "super_admin")
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {form.roleId && (
                  <p className="text-[10px] text-muted-foreground">
                    Nível de acesso: {ROLE_LABELS[papeis.find((p) => p.id === form.roleId)?.baseRole ?? "operator"].label}
                  </p>
                )}
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

              {dialog === "create" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Senha inicial</Label>
                  <Input
                    type="password"
                    placeholder="Mínimo 8 caracteres (deixe em branco para gerar automaticamente)"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Se deixar em branco, o sistema gera uma senha aleatória e mostra na tela após criar.
                  </p>
                </div>
              )}
            </div>

            {/* Setores — um usuário pode estar em mais de um */}
            {sectors.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Setores</Label>
                  <p className="text-[10px] text-muted-foreground -mt-1">
                    O colaborador pode estar em mais de um setor. Os setores agrupam a equipe
                    no painel de Pedidos e Kanban.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sectors
                      .filter((s) => s.active || form.sectorIds.includes(s.id))
                      .map((s) => {
                        const marcado = form.sectorIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSector(s.id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                              marcado
                                ? "bg-primary/10 border-primary/40 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <span className={cn(
                              "h-3.5 w-3.5 rounded flex items-center justify-center border-2 flex-shrink-0",
                              marcado ? "bg-primary border-primary" : "border-border"
                            )}>
                              {marcado && <Check className="h-2.5 w-2.5 text-white" />}
                            </span>
                            {s.name}
                            {!s.active && <span className="text-[9px] opacity-60">(inativo)</span>}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </>
            )}

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
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={saving}>Cancelar</Button>
            <Button variant="brand" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : dialog === "create" ? "Criar Usuário" : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Redefinir senha */}
      <Dialog open={!!pwUser} onOpenChange={(v) => !v && closePasswordReset()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
                <KeyRound className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <DialogTitle>{pwSuccessPwd ? "Senha redefinida!" : "Redefinir senha"}</DialogTitle>
                {pwUser && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pwUser.name} · <span className="font-mono">{pwUser.email}</span>
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* ── ETAPA 1: Definir senha ───────────────────────────────────── */}
          {!pwSuccessPwd && (
            <>
              <div className="space-y-3 py-2">
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/30 p-3">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    <strong>Por segurança, a senha atual não pode ser exibida</strong> — senhas são guardadas como hash irreversível.
                    Defina uma nova senha aqui. Na próxima etapa você poderá copiar/enviar pelo WhatsApp.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Nova senha</Label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      Gerar senha aleatória
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPw ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      value={pwNew}
                      onChange={(e) => setPwNew(e.target.value)}
                      autoComplete="new-password"
                      className="pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Confirmar nova senha</Label>
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="font-mono"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={closePasswordReset} disabled={savingPw}>Cancelar</Button>
                <Button variant="brand" onClick={handlePasswordReset} disabled={savingPw}>
                  {savingPw ? "Salvando..." : "Redefinir senha"}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ── ETAPA 2: Sucesso + envio manual ──────────────────────────── */}
          {pwSuccessPwd && (
            <>
              <div className="space-y-3 py-2">
                <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                  <p className="text-[11px] text-success font-semibold">
                    ✓ Senha alterada com sucesso no servidor.
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Envie as credenciais abaixo para o usuário. <strong>Esta é a última vez que a senha será exibida</strong> — depois disso, não há como visualizá-la novamente.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">E-mail</span>
                    <code className="text-xs font-mono">{pwUser?.email}</code>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Senha</span>
                    <code className="text-xs font-mono font-bold text-foreground bg-yellow-50 dark:bg-yellow-950/30 px-2 py-0.5 rounded">
                      {pwSuccessPwd}
                    </code>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={copyCredentials} className="w-full">
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </Button>
                  <Button onClick={openWhatsApp} className="w-full bg-[#25D366] hover:bg-[#1da851] text-white">
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button variant="brand" onClick={closePasswordReset} className="w-full">
                  <Check className="h-4 w-4" />
                  Concluído
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
