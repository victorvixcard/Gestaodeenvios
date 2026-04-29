import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Shield, Mail, User as UserIcon, Building2,
  KeyRound, BellRing, ShoppingCart, ClipboardList,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { useOrders } from "../contexts/OrdersContext";
import { useNotifications } from "../contexts/NotificationsContext";
import { useLog } from "../contexts/LogsContext";
import { AvatarUpload } from "../components/shared/AvatarUpload";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { ALL_PERMISSIONS } from "../contexts/DataContext";

const ROLE_LABEL: Record<string, string> = {
  super_admin:  "Super Admin",
  tenant_admin: "Administrador",
  operator:     "Operador",
};

const ROLE_COLOR: Record<string, string> = {
  super_admin:  "bg-accent/15 text-accent border-accent/30",
  tenant_admin: "bg-primary/15 text-primary border-primary/30",
  operator:     "bg-muted text-muted-foreground border-border",
};

export function Profile() {
  const { user, updateAvatar, updateProfile, logout } = useAuth();
  const tenant = useTenant();
  const { orders } = useOrders();
  const { unreadCount } = useNotifications();
  const { logs, addLog } = useLog();
  const navigate = useNavigate();

  const [name, setName]   = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const stats = useMemo(() => {
    if (!user) return { ordersCreated: 0, ordersAdvanced: 0, lastActivity: null as string | null };
    const isSuper = user.role === "super_admin";
    const accessible = isSuper ? orders : orders.filter((o) => o.tenantSlug === user.tenantSlug);

    let ordersCreated = 0;
    let ordersAdvanced = 0;
    accessible.forEach((o) => {
      o.events.forEach((e) => {
        if (e.authorName !== user.name) return;
        if (e.type === "created") ordersCreated += 1;
        if (e.type === "status_change") ordersAdvanced += 1;
      });
    });

    const userLogs = logs.filter((l) => l.userEmail === user.email);
    const lastActivity = userLogs[0]?.timestamp ?? null;

    return { ordersCreated, ordersAdvanced, lastActivity };
  }, [user, orders, logs]);

  if (!user) return null;

  const dirty = name !== user.name || email !== user.email;
  const initials = name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || user.avatarInitials;

  const handleSave = () => {
    if (!name.trim()) { toast.error("Informe seu nome."); return; }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) { toast.error("Informe um email válido."); return; }
    const before = { name: user.name, email: user.email };
    updateProfile({ name: name.trim(), email: email.trim() });
    addLog({
      action: "usuario_atualizado",
      entityType: "Usuário",
      entityId: user.id,
      entityName: name,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      tenantSlug: user.tenantSlug,
      details: `Perfil próprio atualizado: "${before.name}" / ${before.email} → "${name}" / ${email}`,
    });
    toast.success("Perfil atualizado.");
  };

  const handleLogout = () => {
    logout();
    navigate(`/${tenant.slug}/login`);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Conta</p>
          <h1 className="font-display text-2xl font-extrabold">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Atualize sua foto, nome e email.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Avatar + identity */}
          <Card>
            <CardHeader>
              <CardTitle>Identidade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <AvatarUpload
                  size="lg"
                  currentUrl={user.avatarUrl}
                  initials={initials}
                  color={tenant.logoColor}
                  title="Sua foto de perfil"
                  hint="Use uma foto nítida com o rosto centralizado."
                  onSave={updateAvatar}
                />
                <div className="flex-1 space-y-3 w-full">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      Nome completo
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@empresa.com.br"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border">
                {dirty && (
                  <Button variant="ghost" onClick={() => { setName(user.name); setEmail(user.email); }}>
                    Descartar
                  </Button>
                )}
                <Button variant="brand" onClick={handleSave} disabled={!dirty}>
                  <Save className="h-4 w-4" />
                  Salvar alterações
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Permissões</CardTitle>
                <Badge
                  variant="outline"
                  className={`text-[11px] uppercase tracking-wide ${ROLE_COLOR[user.role]}`}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {ROLE_LABEL[user.role] ?? user.role}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Estas permissões definem o que você pode acessar. Para alterá-las, fale com um administrador.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map((perm) => {
                  const granted = user.permissions.includes(perm.key);
                  return (
                    <div
                      key={perm.key}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border ${
                        granted
                          ? "border-success/25 bg-success/5"
                          : "border-border bg-muted/20 opacity-60"
                      }`}
                    >
                      <div className={`mt-0.5 h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                        granted ? "bg-success text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        {granted ? "✓" : "—"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{perm.label}</p>
                        <p className="text-[11px] text-muted-foreground">{perm.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Security placeholder */}
          <Card>
            <CardHeader><CardTitle>Segurança</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <KeyRound className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Trocar senha</p>
                  <p className="text-[11px] text-muted-foreground">
                    Em breve. Por enquanto, peça a um administrador para resetar sua senha.
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled>Em breve</Button>
              </div>
              <Button
                variant="outline"
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/5"
                onClick={handleLogout}
              >
                Sair da conta
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar column */}
        <div className="space-y-5">
          {/* Tenant card */}
          <Card>
            <CardHeader><CardTitle>Empresa</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: tenant.logoColor }}
                >
                  {tenant.logoInitials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{tenant.name}</p>
                  <p className="text-xs text-muted-foreground truncate">/{tenant.slug}</p>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  Tenant
                </span>
                <span className="font-mono text-muted-foreground">{tenant.slug}</span>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader><CardTitle>Atividade</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Pedidos criados
                </span>
                <span className="font-bold tabular-nums">{stats.ordersCreated}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Avanços de status
                </span>
                <span className="font-bold tabular-nums">{stats.ordersAdvanced}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <BellRing className="h-3.5 w-3.5" />
                  Notificações pendentes
                </span>
                <Badge variant={unreadCount > 0 ? "default" : "muted"} className="text-xs">
                  {unreadCount}
                </Badge>
              </div>
              {stats.lastActivity && (
                <>
                  <Separator />
                  <div className="text-[11px] text-muted-foreground">
                    Última atividade:{" "}
                    <span className="font-medium text-foreground/80">
                      {new Date(stats.lastActivity).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Account info */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-gradient-card">
              <CardContent className="pt-5 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">ID do usuário</span>
                  <span className="font-mono">{user.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Conta</span>
                  <Badge variant={user.active ? "default" : "muted"} className="text-[10px]">
                    {user.active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
