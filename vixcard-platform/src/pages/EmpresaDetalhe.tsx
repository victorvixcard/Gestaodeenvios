import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, MessageCircle, KeyRound, Package,
  User as UserIcon, Eye, EyeOff, Check,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useLog } from "../contexts/LogsContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import { AvatarUpload } from "../components/shared/AvatarUpload";
import type { User } from "../types";

const PRESET_COLORS = [
  "#1C508A", "#0F7A5A", "#00875A", "#003DA5",
  "#7C3AED", "#DC2626", "#D97706", "#0891B2",
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  tenant_admin: "Administrador",
  operator: "Operador",
};

export function EmpresaDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companies, products, users, updateCompany } = useData();
  const { addLog } = useLog();

  const company = companies.find((c) => c.slug === slug);
  const companyUsers = users.filter((u) => u.tenantSlug === slug);
  const companyProducts = products.filter(
    (p) => p.active && company?.allowedProductIds.includes(p.id)
  );

  const [form, setForm] = useState(() =>
    company
      ? { name: company.name, logoColor: company.logoColor, logoInitials: company.logoInitials, logoUrl: company.logoUrl, active: company.active }
      : { name: "", logoColor: "#1C508A", logoInitials: "", logoUrl: undefined as string | undefined, active: true }
  );
  const colorRef = useRef<HTMLInputElement>(null);

  const [waUser, setWaUser] = useState<User | null>(null);
  const [waPhone, setWaPhone] = useState("");

  const [pwUser, setPwUser] = useState<User | null>(null);
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-muted-foreground">Empresa não encontrada.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  const handleSaveDados = () => {
    if (!form.name.trim()) { toast.error("Informe o nome."); return; }
    if (!form.logoInitials.trim()) { toast.error("Informe as iniciais."); return; }
    updateCompany(company.slug, { name: form.name, logoColor: form.logoColor, logoInitials: form.logoInitials, logoUrl: form.logoUrl, active: form.active });
    addLog({
      action: "empresa_atualizada", entityType: "Empresa", entityId: company.slug, entityName: form.name,
      userName: user?.name ?? "", userEmail: user?.email ?? "", userRole: user?.role ?? "super_admin",
      tenantSlug: "sistemalegado", details: `Dados cadastrais atualizados`,
    });
    toast.success("Dados atualizados!");
  };

  const handleWhatsApp = () => {
    if (!waUser) return;
    const phone = waPhone.replace(/\D/g, "");
    if (phone.length < 10) { toast.error("Informe um número válido."); return; }
    const msg = encodeURIComponent(
      `Olá ${waUser.name}! 👋\n\nSeus dados de acesso ao *VIXCard Gestão de Pedidos*:\n\n📧 E-mail: ${waUser.email}\n🔑 Senha: vixcard123 (altere no primeiro acesso)\n\n🔗 Acesso: https://gestaodeenvios-two.vercel.app`
    );
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
    addLog({
      action: "credenciais_enviadas", entityType: "Usuário", entityId: waUser.id, entityName: waUser.name,
      userName: user?.name ?? "", userEmail: user?.email ?? "", userRole: user?.role ?? "super_admin",
      tenantSlug: "sistemalegado", details: `Credenciais enviadas por WhatsApp para ${waUser.email}`,
    });
    setWaUser(null);
    setWaPhone("");
  };

  const handleChangePassword = () => {
    if (!pwUser) return;
    if (pwNew.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres."); return; }
    if (pwNew !== pwConfirm) { toast.error("As senhas não conferem."); return; }
    addLog({
      action: "senha_alterada", entityType: "Usuário", entityId: pwUser.id, entityName: pwUser.name,
      userName: user?.name ?? "", userEmail: user?.email ?? "", userRole: user?.role ?? "super_admin",
      tenantSlug: "sistemalegado", details: `Senha alterada para o usuário ${pwUser.email}`,
    });
    toast.success(`Senha de ${pwUser.name} atualizada!`);
    setPwUser(null);
    setPwNew("");
    setPwConfirm("");
  };

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl overflow-hidden shadow flex-shrink-0">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold" style={{ background: company.logoColor }}>
                  {company.logoInitials}
                </div>
              )}
            </div>
            <div>
              <h1 className="font-display text-xl font-extrabold">{company.name}</h1>
              <p className="text-xs text-muted-foreground font-mono">{company.slug}</p>
            </div>
          </div>
          <Badge variant={company.active ? "success" : "muted"} className="ml-1">
            {company.active ? "Ativa" : "Inativa"}
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
            <TabsTrigger value="credenciais">
              Credenciais
              <span className="ml-1.5 bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {companyUsers.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="produtos">
              Produtos
              <span className="ml-1.5 bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {companyProducts.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* ── Dados Cadastrais ── */}
          <TabsContent value="dados">
            <Card className="p-5 bg-gradient-card max-w-lg">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome da empresa</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Iniciais do logo</Label>
                    <Input
                      maxLength={2}
                      value={form.logoInitials}
                      onChange={(e) => setForm({ ...form, logoInitials: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cor do logo</Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        className="h-9 w-9 rounded-lg cursor-pointer border border-border flex-shrink-0"
                        style={{ background: form.logoColor }}
                        onClick={() => colorRef.current?.click()}
                      />
                      <input
                        ref={colorRef}
                        type="color"
                        className="sr-only"
                        value={form.logoColor}
                        onChange={(e) => setForm({ ...form, logoColor: e.target.value })}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            className={`h-5 w-5 rounded-md border-2 transition-all ${form.logoColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                            style={{ background: c }}
                            onClick={() => setForm({ ...form, logoColor: c })}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <AvatarUpload
                    size="md"
                    shape="rect"
                    aspect={1}
                    currentUrl={form.logoUrl}
                    initials={form.logoInitials || "?"}
                    color={form.logoColor}
                    title="Logo da empresa"
                    hint="Use uma imagem quadrada com fundo transparente ou sólido."
                    onSave={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
                  />
                  <div>
                    <p className="text-sm font-semibold">{form.name || "Nome da empresa"}</p>
                    <p className="text-xs text-muted-foreground">Clique no logo para atualizar</p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Status da empresa</p>
                    <p className="text-xs text-muted-foreground">Inativas não conseguem acessar o sistema</p>
                  </div>
                  <button
                    onClick={() => setForm({ ...form, active: !form.active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.active ? "bg-success" : "bg-muted"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.active ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>

                <Button variant="brand" onClick={handleSaveDados} className="w-full">
                  <Save className="h-4 w-4" />
                  Salvar Alterações
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* ── Credenciais ── */}
          <TabsContent value="credenciais">
            <div className="space-y-3 max-w-2xl">
              {companyUsers.length === 0 ? (
                <Card className="p-8 bg-gradient-card text-center">
                  <UserIcon className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado nesta empresa.</p>
                </Card>
              ) : (
                companyUsers.map((user, i) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="p-4 bg-gradient-card">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {user.avatarInitials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{user.name}</p>
                            <Badge variant="muted" className="text-[10px]">{ROLE_LABELS[user.role]}</Badge>
                            <Badge variant={user.active ? "success" : "muted"} className="text-[10px]">
                              {user.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono truncate">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#25D366]"
                            title="Enviar credenciais por WhatsApp"
                            onClick={() => { setWaUser(user); setWaPhone(""); }}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"
                            title="Alterar senha"
                            onClick={() => { setPwUser(user); setPwNew(""); setPwConfirm(""); setShowPw(false); }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ── Produtos ── */}
          <TabsContent value="produtos">
            {companyProducts.length === 0 ? (
              <Card className="p-8 bg-gradient-card text-center">
                <Package className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum produto ativo vinculado a esta empresa.</p>
                <p className="text-xs text-muted-foreground mt-1">Edite os dados da empresa para vincular produtos.</p>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {companyProducts.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="overflow-hidden bg-gradient-card hover:shadow-brand hover:-translate-y-0.5 transition-all">
                      <div className="aspect-video bg-muted/50 flex items-center justify-center overflow-hidden">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
                            <Package className="h-8 w-8" />
                            <span className="text-[10px]">sem foto</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{product.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{product.code}</p>
                          </div>
                          <Badge variant="muted" className="text-[10px] flex-shrink-0 mt-0.5">{product.category}</Badge>
                        </div>
                        {product.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{product.description}</p>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* WhatsApp Dialog */}
      <Dialog open={!!waUser} onOpenChange={(v) => !v && setWaUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
              Enviar Credenciais via WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-xl bg-muted/50 text-xs space-y-1">
              <p><span className="font-medium">Usuário:</span> <span className="text-muted-foreground">{waUser?.name}</span></p>
              <p><span className="font-medium">E-mail:</span> <span className="text-muted-foreground font-mono">{waUser?.email}</span></p>
            </div>
            <div className="space-y-1.5">
              <Label>Número do WhatsApp</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground flex-shrink-0 border border-border rounded-md px-3 h-9 flex items-center">+55</span>
                <Input
                  placeholder="(11) 99999-9999"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">DDD + número, sem espaços ou traços</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setWaUser(null)}>Cancelar</Button>
            <Button
              className="bg-[#25D366] hover:bg-[#1da851] text-white"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="h-4 w-4" />
              Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={!!pwUser} onOpenChange={(v) => !v && setPwUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              Alterar Senha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-xl bg-muted/50 text-xs">
              <p><span className="font-medium">Usuário:</span> <span className="text-muted-foreground">{pwUser?.name}</span></p>
            </div>
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPw(!showPw)}
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
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPwUser(null)}>Cancelar</Button>
            <Button variant="brand" onClick={handleChangePassword}>
              <Check className="h-4 w-4" />
              Salvar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
