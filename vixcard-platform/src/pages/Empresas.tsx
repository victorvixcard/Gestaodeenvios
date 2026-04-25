import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus, Building2, Users, Package,
  Pencil, PowerOff, Power, Check,
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import type { Company } from "../types";

const PRESET_COLORS = [
  "#1C508A", "#0F7A5A", "#00875A", "#003DA5",
  "#7C3AED", "#DC2626", "#D97706", "#0891B2",
];

const EMPTY_FORM = {
  name: "", logoColor: "#1C508A", logoInitials: "", allowedProductIds: [] as string[], active: true,
};

export function Empresas() {
  const navigate = useNavigate();
  const { tenant } = useParams<{ tenant: string }>();
  const { companies, products, addCompany, updateCompany, users } = useData();
  const { addLog } = useLog();
  const { user } = useAuth();
  const [dialog, setDialog] = useState<"create" | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const colorRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setDialog("create");
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Informe o nome da empresa."); return; }
    if (!form.logoInitials.trim()) { toast.error("Informe as iniciais do logo."); return; }
    addCompany(form);
    addLog({
      action: "empresa_criada", entityType: "Empresa",
      entityId: form.name.toLowerCase().replace(/\s+/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      entityName: form.name,
      userName: user?.name ?? "", userEmail: user?.email ?? "", userRole: user?.role ?? "super_admin",
      tenantSlug: "sistemalegado",
      details: `${form.allowedProductIds.length} produto(s) vinculado(s)`,
    });
    toast.success("Empresa criada com sucesso!");
    setDialog(null);
  };

  const toggleProduct = (id: string) => {
    setForm((f) => ({
      ...f,
      allowedProductIds: f.allowedProductIds.includes(id)
        ? f.allowedProductIds.filter((x) => x !== id)
        : [...f.allowedProductIds, id],
    }));
  };

  const toggleActive = (company: Company) => {
    updateCompany(company.slug, { active: !company.active });
    addLog({
      action: company.active ? "empresa_desativada" : "empresa_ativada",
      entityType: "Empresa", entityId: company.slug, entityName: company.name,
      userName: user?.name ?? "", userEmail: user?.email ?? "", userRole: user?.role ?? "super_admin",
      tenantSlug: "sistemalegado",
    });
    toast.success(company.active ? "Empresa desativada." : "Empresa ativada.");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Cadastros</p>
          <h1 className="font-display text-2xl font-extrabold">Empresas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os clientes da plataforma e seus produtos disponíveis.
          </p>
        </div>
        <Button variant="brand" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Empresas", value: companies.length, icon: Building2, color: "text-primary bg-primary/10" },
          { label: "Ativas",          value: companies.filter((c) => c.active).length, icon: Power, color: "text-success bg-success/10" },
          { label: "Total Usuários",  value: users.filter((u) => u.tenantSlug !== "sistemalegado").length, icon: Users, color: "text-accent bg-accent/10" },
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

      {/* Company grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map((company, i) => {
          const companyUsers = users.filter((u) => u.tenantSlug === company.slug);
          const companyProducts = products.filter((p) => company.allowedProductIds.includes(p.id));
          return (
            <motion.div
              key={company.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card className={`p-5 bg-gradient-card transition-all hover:shadow-brand hover:-translate-y-0.5 ${!company.active && "opacity-60"}`}>
                {/* Logo + name */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md"
                    style={{ background: company.logoColor }}
                  >
                    {company.logoInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{company.name}</p>
                      <Badge variant={company.active ? "success" : "muted"} className="text-[10px] flex-shrink-0">
                        {company.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{company.slug}</p>
                  </div>
                </div>

                <Separator className="mb-4" />

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                    <Users className="h-4 w-4 text-primary/70 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold">{companyUsers.length}</p>
                      <p className="text-[10px] text-muted-foreground">Usuários</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                    <Package className="h-4 w-4 text-primary/70 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold">{companyProducts.length}</p>
                      <p className="text-[10px] text-muted-foreground">Produtos</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => navigate(`/${tenant}/empresas/${company.slug}`)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`flex-1 text-xs ${company.active ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : "text-success hover:bg-success/10 hover:text-success"}`}
                    onClick={() => toggleActive(company)}
                  >
                    {company.active
                      ? <><PowerOff className="h-3.5 w-3.5" />Desativar</>
                      : <><Power className="h-3.5 w-3.5" />Ativar</>
                    }
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Dialog create/edit */}
      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Nome da empresa *</Label>
              <Input
                placeholder="Ex: MedSênior"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Logo initials + color */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Iniciais do logo *</Label>
                <Input
                  placeholder="Ex: MS"
                  maxLength={2}
                  value={form.logoInitials}
                  onChange={(e) => setForm({ ...form, logoInitials: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cor do logo</Label>
                <div className="flex items-center gap-2">
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
                        className={cn("h-5 w-5 rounded-md border-2 transition-all", form.logoColor === c ? "border-foreground scale-110" : "border-transparent")}
                        style={{ background: c }}
                        onClick={() => setForm({ ...form, logoColor: c })}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow"
                style={{ background: form.logoColor }}
              >
                {form.logoInitials || "?"}
              </div>
              <div>
                <p className="text-sm font-semibold">{form.name || "Nome da empresa"}</p>
                <p className="text-xs text-muted-foreground">Portal do cliente</p>
              </div>
            </div>

            <Separator />

            {/* Products */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Produtos disponíveis</Label>
                <span className="text-xs text-muted-foreground">{form.allowedProductIds.length} selecionados</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {products.filter((p) => p.active).map((product) => {
                  const selected = form.allowedProductIds.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      onClick={() => toggleProduct(product.id)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border",
                        selected
                          ? "bg-primary/8 border-primary/30 text-foreground"
                          : "border-border hover:bg-muted/60"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all",
                        selected ? "bg-primary border-primary" : "border-border"
                      )}>
                        {selected && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{product.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{product.code}</p>
                      </div>
                      <Badge variant="muted" className="text-[10px] flex-shrink-0">{product.category}</Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button variant="brand" onClick={handleSave}>
              Criar Empresa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
